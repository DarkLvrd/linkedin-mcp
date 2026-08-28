import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createAgenticLinkedinServer } from '../src/server.js';
import { InMemoryVoiceProfileStore } from '../src/voice/store.js';
import { FakeTransport } from '../src/transport/fake.js';

async function startServer() {
  const voice = new InMemoryVoiceProfileStore();
  const server = createAgenticLinkedinServer(new FakeTransport({ state: 'healthy' }), {
    readOnly: false,
    voice,
  });
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

describe('voice tools (server)', () => {
  it('registers get_voice_profile, set_voice_profile, bootstrap_voice_profile, audit_draft', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const names = (await client.listTools()).tools.map((t) => t.name);
      for (const expected of ['get_voice_profile', 'set_voice_profile', 'bootstrap_voice_profile', 'audit_draft']) {
        expect(names).toContain(expected);
      }
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('set then get round-trips a voice profile per user', async () => {
    const { client, serverConnected } = await startServer();
    try {
      await callTool(client, 'set_voice_profile', {
        userId: 'urn:li:member:42',
        tone: 'direct',
        emoji: 'sparing',
        sentenceLength: 'short',
      });
      const got = JSON.parse((await callTool(client, 'get_voice_profile', { userId: 'urn:li:member:42' })).text);
      expect(got.tone).toBe('direct');
      expect(got.emoji).toBe('sparing');
      const missing = await callTool(client, 'get_voice_profile', { userId: 'urn:li:member:7' });
      expect(missing.isError).toBe(true);
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('bootstraps a profile from sample posts', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const result = await callTool(client, 'bootstrap_voice_profile', {
        userId: 'urn:li:member:42',
        samples: ['Shipped it. Tests pass. On to the next thing.'],
      });
      const profile = JSON.parse(result.text);
      expect(profile.sentenceLength).toBe('short');
      expect(profile.notes).toContain('bootstrapped');
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('audit_draft scores machine-written text as machine', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const result = await callTool(client, 'audit_draft', {
        text: "In today's fast-paced world, let's dive in and unlock the secrets of success — it's no secret that we must elevate our game — the key to growth is harnessing transformative tools — when it comes to the future of work, absolutely! — I'd be happy to help.",
      });
      const audit = JSON.parse(result.text);
      expect(audit.score).toBe('machine');
      expect(audit.findings.length).toBeGreaterThanOrEqual(3);
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('the posting preview carries the draft audit', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const plan = JSON.parse(
        (await callTool(client, 'plan', { actions: [{ tool: 'create_post', args: { text: 'Hello LinkedIn!' } }] })).text,
      );
      expect(plan.actions[0].preview.audit.score).toBe('human');
      const machinePlan = JSON.parse(
        (
          await callTool(client, 'plan', {
            actions: [
              {
                tool: 'create_post',
                args: { text: "Let's dive in and unlock the secrets of success — it's no secret that we must elevate our game — the key to growth — absolutely!" },
              },
            ],
          })
        ).text,
      );
      expect(machinePlan.actions[0].preview.audit.score).toBe('machine');
    } finally {
      await client.close();
      await serverConnected;
    }
  });
});
