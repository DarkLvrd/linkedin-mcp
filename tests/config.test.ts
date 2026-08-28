import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config.js';

describe('readConfig', () => {
  it('defaults read-only off and pacing to the conservative defaults', () => {
    const config = readConfig({});
    expect(config.readOnly).toBe(false);
    expect(config.pacing.perSignInBrowserWrites).toBe(3);
    expect(config.pacing.perHourWrites).toBe(60);
    expect(config.pacing.minDelayMs).toBe(1000);
    expect(config.pacing.maxDelayMs).toBe(5000);
    expect(config.pacing.probeIntervalMs).toBe(60000);
  });

  it('honors LINKEDIN_READ_ONLY for every truthy spelling', () => {
    expect(readConfig({ LINKEDIN_READ_ONLY: '1' }).readOnly).toBe(true);
    expect(readConfig({ LINKEDIN_READ_ONLY: 'true' }).readOnly).toBe(true);
    expect(readConfig({ LINKEDIN_READ_ONLY: '0' }).readOnly).toBe(false);
  });

  it('parses the pacing budget overrides from the environment', () => {
    const config = readConfig({
      AGENTIC_LINKEDIN_BUDGET_PER_SIGNIN: '2',
      AGENTIC_LINKEDIN_BUDGET_PER_HOUR: '40',
      AGENTIC_LINKEDIN_PACING_MIN_MS: '200',
      AGENTIC_LINKEDIN_PACING_MAX_MS: '1500',
      AGENTIC_LINKEDIN_PROBE_INTERVAL_MS: '30000',
    });
    expect(config.pacing.perSignInBrowserWrites).toBe(2);
    expect(config.pacing.perHourWrites).toBe(40);
    expect(config.pacing.minDelayMs).toBe(200);
    expect(config.pacing.maxDelayMs).toBe(1500);
    expect(config.pacing.probeIntervalMs).toBe(30000);
  });

  it('ignores malformed numeric overrides instead of crashing', () => {
    const config = readConfig({ AGENTIC_LINKEDIN_BUDGET_PER_HOUR: 'not-a-number' });
    expect(config.pacing.perHourWrites).toBe(60);
  });

  it('keeps every path configurable', () => {
    const config = readConfig({
      AGENTIC_LINKEDIN_SESSION_PATH: '/x/session.json',
      AGENTIC_LINKEDIN_DEDUPE_PATH: '/x/posts.json',
      AGENTIC_LINKEDIN_ARTIFACTS_PATH: '/x/artifacts',
      AGENTIC_LINKEDIN_OVERLAY_PATH: '/x/overlay.json',
      AGENTIC_LINKEDIN_VOICE_PATH: '/x/voice',
    });
    expect(config.sessionPath).toBe('/x/session.json');
    expect(config.dedupePath).toBe('/x/posts.json');
    expect(config.artifactsPath).toBe('/x/artifacts');
    expect(config.overlayPath).toBe('/x/overlay.json');
    expect(config.voicePath).toBe('/x/voice');
  });
});
