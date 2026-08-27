import { SessionRequiredError } from '../transport/types.js';
import type { GhostEntryRef, LinkedInTransport, ProfileUpdate } from '../transport/types.js';
import type { JobSearchFilters } from '../voyager/types.js';
import type { SessionCookies } from '../session/types.js';
import {
  DEFAULT_PACING,
  PacingHoldError,
  ReadOnlyError,
  WriteBudgetExhaustedError,
  type PacingConfig,
} from './types.js';

const HOUR_MS = 3_600_000;

export interface PacedTransportDeps {
  inner: LinkedInTransport;
  /** Supplies the current session; a new obtainedAt means a fresh sign-in. */
  session: { getCookies(): SessionCookies | null };
  config?: Partial<PacingConfig>;
  readOnly?: boolean;
  /** Method names whose writes count as browser-context (authwall budget). */
  browserWriteMethods?: ReadonlySet<string>;
  now?: () => number;
  delay?: (ms: number) => Promise<void>;
}

/**
 * The engine, as a decorator over the transport seam: every write passes the
 * read-only gate, the session check, the health probe, the hourly ceiling,
 * the per-sign-in browser budget, and a randomized human-like delay before it
 * reaches the inner transport. A spent budget or failed probe pauses writes;
 * re-authentication (a new session) resumes them. Reads pass through.
 */
export class PacedTransport implements LinkedInTransport {
  private readonly inner: LinkedInTransport;
  private readonly session: PacedTransportDeps['session'];
  private readonly config: PacingConfig;
  private readonly readOnly: boolean;
  private readonly browserWriteMethods: ReadonlySet<string>;
  private readonly now: () => number;
  private readonly delay: (ms: number) => Promise<void>;

  private writeTimes: number[] = [];
  private browserWritesThisSignIn = 0;
  private signInAt: string | null = null;
  private lastProbeAt = 0;

  constructor(deps: PacedTransportDeps) {
    this.inner = deps.inner;
    this.session = deps.session;
    this.config = { ...DEFAULT_PACING, ...deps.config };
    this.readOnly = deps.readOnly ?? false;
    this.browserWriteMethods = deps.browserWriteMethods ?? new Set();
    this.now = deps.now ?? Date.now;
    this.delay = deps.delay ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  private async guardWrite(method: string): Promise<void> {
    if (this.readOnly) {
      throw new ReadOnlyError();
    }
    const cookies = this.session.getCookies();
    if (cookies === null) {
      throw new SessionRequiredError();
    }
    // A fresh sign-in resets the per-sign-in browser budget.
    if (this.signInAt !== cookies.obtainedAt) {
      this.signInAt = cookies.obtainedAt;
      this.browserWritesThisSignIn = 0;
    }
    // Health probe (per write batch).
    const now = this.now();
    if (now - this.lastProbeAt > this.config.probeIntervalMs) {
      const status = await this.inner.getSessionStatus();
      if (status.state !== 'healthy') {
        throw new PacingHoldError(status.reason ?? status.state);
      }
      this.lastProbeAt = now;
    }
    // Hourly ceiling: sliding window.
    const cutoff = now - HOUR_MS;
    this.writeTimes = this.writeTimes.filter((t) => t > cutoff);
    if (this.writeTimes.length >= this.config.perHourWrites) {
      throw new WriteBudgetExhaustedError('hourly write ceiling reached — wait or re-authenticate');
    }
    // Per-sign-in browser budget.
    if (this.browserWriteMethods.has(method)) {
      if (this.browserWritesThisSignIn >= this.config.perSignInBrowserWrites) {
        throw new WriteBudgetExhaustedError(
          'per-sign-in write budget exhausted — re-authenticate to refresh the budget',
        );
      }
    }
    // Human-like pacing.
    const spread = this.config.maxDelayMs - this.config.minDelayMs;
    const delayMs = this.config.minDelayMs + Math.round(Math.random() * spread);
    await this.delay(delayMs);
  }

  private accountWrite(method: string): void {
    this.writeTimes.push(this.now());
    if (this.browserWriteMethods.has(method)) {
      this.browserWritesThisSignIn++;
    }
  }

  private wrapWrite<T>(method: string, run: () => Promise<T>): Promise<T> {
    return this.guardWrite(method).then(() => run().then((result) => (this.accountWrite(method), result)));
  }

  // ── Reads: straight through. ─────────────────────────────────────────────

  getSessionStatus() {
    return this.inner.getSessionStatus();
  }

  getMe() {
    return this.inner.getMe();
  }

  getProfile(identifier: string) {
    return this.inner.getProfile(identifier);
  }

  getPosts(limit: number) {
    return this.inner.getPosts(limit);
  }

  getConversations(limit: number) {
    return this.inner.getConversations(limit);
  }

  getConnectionsSummary() {
    return this.inner.getConnectionsSummary();
  }

  getJobs(filters: JobSearchFilters) {
    return this.inner.getJobs(filters);
  }

  getAnalytics() {
    return this.inner.getAnalytics();
  }

  // ── Writes: guarded, paced, accounted. ───────────────────────────────────

  updateProfile(changes: ProfileUpdate) {
    return this.wrapWrite('update_profile', () => this.inner.updateProfile(changes));
  }

  addSkill(name: string) {
    return this.wrapWrite('add_skill', () => this.inner.addSkill(name));
  }

  removeSkill(skillUrn: string) {
    return this.wrapWrite('remove_skill', () => this.inner.removeSkill(skillUrn));
  }

  reorderSkills(newOrder: string[]) {
    return this.wrapWrite('reorder_skills', () => this.inner.reorderSkills(newOrder));
  }

  deleteGhostEntry(ref: GhostEntryRef) {
    return this.wrapWrite('delete_ghost_entry', () => this.inner.deleteGhostEntry(ref));
  }
}
