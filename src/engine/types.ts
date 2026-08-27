/** The session/pacing engine (ticket 12): keeps the server under LinkedIn's limits. */

export interface PacingConfig {
  /** Browser-context writes allowed per sign-in (the authwall threshold). */
  perSignInBrowserWrites: number;
  /** Total writes allowed in any sliding hour (LinkedIn's server-side ceiling). */
  perHourWrites: number;
  /** Human-like pacing: delay before each write, randomized in this range. */
  minDelayMs: number;
  maxDelayMs: number;
  /** How often the session health probe may run (per write batch). */
  probeIntervalMs: number;
}

export const DEFAULT_PACING: PacingConfig = {
  perSignInBrowserWrites: 3,
  perHourWrites: 60,
  minDelayMs: 1_000,
  maxDelayMs: 5_000,
  probeIntervalMs: 60_000,
};

/** The per-sign-in or hourly budget is spent; pause until re-auth or the hour turns. */
export class WriteBudgetExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WriteBudgetExhaustedError';
  }
}

/** The health probe failed; writes pause until the session recovers. */
export class PacingHoldError extends Error {
  constructor(reason: string) {
    super(`writes paused: ${reason} — re-authenticate and retry`);
    this.name = 'PacingHoldError';
  }
}

/** Read-only mode: every write is refused outright. */
export class ReadOnlyError extends Error {
  constructor() {
    super('read-only mode: writes are blocked');
    this.name = 'ReadOnlyError';
  }
}
