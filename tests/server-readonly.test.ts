import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createAgenticLinkedinServer } from '../src/server.js';
import { FakeTransport } from '../src/transport/fake.js';

async function startServer(readOnly: boolean) {
  const server = createAgenticLinkedinServer(new FakeTransport({ state: 'healthy' }), { readOnly });
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

describe('read-only mode (server)', () => {
  it('blocks every write tool outright while reads keep working', async () => {
    const { client, serverConnected } = await startServer(true);
    try {
      for (const [name, args] of [
        ['update_profile', { headline: 'H' }],
        ['add_skill', { name: 'TypeScript' }],
        ['remove_skill', { skillUrn: 'urn:li:fsd_profileSkill:1' }],
        ['reorder_skills', { order: ['TypeScript'] }],
        ['delete_ghost_entry', { section: 'position', urn: 'urn:li:fsd_profilePosition:1' }],
      ] as const) {
        const result = await callTool(client, name, args);
        expect(result.isError).toBe(true);
        expect(result.text).toContain('read-only');
      }
      // Reads are untouched.
      expect((await callTool(client, 'get_me', {})).isError).toBe(false);
      expect(JSON.parse((await callTool(client, 'get_me', {})).text).id).toBe('urn:li:member:42');
    } finally {
      await client.close();
      await serverConnected;
    }
  });
});
