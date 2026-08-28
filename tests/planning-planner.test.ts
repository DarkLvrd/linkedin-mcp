import { describe, expect, it } from 'vitest';
import { Planner } from '../src/planning/planner.js';
import { FakeTransport } from '../src/transport/fake.js';

function makePlanner(calls: { tool: string; args: Record<string, unknown> }[]) {
  const planner = new Planner({
    transport: new FakeTransport({ state: 'healthy' }),
    execute: async (tool, args) => {
      calls.push({ tool, args });
      return { ok: true };
    },
  });
  return planner;
}

describe('Planner (plan-then-execute)', () => {
  it('plan builds an ordered list with previews and executes nothing', async () => {
    const calls: { tool: string; args: Record<string, unknown> }[] = [];
    const planner = makePlanner(calls);
    const plan = await planner.plan([
      { tool: 'update_profile', args: { headline: 'New headline' } },
      { tool: 'create_post', args: { text: 'Hello LinkedIn!' } },
    ]);
    expect(plan.status).toBe('pending');
    expect(plan.actions).toHaveLength(2);
    expect(plan.actions[0].preview.kind).toBe('profile-diff');
    expect(plan.actions[1].preview.kind).toBe('rendered');
    expect(calls).toEqual([]);
  });

  it('approve executes the actions in order and marks the plan executed', async () => {
    const calls: { tool: string; args: Record<string, unknown> }[] = [];
    const planner = makePlanner(calls);
    const plan = await planner.plan([
      { tool: 'add_skill', args: { name: 'TypeScript' } },
      { tool: 'add_skill', args: { name: 'PHP' } },
    ]);
    const outcome = await planner.approve(plan.id);
    expect(outcome.results).toEqual([{ ok: true }, { ok: true }]);
    expect(calls.map((c) => c.tool)).toEqual(['add_skill', 'add_skill']);
    expect(planner.get(plan.id)?.status).toBe('executed');
  });

  it('reject marks the plan rejected and nothing executes', async () => {
    const calls: { tool: string; args: Record<string, unknown> }[] = [];
    const planner = makePlanner(calls);
    const plan = await planner.plan([{ tool: 'add_skill', args: { name: 'TypeScript' } }]);
    planner.reject(plan.id);
    expect(planner.get(plan.id)?.status).toBe('rejected');
    await expect(planner.approve(plan.id)).rejects.toThrow(/not pending/);
    expect(calls).toEqual([]);
  });

  it('approve on an unknown plan id fails', async () => {
    const planner = makePlanner([]);
    await expect(planner.approve('nope')).rejects.toThrow(/unknown plan/);
  });

  it('dry_run returns the plan without storing it — nothing can approve it', async () => {
    const calls: { tool: string; args: Record<string, unknown> }[] = [];
    const planner = makePlanner(calls);
    const plan = await planner.dryRun([{ tool: 'add_skill', args: { name: 'TypeScript' } }]);
    expect(plan.actions).toHaveLength(1);
    expect(planner.get(plan.id)).toBeUndefined();
    await expect(planner.approve(plan.id)).rejects.toThrow(/unknown plan/);
    expect(calls).toEqual([]);
  });
});
