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

describe('messaging tools (server)', () => {
  it('registers send_message, recall_message, react_to_message, get_conversation_history', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const names = (await client.listTools()).tools.map((t) => t.name);
      for (const expected of ['send_message', 'recall_message', 'react_to_message', 'get_conversation_history']) {
        expect(names).toContain(expected);
      }
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('send_message returns the originToken for retry idempotency', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const result = await callTool(client, 'send_message', {
        conversationUrn: 'urn:li:msg_conversation:500',
        text: 'Hello',
      });
      const parsed = JSON.parse(result.text);
      expect(parsed.ok).toBe(true);
      expect(typeof parsed.originToken).toBe('string');
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('recall_message, react_to_message, and history work', async () => {
    const { client, serverConnected } = await startServer();
    try {
      expect(
        JSON.parse(
          (await callTool(client, 'recall_message', { conversationUrn: 'urn:li:msg_conversation:500', messageId: 'urn:li:msg_event:11' })).text,
        ),
      ).toEqual({ ok: true });
      expect(
        JSON.parse(
          (await callTool(client, 'react_to_message', { conversationUrn: 'urn:li:msg_conversation:500', messageId: 'urn:li:msg_event:11', emoji: '👍' })).text,
        ),
      ).toEqual({ ok: true });
      expect(JSON.parse((await callTool(client, 'get_conversation_history', { conversationUrn: 'urn:li:msg_conversation:500' })).text)).toEqual([]);
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('messaging writes are blocked in read-only mode', async () => {
    const server = createAgenticLinkedinServer(new FakeTransport({ state: 'healthy' }), { readOnly: true });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const serverConnected = server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const result = await callTool(client, 'send_message', { conversationUrn: 'urn:li:msg_conversation:500', text: 'Hello' });
      expect(result.isError).toBe(true);
      expect(result.text).toContain('read-only');
    } finally {
      await client.close();
      await serverConnected;
    }
  });
});
