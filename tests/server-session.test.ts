import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createAgenticLinkedinServer } from '../src/server.js';
import { SessionManagerImpl } from '../src/session/manager.js';
import { LinkedInHttpClient } from '../src/voyager/client.js';
import { fixtureFetch } from './fixtures/fetch.js';
import type { BrowserSession, HealthProbe, SessionCookies, SessionStore } from '../src/session/types.js';

const cookies: SessionCookies = { li_at: 'AQED-x', obtainedAt: '2026-08-24T12:00:00.000Z' };

class FakeStore implements SessionStore {
  saved: SessionCookies | null = null;
  load(): SessionCookies | null {
    return this.saved;
  }
  save(c: SessionCookies): void {
    this.saved = c;
  }
  clear(): void {
    this.saved = null;
  }
}

class FakeBrowser implements BrowserSession {
  constructor(private readonly result: SessionCookies | null) {}
  async loginAndCollectCookies(): Promise<SessionCookies | null> {
    return this.result;
  }
  async close(): Promise<void> {}
}

class FakeProbe implements HealthProbe {
  async probe(): Promise<{ health: 'healthy' | 'unhealthy'; reason?: string }> {
    return { health: 'healthy' };
  }
}

function makeManager(store: SessionStore) {
  return new SessionManagerImpl({
    browser: new FakeBrowser(cookies),
    store,
    probe: new FakeProbe(),
  });
}

async function startServerWithSession(manager: SessionManagerImpl) {
  // The real wiring: the Voyager client consults the manager's cookies on
  // every request (so a login that happens later is picked up) and uses a
  // fixture fetch + fake probe, so nothing in this test touches the network.
  const transport = new LinkedInHttpClient({
    cookies: () => manager.getCookies(),
    fetchFn: fixtureFetch({}),
    probe: new FakeProbe(),
  });
  const server = createAgenticLinkedinServer(transport, {
    readOnly: false,
    session: manager,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const serverConnected = server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, serverConnected };
}

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  return result.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

describe('session wiring (login tool + Voyager transport)', () => {
  it('registers a login tool that signs in once and persists the session', async () => {
    const store = new FakeStore();
    const manager = makeManager(store);
    const { client, serverConnected } = await startServerWithSession(manager);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((t) => t.name)).toContain('login');

      const text = await callTool(client, 'login', {});
      expect(JSON.parse(text)).toEqual({ ok: true });
      expect(store.saved).toEqual(cookies);
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('session_status reports healthy through the Voyager transport after login', async () => {
    const store = new FakeStore();
    const manager = makeManager(store);
    const { client, serverConnected } = await startServerWithSession(manager);
    try {
      await callTool(client, 'login', {});
      const text = await callTool(client, 'session_status', {});
      expect(JSON.parse(text)).toEqual({ state: 'healthy', readOnly: false });
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('session_status reports no-session when nothing has been restored', async () => {
    const manager = makeManager(new FakeStore());
    const { client, serverConnected } = await startServerWithSession(manager);
    try {
      const text = await callTool(client, 'session_status', {});
      expect(JSON.parse(text)).toEqual({ state: 'no-session', readOnly: false });
    } finally {
      await client.close();
      await serverConnected;
    }
  });
});
