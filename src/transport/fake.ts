import type { LinkedInTransport, SessionStatus } from './types.js';

export interface FakeTransportOptions {
  state: SessionStatus['state'];
  reason?: SessionStatus['reason'];
  readOnly?: boolean;
}

/**
 * In-memory transport for tests and offline development.
 * Implements the full LinkedInTransport contract; nothing about a real
 * LinkedIn session leaks into it.
 */
export class FakeTransport implements LinkedInTransport {
  private readonly status: SessionStatus;

  constructor(options: FakeTransportOptions) {
    this.status = {
      state: options.state,
      ...(options.reason !== undefined ? { reason: options.reason } : {}),
      readOnly: options.readOnly ?? false,
    };
  }

  getSessionStatus(): Promise<SessionStatus> {
    return Promise.resolve(this.status);
  }
}
