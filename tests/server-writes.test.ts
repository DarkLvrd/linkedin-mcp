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

describe('write tools (server)', () => {
  it('registers the five write tools', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const tools = await client.listTools();
      const names = tools.tools.map((t) => t.name);
      for (const expected of ['update_profile', 'add_skill', 'remove_skill', 'reorder_skills', 'delete_ghost_entry']) {
        expect(names).toContain(expected);
      }
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('update_profile returns the verified (read-back) profile', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const result = await callTool(client, 'update_profile', { headline: 'New headline' });
      expect(result.isError).toBe(false);
      const profile = JSON.parse(result.text);
      expect(profile.headline).toBe('New headline');
      expect(profile.id).toBe('urn:li:member:42');
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('add_skill and remove_skill return the post-write skills state', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const added = JSON.parse((await callTool(client, 'add_skill', { name: 'TypeScript' })).text);
      expect(added.skills).toEqual([{ name: 'TypeScript', urn: 'urn:li:fsd_profileSkill:fake' }]);
      const removed = JSON.parse((await callTool(client, 'remove_skill', { skillUrn: 'urn:li:fsd_profileSkill:fake' })).text);
      expect(removed.skills).toEqual([]);
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('reorder_skills returns the skills in the new order', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const result = await callTool(client, 'reorder_skills', { order: ['TypeScript', 'PHP'] });
      const state = JSON.parse(result.text);
      expect(state.skills.map((s: { name: string }) => s.name)).toEqual(['TypeScript', 'PHP']);
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('delete_ghost_entry routes the delete and reports ok', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const result = await callTool(client, 'delete_ghost_entry', {
        section: 'position',
        urn: 'urn:li:fsd_profilePosition:77',
      });
      expect(JSON.parse(result.text)).toEqual({ ok: true });
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('rejects malformed input (non-array order)', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const result = await client.callTool({ name: 'reorder_skills', arguments: { order: 'TypeScript' } });
      expect(result.isError).toBe(true);
    } finally {
      await client.close();
      await serverConnected;
    }
  });
});
