/**
 * The one seam of the server (spec: Testing Decisions).
 *
 * Every LinkedIn capability is reached through this interface. The domain
 * logic above it (pacing, dedupe, verification, planning) is tested against
 * FakeTransport; the real implementations (Voyager client, SDUI client,
 * browser fallback) plug in below it without touching that logic.
 */

export type SessionState = 'healthy' | 'unhealthy' | 'no-session';

export interface SessionStatus {
  state: SessionState;
  /** Present when the session is unhealthy — e.g. 'authwall', '401', '403-CSRF'. */
  reason?: string;
  readOnly: boolean;
}

export interface LinkedInTransport {
  /** Probe the current session. Never throws; reports health honestly. */
  getSessionStatus(): Promise<SessionStatus>;
}
