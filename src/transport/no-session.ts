import type { LinkedInTransport, SessionStatus } from './types.js';

/**
 * Honest placeholder used by the binary until the auth bootstrap (ticket 09)
 * supplies a real session source: reports no-session, never pretends health.
 */
export class NoSessionTransport implements LinkedInTransport {
  getSessionStatus(): Promise<SessionStatus> {
    return Promise.resolve({ state: 'no-session', readOnly: false });
  }
}
