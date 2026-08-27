import { describe, expect, it } from 'vitest';
import { PacedTransport } from '../src/engine/paced.js';
import {
  PacingHoldError,
  ReadOnlyError,
  WriteBudgetExhaustedError,
  type PacingConfig,
} from '../src/engine/types.js';
import { SessionRequiredError } from '../src/transport/types.js';
import { FakeTransport } from '../src/transport/fake.js';
import type { SessionCookies } from '../src/session/types.js';

const cookies: SessionCookies = { li_at: 'AQED-1', obtainedAt: '2026-08-24T12:00:00.000Z' };
const cookiesAfterReauth: SessionCookies = { li_at: 'AQED-2', obtainedAt: '2026-08-24T13:00:00.000Z' };

function makeSession(provider: () => SessionCookies | null) {
  return { getCookies: provider };
}

function makeEngine(options: {
  session: { getCookies: () => SessionCookies | null };
  inner?: FakeTransport;
  config?: Partial<PacingConfig>;
  readOnly?: boolean;
  writeLog?: string[];
  delayLog?: number[];
}) {
  const inner =
    options.inner ??
    new FakeTransport({ state: 'healthy', reads: { posts: [{ id: 'p1', authorUrn: 'a', text: 'x', publishedAt: 't' }] } });
  const engine = new PacedTransport({
    inner,
    session: options.session,
    config: {
      perSignInBrowserWrites: 3,
      perHourWrites: 60,
      minDelayMs: 100,
      maxDelayMs: 500,
      probeIntervalMs: 60_000,
      ...options.config,
    },
    readOnly: options.readOnly ?? false,
    browserWriteMethods: new Set(['update_profile']),
    now: () => 1_000_000,
    delay: async (ms) => options.delayLog?.push(ms),
  });
  return { engine, inner };
}

describe('PacedTransport', () => {
  it('passes reads straight through', async () => {
    const { engine } = makeEngine({ session: makeSession(() => cookies) });
    expect(await engine.getPosts(10)).toEqual([{ id: 'p1', authorUrn: 'a', text: 'x', publishedAt: 't' }]);
  });

  it('blocks writes without a session', async () => {
    const { engine } = makeEngine({ session: makeSession(() => null) });
    await expect(engine.updateProfile({ headline: 'H' })).rejects.toThrow(SessionRequiredError);
  });

  it('enforces the per-sign-in browser write budget and resumes after re-auth', async () => {
    let current = cookies;
    const session = makeSession(() => current);
    const { engine } = makeEngine({ session, config: { perSignInBrowserWrites: 1 } });

    await engine.updateProfile({ headline: 'first' });
    // Budget exhausted — the second write of this sign-in is refused.
    await expect(engine.updateProfile({ headline: 'second' })).rejects.toThrow(WriteBudgetExhaustedError);
    // The user re-authenticates; a fresh sign-in resets the budget.
    current = cookiesAfterReauth;
    await expect(engine.updateProfile({ headline: 'third' })).resolves.toBeDefined();
  });

  it('enforces the hourly write ceiling with a sliding window', async () => {
    const { engine } = makeEngine({ session: makeSession(() => cookies), config: { perHourWrites: 2 } });
    await engine.updateProfile({ headline: '1' });
    await engine.updateProfile({ headline: '2' });
    await expect(engine.updateProfile({ headline: '3' })).rejects.toThrow(WriteBudgetExhaustedError);
  });

  it('paces every write with a randomized delay inside the configured range', async () => {
    const delayLog: number[] = [];
    const { engine } = makeEngine({
      session: makeSession(() => cookies),
      config: { minDelayMs: 100, maxDelayMs: 500 },
      delayLog,
    });
    await engine.updateProfile({ headline: 'paced' });
    expect(delayLog).toHaveLength(1);
    expect(delayLog[0]).toBeGreaterThanOrEqual(100);
    expect(delayLog[0]).toBeLessThanOrEqual(500);
  });

  it('pauses writes when the health probe fails', async () => {
    const inner = new FakeTransport({ state: 'unhealthy', reason: 'authwall' });
    const { engine } = makeEngine({
      session: makeSession(() => cookies),
      inner,
      config: { probeIntervalMs: 0 },
    });
    await expect(engine.updateProfile({ headline: 'H' })).rejects.toThrow(PacingHoldError);
  });

  it('blocks every write in read-only mode while reads keep working', async () => {
    const { engine } = makeEngine({ session: makeSession(() => cookies), readOnly: true });
    await expect(engine.updateProfile({ headline: 'H' })).rejects.toThrow(ReadOnlyError);
    expect(await engine.getMe()).toBeDefined();
  });
});
