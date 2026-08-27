import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createAgenticLinkedinServer } from '../src/server.js';
import { FakeTransport } from '../src/transport/fake.js';
import { SessionRequiredError } from '../src/transport/types.js';
import type { Post } from '../src/voyager/types.js';

const post: Post = {
  id: 'urn:li:activity:100',
  authorUrn: 'urn:li:member:42',
  text: 'Hello LinkedIn!',
  publishedAt: '2026-05-28T20:26:40.000Z',
};

async function startServer(transport: FakeTransport) {
  const server = createAgenticLinkedinServer(transport, { readOnly: false });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const serverConnected = server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, serverConnected };
}

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return { text, isError: result.isError === true };
}

describe('read tools (server)', () => {
  it('registers all seven read tools', async () => {
    const { client, serverConnected } = await startServer(new FakeTransport({ state: 'healthy' }));
    try {
      const tools = await client.listTools();
      const names = tools.tools.map((t) => t.name);
      for (const expected of [
        'get_me',
        'get_profile',
        'get_posts',
        'get_conversations',
        'get_connections_summary',
        'get_jobs',
        'get_analytics',
      ]) {
        expect(names).toContain(expected);
      }
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('returns clean, mapped shapes from the transport — no raw shapes leak', async () => {
    const transport = new FakeTransport({
      state: 'healthy',
      reads: { posts: [post], connectionsSummary: { connections: 137 }, analytics: { profileViews: 120 } },
    });
    const { client, serverConnected } = await startServer(transport);
    try {
      expect(JSON.parse((await callTool(client, 'get_me', {})).text)).toEqual({
        id: 'urn:li:member:42',
        firstName: 'Test',
        lastName: 'User',
        headline: 'Tester',
        vanityName: 'testuser',
      });
      expect(JSON.parse((await callTool(client, 'get_profile', { identifier: 'urn:li:member:42' })).text)).toEqual({
        id: 'urn:li:member:42',
        firstName: 'Test',
        lastName: 'User',
        headline: 'Tester',
        location: 'Testville',
        about: 'Testing things.',
      });
      expect(JSON.parse((await callTool(client, 'get_posts', {})).text)).toEqual([post]);
      expect(JSON.parse((await callTool(client, 'get_conversations', {})).text)).toEqual([]);
      expect(JSON.parse((await callTool(client, 'get_connections_summary', {})).text)).toEqual({
        connections: 137,
      });
      expect(JSON.parse((await callTool(client, 'get_jobs', { keywords: 'engineer' })).text)).toEqual([]);
      expect(JSON.parse((await callTool(client, 'get_analytics', {})).text)).toEqual({ profileViews: 120 });
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('surfaces a missing session as a clean tool error', async () => {
    const noSessionTransport = new (class extends FakeTransport {
      override async getMe(): Promise<never> {
        throw new SessionRequiredError();
      }
    })({ state: 'no-session' });
    const { client, serverConnected } = await startServer(noSessionTransport);
    try {
      const result = await callTool(client, 'get_me', {});
      expect(result.isError).toBe(true);
      expect(result.text).toContain('no LinkedIn session');
    } finally {
      await client.close();
      await serverConnected;
    }
  });
});
