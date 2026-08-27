import type { LinkedInTransport, SessionStatus } from './types.js';
import type { SessionManager } from '../session/types.js';

/**
 * A transport whose session state comes from the SessionManager: no-session
 * before a sign-in, then probe-driven health. This is the spine the Voyager
 * and SDUI clients will hang off in later tickets.
 */
export class SessionTransport implements LinkedInTransport {
  constructor(private readonly manager: SessionManager) {}

  async getSessionStatus(): Promise<SessionStatus> {
    const status = await this.manager.getSessionStatus();
    return { state: status.state, ...(status.reason !== undefined ? { reason: status.reason } : {}), readOnly: false };
  }
}
