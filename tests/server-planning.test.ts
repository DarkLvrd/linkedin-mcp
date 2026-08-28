import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createAgenticLinkedinServer } from '../src/server.js';
import { FakeTransport } from '../src/transport/fake.js';

async function startServer(readOnly = false) {
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

describe('planning tools (server)', () => {
  it('registers plan, approve, reject, dry_run', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const names = (await client.listTools()).tools.map((t) => t.name);
      for (const expected of ['plan', 'approve', 'reject', 'dry_run']) {
        expect(names).toContain(expected);
      }
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('plan builds previews and executes nothing', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const result = await callTool(client, 'plan', {
        actions: [
          { tool: 'update_profile', args: { headline: 'New headline' } },
          { tool: 'create_post', args: { text: 'Hello LinkedIn!' } },
        ],
      });
      expect(result.isError).toBe(false);
      const plan = JSON.parse(result.text);
      expect(plan.status).toBe('pending');
      expect(plan.actions[0].preview.kind).toBe('profile-diff');
      expect(plan.actions[0].preview.diff.fields[0]).toEqual({ field: 'headline', old: 'Tester', new: 'New headline' });
      expect(plan.actions[1].preview.kind).toBe('rendered');
      expect(plan.actions[1].preview.rendered.author).toBe('Test User');
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('approve executes the plan in order; reject blocks execution', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const plan = JSON.parse((await callTool(client, 'plan', { actions: [{ tool: 'add_skill', args: { name: 'TypeScript' } }] })).text);
      const approved = JSON.parse((await callTool(client, 'approve', { planId: plan.id })).text);
      expect(approved.results).toEqual([{ skills: [{ name: 'TypeScript', urn: 'urn:li:fsd_profileSkill:fake' }] }]);

      const rejected = JSON.parse((await callTool(client, 'plan', { actions: [{ tool: 'add_skill', args: { name: 'PHP' } }] })).text);
      await callTool(client, 'reject', { planId: rejected.id });
      const reapprove = await callTool(client, 'approve', { planId: rejected.id });
      expect(reapprove.isError).toBe(true);
      expect(reapprove.text).toContain('not pending');
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('dry_run returns previews but nothing can be approved', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const dry = JSON.parse((await callTool(client, 'dry_run', { actions: [{ tool: 'add_skill', args: { name: 'TypeScript' } }] })).text);
      expect(dry.actions).toHaveLength(1);
      const approve = await callTool(client, 'approve', { planId: dry.id });
      expect(approve.isError).toBe(true);
      expect(approve.text).toContain('unknown plan');
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('rejects unknown tools and invalid args at plan time', async () => {
    const { client, serverConnected } = await startServer();
    try {
      const badTool = await callTool(client, 'plan', { actions: [{ tool: 'get_me', args: {} }] });
      expect(badTool.isError).toBe(true);
      const badArgs = await callTool(client, 'plan', { actions: [{ tool: 'create_post', args: {} }] });
      expect(badArgs.isError).toBe(true);
    } finally {
      await client.close();
      await serverConnected;
    }
  });

  it('approve is blocked in read-only mode', async () => {
    const { client, serverConnected } = await startServer(true);
    try {
      const plan = JSON.parse((await callTool(client, 'plan', { actions: [{ tool: 'add_skill', args: { name: 'TypeScript' } }] })).text);
      const approve = await callTool(client, 'approve', { planId: plan.id });
      expect(approve.isError).toBe(true);
      expect(approve.text).toContain('read-only');
    } finally {
      await client.close();
      await serverConnected;
    }
  });
});
