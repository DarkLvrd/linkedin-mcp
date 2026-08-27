import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createAgenticLinkedinServer } from '../src/server.js';
import { FakeTransport } from '../src/transport/fake.js';
import type { SessionStatus } from '../src/transport/types.js';

async function startServer(readOnly = false) {
  const server = createAgenticLinkedinServer(
    new FakeTransport({ state: 'healthy' }),
    { readOnly },
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  // The server must be listening before the client handshake can complete.
  // server.connect resolves only when the transport closes; run it alongside.
  const serverConnected = server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, serverConnected };
}

async function stopServer(client: Client, serverConnected: Promise<void>) {
  await client.close();
  await serverConnected;
}

async function callSessionStatus(client: Client): Promise<SessionStatus> {
  const result = await client.callTool({ name: 'session_status', arguments: {} });
  const text = result.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return JSON.parse(text) as SessionStatus;
}

describe('MCP server (agentic-linkedin)', () => {
  it('starts and registers the session_status tool', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((t) => t.name)).toContain('session_status');
    } finally {
      await stopServer(client, serverConnected);
    }
  });

  it('session_status returns the transport state', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const status = await callSessionStatus(client);
      expect(status).toEqual({ state: 'healthy', readOnly: false });
    } finally {
      await stopServer(client, serverConnected);
    }
  });

  it('session_status reports read-only when configured', async () => {
    const { client, serverConnected } = await startServer(true);
    try {
      const status = await callSessionStatus(client);
      expect(status.readOnly).toBe(true);
    } finally {
      await stopServer(client, serverConnected);
    }
  });
});
