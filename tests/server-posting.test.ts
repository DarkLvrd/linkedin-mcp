import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createAgenticLinkedinServer } from '../src/server.js';
import { FakeTransport } from '../src/transport/fake.js';

async function startServer() {
  const server = createAgenticLinkedinServer(new FakeTransport({ state: 'healthy' }), { readOnly: false });
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

describe('posting tools (server)', () => {
  it('registers create_post, edit_post, delete_post, comment, react', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const tools = await client.listTools();
      const names = tools.tools.map((t) => t.name);
      for (const expected of ['create_post', 'edit_post', 'delete_post', 'comment', 'react']) {
        expect(names).toContain(expected);
      }
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('create_post returns the verified result from the transport', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const result = await callTool(client, 'create_post', { text: 'Hello LinkedIn!' });
      expect(result.isError).toBe(false);
      expect(JSON.parse(result.text)).toEqual({
        verified: true,
        post: {
          id: 'urn:li:activity:new',
          authorUrn: 'urn:li:member:42',
          text: 'Hello LinkedIn!',
          publishedAt: '2026-05-28T20:26:40.000Z',
        },
      });
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('edit_post, delete_post, comment, react report ok', async () => {
    const { client, serverConnected } = await startServer();
    try {
      expect(JSON.parse((await callTool(client, 'edit_post', { postId: 'urn:li:activity:1', text: 'New' })).text)).toEqual({ ok: true });
      expect(JSON.parse((await callTool(client, 'delete_post', { postId: 'urn:li:activity:1' })).text)).toEqual({ ok: true });
      expect(JSON.parse((await callTool(client, 'comment', { postId: 'urn:li:activity:1', text: 'Nice' })).text)).toEqual({ ok: true });
      expect(JSON.parse((await callTool(client, 'react', { postId: 'urn:li:activity:1', reaction: 'LIKE' })).text)).toEqual({ ok: true });
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('react validates the reaction against the known set', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const result = await client.callTool({ name: 'react', arguments: { postId: 'urn:li:activity:1', reaction: 'LOVE' } });
      expect(result.isError).toBe(true);
    } finally {
      await client.close();
      await serverConnected;
    }
  });
});
