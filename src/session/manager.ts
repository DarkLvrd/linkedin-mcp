import type { BrowserSession, HealthProbe, SessionCookies, SessionManager, SessionStore } from './types.js';

/** How long the login window may stay open while the user signs in. */
export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export interface SessionManagerDeps {
  browser: BrowserSession;
  store: SessionStore;
  probe: HealthProbe;
}

/**
 * Owns the session lifecycle: one-time sign-in through the browser, cookie
 * persistence on disk, restore across restarts, and honest health reporting
 * through the probe. Cookie values never leave this module.
 */
export class SessionManagerImpl implements SessionManager {
  private cached: SessionCookies | null = null;

  constructor(private readonly deps: SessionManagerDeps) {}

  restore(): void {
    this.cached = this.deps.store.load();
  }

  async login(): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const cookies = await this.deps.browser.loginAndCollectCookies(LOGIN_TIMEOUT_MS);
      if (cookies === null) {
        return { ok: false, error: 'no session cookies collected' };
      }
      this.deps.store.save(cookies);
      this.cached = cookies;
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `login failed: ${message}` };
    }
  }

  async getSessionStatus(): Promise<{ state: 'healthy' | 'unhealthy' | 'no-session'; reason?: string }> {
    if (this.cached === null) {
      return { state: 'no-session' };
    }
    const result = await this.deps.probe.probe(this.cached);
    if (result.health === 'unhealthy') {
      return { state: 'unhealthy', ...(result.reason !== undefined ? { reason: result.reason } : {}) };
    }
    return { state: 'healthy' };
  }

  clear(): void {
    this.deps.store.clear();
    this.cached = null;
  }
}
