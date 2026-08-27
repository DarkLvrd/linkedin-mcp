import { describe, expect, it } from 'vitest';
import { SessionManagerImpl } from '../src/session/manager.js';
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
  constructor(private readonly result: SessionCookies | null, private readonly error?: string) {}
  async loginAndCollectCookies(): Promise<SessionCookies | null> {
    if (this.error !== undefined) {
      throw new Error(this.error);
    }
    return this.result;
  }
  async close(): Promise<void> {}
}

class FakeProbe implements HealthProbe {
  constructor(private readonly health: 'healthy' | 'unhealthy', private readonly reason?: string) {}
  async probe(): Promise<{ health: 'healthy' | 'unhealthy'; reason?: string }> {
    return { health: this.health, ...(this.reason !== undefined ? { reason: this.reason } : {}) };
  }
}

describe('SessionManagerImpl', () => {
  it('reports no-session before any login or restore', async () => {
    const manager = new SessionManagerImpl({
      browser: new FakeBrowser(null),
      store: new FakeStore(),
      probe: new FakeProbe('healthy'),
    });
    expect(await manager.getSessionStatus()).toEqual({ state: 'no-session' });
  });

  it('persists cookies after a successful login and reports healthy', async () => {
    const store = new FakeStore();
    const manager = new SessionManagerImpl({
      browser: new FakeBrowser(cookies),
      store,
      probe: new FakeProbe('healthy'),
    });
    expect(await manager.login()).toEqual({ ok: true });
    expect(store.saved).toEqual(cookies);
    expect(await manager.getSessionStatus()).toEqual({ state: 'healthy' });
  });

  it('returns a clear error when the browser fails instead of crashing', async () => {
    const manager = new SessionManagerImpl({
      browser: new FakeBrowser(null, 'browser exploded'),
      store: new FakeStore(),
      probe: new FakeProbe('healthy'),
    });
    const result = await manager.login();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('browser exploded');
    }
  });

  it('reports unhealthy with the probe reason when the session is challenged', async () => {
    const store = new FakeStore();
    store.save(cookies);
    const manager = new SessionManagerImpl({
      browser: new FakeBrowser(null),
      store,
      probe: new FakeProbe('unhealthy', 'authwall'),
    });
    manager.restore();
    expect(await manager.getSessionStatus()).toEqual({ state: 'unhealthy', reason: 'authwall' });
  });

  it('restores a saved session without a new sign-in', async () => {
    const store = new FakeStore();
    store.save(cookies);
    const manager = new SessionManagerImpl({
      browser: new FakeBrowser(null),
      store,
      probe: new FakeProbe('healthy'),
    });
    manager.restore();
    expect(await manager.getSessionStatus()).toEqual({ state: 'healthy' });
  });

  it('clear drops the session back to no-session', async () => {
    const store = new FakeStore();
    store.save(cookies);
    const manager = new SessionManagerImpl({
      browser: new FakeBrowser(null),
      store,
      probe: new FakeProbe('healthy'),
    });
    manager.restore();
    manager.clear();
    expect(await manager.getSessionStatus()).toEqual({ state: 'no-session' });
  });
});
