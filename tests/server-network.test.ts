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

describe('network tools (server)', () => {
  it('registers connect, respond_invitation, follow, endorse_skill, remove_connection, get_invitations', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const names = (await client.listTools()).tools.map((t) => t.name);
      for (const expected of ['connect', 'respond_invitation', 'follow', 'endorse_skill', 'remove_connection', 'get_invitations']) {
        expect(names).toContain(expected);
      }
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('the write tools report ok and the invitation read works', async () => {
    const { client, serverConnected } = await startServer();
    try {
      expect(JSON.parse((await callTool(client, 'connect', { profileUrn: 'urn:li:member:7', note: 'Hi!' })).text)).toEqual({ ok: true });
      expect(JSON.parse((await callTool(client, 'respond_invitation', { invitationUrn: 'urn:li:invitation:1', action: 'accept' })).text)).toEqual({ ok: true });
      expect(JSON.parse((await callTool(client, 'follow', { urn: 'urn:li:company:1', kind: 'company', follow: true })).text)).toEqual({ ok: true });
      expect(JSON.parse((await callTool(client, 'endorse_skill', { profileUrn: 'urn:li:member:7', skillId: 'urn:li:fsd_skill:123', vanityName: 'someone' })).text)).toEqual({ ok: true });
      expect(JSON.parse((await callTool(client, 'remove_connection', { vanityName: 'someone' })).text)).toEqual({ ok: true });
      expect(JSON.parse((await callTool(client, 'get_invitations', {})).text)).toEqual([]);
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('validates the invitation action and the follow kind enums', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const badAction = await client.callTool({ name: 'respond_invitation', arguments: { invitationUrn: 'urn:li:invitation:1', action: 'maybe' } });
      expect(badAction.isError).toBe(true);
      const badKind = await client.callTool({ name: 'follow', arguments: { urn: 'urn:li:member:7', kind: 'robot', follow: true } });
      expect(badKind.isError).toBe(true);
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('network writes are blocked in read-only mode', async () => {
    const server = createAgenticLinkedinServer(new FakeTransport({ state: 'healthy' }), { readOnly: true });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const serverConnected = server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const result = await callTool(client, 'connect', { profileUrn: 'urn:li:member:7', note: 'Hi' });
      expect(result.isError).toBe(true);
      expect(result.text).toContain('read-only');
    } finally {
      await client.close();
      await serverConnected;
    }
  });
});
