import { randomUUID } from 'node:crypto';
import { buildPreview } from './preview.js';
import type { LinkedInTransport } from '../transport/types.js';
import type { Plan, PlannedAction } from './types.js';

export interface PlannerDeps {
  transport: LinkedInTransport;
  /** The write path: maps a tool name + args to the transport call. */
  execute: (tool: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Plan-then-execute (ticket 16): an agent run becomes an ordered plan with
 * per-action previews; nothing executes until the plan is approved. The
 * per-write gate is the executor itself — every executed action passes the
 * same read-only / pacing / budget guards as a direct tool call.
 */
export class Planner {
  private readonly plans = new Map<string, Plan>();
  private readonly deps: PlannerDeps;

  constructor(deps: PlannerDeps) {
    this.deps = deps;
  }

  private async buildActions(actions: { tool: string; args: Record<string, unknown> }[]): Promise<PlannedAction[]> {
    return Promise.all(
      actions.map(async (action) => ({
        tool: action.tool,
        args: action.args,
        preview: await buildPreview(this.deps.transport, action.tool, action.args),
      })),
    );
  }

  async plan(actions: { tool: string; args: Record<string, unknown> }[]): Promise<Plan> {
    const plan: Plan = {
      id: randomUUID(),
      status: 'pending',
      actions: await this.buildActions(actions),
      createdAt: new Date().toISOString(),
    };
    this.plans.set(plan.id, plan);
    return plan;
  }

  /** The dry run: previews only, nothing stored, nothing executable. */
  async dryRun(actions: { tool: string; args: Record<string, unknown> }[]): Promise<Plan> {
    return {
      id: randomUUID(),
      status: 'pending',
      actions: await this.buildActions(actions),
      createdAt: new Date().toISOString(),
    };
  }

  get(planId: string): Plan | undefined {
    return this.plans.get(planId);
  }

  async approve(planId: string): Promise<{ plan: Plan; results: unknown[] }> {
    const plan = this.plans.get(planId);
    if (plan === undefined) {
      throw new Error(`unknown plan ${planId}`);
    }
    if (plan.status !== 'pending') {
      throw new Error(`plan is ${plan.status}, not pending — nothing executed`);
    }
    plan.status = 'approved';
    const results: unknown[] = [];
    try {
      for (const action of plan.actions) {
        results.push(await this.deps.execute(action.tool, action.args));
      }
    } catch (error) {
      // The plan stays 'approved' with the partial results visible; the caller
      // sees exactly which actions landed.
      plan.status = 'executed';
      throw error;
    }
    plan.status = 'executed';
    return { plan, results };
  }

  reject(planId: string): void {
    const plan = this.plans.get(planId);
    if (plan === undefined) {
      throw new Error(`unknown plan ${planId}`);
    }
    if (plan.status !== 'pending') {
      throw new Error(`plan is ${plan.status}, not pending`);
    }
    plan.status = 'rejected';
  }
}
