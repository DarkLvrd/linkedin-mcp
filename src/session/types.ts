/**
 * Session domain (ticket 09). Cookie values live in exactly one place — the
 * session store on disk — and never appear in logs, tool output, or artifacts.
 */

export interface SessionCookies {
  li_at: string;
  jsessionid?: string;
  csrfToken?: string;
  obtainedAt: string;
}

export interface SessionStore {
  load(): SessionCookies | null;
  save(cookies: SessionCookies): void;
  clear(): void;
}

/** The login window a browser session opens for the user. */
export interface BrowserSession {
  /** Open LinkedIn's login page and wait until the user finishes and closes the window. */
  loginAndCollectCookies(timeoutMs: number): Promise<SessionCookies | null>;
  close(): Promise<void>;
}

export type Health = 'healthy' | 'unhealthy' | 'no-session';

export interface HealthProbe {
  /** Interpret 401, 403-CSRF, and redirect-to-self as unhealthy. Never throws. */
  probe(cookies: SessionCookies): Promise<{ health: Health; reason?: string }>;
}

export interface SessionManager {
  /** Open the browser window for a one-time sign-in; persist cookies on success. */
  login(): Promise<{ ok: true } | { ok: false; error: string }>;
  /** Load a previously saved session (no-op when none exists). */
  restore(): void;
  getSessionStatus(): Promise<{ state: 'healthy' | 'unhealthy' | 'no-session'; reason?: string }>;
  clear(): void;
}
