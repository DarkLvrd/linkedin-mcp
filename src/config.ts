import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_PACING, type PacingConfig } from './engine/types.js';

/**
 * The single place configuration comes from: environment variables, with
 * conservative defaults. Identity comes from the environment too — never
 * from the repo or artifacts.
 */
export interface AppConfig {
  readOnly: boolean;
  pacing: PacingConfig;
  sessionPath: string;
  dedupePath: string;
  artifactsPath: string;
  overlayPath: string;
  voicePath: string;
}

function intFromEnv(env: Record<string, string | undefined>, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readConfig(env: Record<string, string | undefined>): AppConfig {
  const home = join(homedir(), '.agentic-linkedin');
  return {
    readOnly: env.LINKEDIN_READ_ONLY === '1' || env.LINKEDIN_READ_ONLY === 'true',
    pacing: {
      perSignInBrowserWrites: intFromEnv(env, 'AGENTIC_LINKEDIN_BUDGET_PER_SIGNIN', DEFAULT_PACING.perSignInBrowserWrites),
      perHourWrites: intFromEnv(env, 'AGENTIC_LINKEDIN_BUDGET_PER_HOUR', DEFAULT_PACING.perHourWrites),
      minDelayMs: intFromEnv(env, 'AGENTIC_LINKEDIN_PACING_MIN_MS', DEFAULT_PACING.minDelayMs),
      maxDelayMs: intFromEnv(env, 'AGENTIC_LINKEDIN_PACING_MAX_MS', DEFAULT_PACING.maxDelayMs),
      probeIntervalMs: intFromEnv(env, 'AGENTIC_LINKEDIN_PROBE_INTERVAL_MS', DEFAULT_PACING.probeIntervalMs),
    },
    sessionPath: env.AGENTIC_LINKEDIN_SESSION_PATH ?? join(home, 'session.json'),
    dedupePath: env.AGENTIC_LINKEDIN_DEDUPE_PATH ?? join(home, 'posts.json'),
    artifactsPath: env.AGENTIC_LINKEDIN_ARTIFACTS_PATH ?? join(home, 'artifacts'),
    overlayPath: env.AGENTIC_LINKEDIN_OVERLAY_PATH ?? join(home, 'overlay.json'),
    voicePath: env.AGENTIC_LINKEDIN_VOICE_PATH ?? join(home, 'voice'),
  };
}
