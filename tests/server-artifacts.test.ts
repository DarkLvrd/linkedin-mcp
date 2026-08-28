import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createAgenticLinkedinServer } from '../src/server.js';
import { Healer } from '../src/artifacts/healer.js';
import { InMemoryArtifactStore } from '../src/artifacts/store.js';
import { createRegistry } from '../src/registry/registry.js';
import { FakeTransport } from '../src/transport/fake.js';
import { FakeDom } from './fixtures/dom.js';

async function startServer() {
  const artifacts = new InMemoryArtifactStore();
  const registry = createRegistry({
    shipped: [{ id: 'custom.button', strategies: [{ kind: 'aria-label', value: 'Click' }] }],
  });
  const healer = new Healer({ store: artifacts, registry });
  const server = createAgenticLinkedinServer(new FakeTransport({ state: 'healthy' }), {
    readOnly: false,
    registry,
    artifacts,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const serverConnected = server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, serverConnected, healer, registry };
}

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return { text, isError: result.isError === true };
}

describe('self-healing tools (server)', () => {
  it('registers show_artifact and update_registry', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const names = (await client.listTools()).tools.map((t) => t.name);
      for (const expected of ['show_artifact', 'update_registry']) {
        expect(names).toContain(expected);
      }
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('show_artifact returns a captured artifact; unknown ids error', async () => {
    const { client, serverConnected, healer } = await startServer();
    try {
      const outcome = healer.capture({
        kind: 'registry-lookup',
        selectorId: 'custom.button',
        failedKinds: ['aria-label'],
        failedValues: ['Click'],
      });
      const shown = await callTool(client, 'show_artifact', { id: outcome.artifact.id });
      expect(JSON.parse(shown.text).redacted).toBe(true);
      const missing = await callTool(client, 'show_artifact', { id: 'nope' });
      expect(missing.isError).toBe(true);
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('update_registry applies a reviewed entry to the overlay', async () => {
    const { client, serverConnected, registry } = await startServer();
    try {
      const result = await callTool(client, 'update_registry', {
        selectorId: 'custom.button',
        strategies: [{ kind: 'css', value: 'button.clicker' }],
      });
      expect(JSON.parse(result.text)).toEqual({ ok: true });
      // The overlay change is live: the registry now resolves via the new css.
      const resolved = registry.resolve('custom.button', new FakeDom(['button.clicker']));
      expect(resolved).toEqual({ kind: 'css', value: 'button.clicker' });
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('update_registry accepts only valid strategy kinds', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const result = await client.callTool({
        name: 'update_registry',
        arguments: { selectorId: 'custom.button', strategies: [{ kind: 'magic', value: 'x' }] },
      });
      expect(result.isError).toBe(true);
    } finally {
      await client.close();
      await serverConnected;
    }
  });
});
