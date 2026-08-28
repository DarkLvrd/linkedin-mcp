import { describe, expect, it } from 'vitest';
import { diagnose, applyCandidates } from '../src/artifacts/heal.js';
import { createRegistry } from '../src/registry/registry.js';
import { FakeDom } from './fixtures/dom.js';
import type { FailureArtifact } from '../src/artifacts/types.js';

function registryArtifact(overrides: Partial<FailureArtifact> = {}): FailureArtifact {
  return {
    id: 'a1',
    at: '2026-08-24T12:00:00.000Z',
    kind: 'registry-lookup',
    selectorId: 'feed.startPostButton',
    failedKinds: ['aria-label', 'role'],
    failedValues: ['Start a post', 'button'],
    redacted: true,
    ...overrides,
  };
}

describe('diagnose', () => {
  it('re-expresses failed strategies under other kinds', () => {
    const candidates = diagnose(registryArtifact());
    expect(candidates).toContainEqual({
      selectorId: 'feed.startPostButton',
      kind: 'css',
      value: '[aria-label="Start a post"]',
      provable: false,
    });
    expect(candidates).toContainEqual({ selectorId: 'feed.startPostButton', kind: 'text', value: 'Start a post', provable: false });
    expect(candidates).toContainEqual({ selectorId: 'feed.startPostButton', kind: 'css', value: '[role="button"]', provable: false });
  });

  it('marks candidates provable only when the DOM dump proves them', () => {
    const withoutDump = diagnose(registryArtifact());
    expect(withoutDump.every((c) => c.provable === false)).toBe(true);

    const withDump = diagnose(
      registryArtifact({ domDump: '<div role="button" aria-label="Start a post">Start a post</div>' }),
    );
    const cssCandidate = withDump.find((c) => c.kind === 'css' && c.value === '[aria-label="Start a post"]');
    const textCandidate = withDump.find((c) => c.kind === 'text');
    expect(cssCandidate?.provable).toBe(true);
    expect(textCandidate?.provable).toBe(true);
  });
});

describe('applyCandidates', () => {
  it('auto-applies provable candidates to the overlay and pauses ambiguous ones', () => {
    const registry = createRegistry({
      shipped: [{ id: 'feed.startPostButton', strategies: [{ kind: 'aria-label', value: 'Start a post' }] }],
    });
    const candidates = diagnose(
      registryArtifact({
        domDump: '<div role="button">Start a post</div>',
        failedKinds: ['aria-label'],
        failedValues: ['Start a post'],
      }),
    );
    const { applied, pending } = applyCandidates(registry, candidates);
    // The text candidate is proven by the dump; the css re-expression is not.
    expect(applied.some((c) => c.kind === 'text')).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
    // The healed text strategy now resolves where the aria-label one fails.
    const resolved = registry.resolve('feed.startPostButton', new FakeDom(['text="Start a post"']));
    expect(resolved).toEqual({ kind: 'text', value: 'Start a post' });
  });

  it('heals with a text candidate when the dump proves the visible text', () => {
    const registry = createRegistry();
    const candidates = diagnose(registryArtifact({ domDump: '<div>Start a post</div>' }));
    const { applied, pending } = applyCandidates(registry, candidates);
    expect(applied.some((c) => c.kind === 'text')).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
  });
});
