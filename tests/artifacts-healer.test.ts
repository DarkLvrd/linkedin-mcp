import { describe, expect, it } from 'vitest';
import { Healer } from '../src/artifacts/healer.js';
import { InMemoryArtifactStore } from '../src/artifacts/store.js';
import { createRegistry } from '../src/registry/registry.js';
import { LinkedInHttpClient } from '../src/voyager/client.js';
import type { SessionCookies } from '../src/session/types.js';

const cookies: SessionCookies = {
  li_at: 'AQED-x',
  jsessionid: 'ajax:1',
  csrfToken: 'ajax:1',
  obtainedAt: '2026-08-24T12:00:00.000Z',
};

describe('Healer (capture → diagnose → apply)', () => {
  it('captures a registry-lookup failure and auto-applies provable candidates', () => {
    const store = new InMemoryArtifactStore();
    const registry = createRegistry({
      shipped: [{ id: 'custom.button', strategies: [{ kind: 'aria-label', value: 'Click' }] }],
    });
    const healer = new Healer({ store, registry });
    const outcome = healer.capture({
      kind: 'registry-lookup',
      selectorId: 'custom.button',
      failedKinds: ['aria-label'],
      failedValues: ['Click'],
      domDump: '<button>Click</button>',
    });
    expect(outcome.artifact.redacted).toBe(true);
    expect(outcome.applied.length).toBeGreaterThan(0);
    expect(outcome.pending.length).toBeGreaterThan(0);
    expect(store.list()).toHaveLength(1);
  });

  it('keeps everything pending for review when nothing is provable', () => {
    const store = new InMemoryArtifactStore();
    const registry = createRegistry();
    const healer = new Healer({ store, registry });
    const outcome = healer.capture({
      kind: 'registry-lookup',
      selectorId: 'feed.startPostButton',
      failedKinds: ['aria-label'],
      failedValues: ['Start a post'],
    });
    expect(outcome.applied).toEqual([]);
    expect(outcome.pending.length).toBeGreaterThan(0);
  });
});

describe('capture wiring', () => {
  it('the HTTP client reports failures through the onFailure hook', async () => {
    const failures: unknown[] = [];
    const failingFetch: typeof fetch = async () => {
      throw new Error('connection refused');
    };
    const client = new LinkedInHttpClient({
      cookies,
      baseUrl: 'https://www.linkedin.com',
      fetchFn: failingFetch,
      onFailure: (input) => failures.push(input),
    });
    await expect(client.getMe()).rejects.toThrow();
    expect(failures).toHaveLength(1);
    const failure = failures[0] as { kind: string; request: { status: number; error: string } };
    expect(failure.kind).toBe('http');
    expect(failure.request.status).toBe(0);
    expect(failure.request.error).toContain('connection refused');
  });

  it('the HTTP client reports HTTP error responses through the hook', async () => {
    const failures: unknown[] = [];
    const errorFetch: typeof fetch = async () => new Response('nope', { status: 500 });
    const client = new LinkedInHttpClient({
      cookies,
      baseUrl: 'https://www.linkedin.com',
      fetchFn: errorFetch,
      onFailure: (input) => failures.push(input),
    });
    await expect(client.getMe()).rejects.toThrow();
    const failure = failures[0] as { request: { method: string; path: string; status: number } };
    expect(failure.request.status).toBe(500);
    expect(failure.request.path).toContain('/voyager/api/me');
  });
});
