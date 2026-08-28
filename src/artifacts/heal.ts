import type { Registry, StrategyKind } from '../registry/types.js';
import type { FailureArtifact } from './types.js';

export interface SelectorCandidate {
  selectorId: string;
  kind: StrategyKind;
  value: string;
  /** True when the DOM dump proves the query exists on the page. */
  provable: boolean;
}

/**
 * Re-expresses a failed strategy under the other lookup kinds: an aria-label
 * value becomes a structural attribute query and a visible-text query, and so
 * on. Provability is decided against the DOM dump when one was captured —
 * without a dump nothing can be proven, and everything waits for review.
 */
export function diagnose(artifact: FailureArtifact): SelectorCandidate[] {
  if (artifact.kind !== 'registry-lookup' || artifact.selectorId === undefined) {
    return [];
  }
  const kinds = artifact.failedKinds ?? [];
  const values = artifact.failedValues ?? [];
  const candidates: SelectorCandidate[] = [];
  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i];
    const value = values[i];
    if (value === undefined) {
      continue;
    }
    if (kind === 'aria-label' || kind === 'role' || kind === 'data-test') {
      candidates.push({ selectorId: artifact.selectorId, kind: 'css', value: `[${kind}="${value}"]`, provable: false });
      candidates.push({ selectorId: artifact.selectorId, kind: 'text', value, provable: false });
    } else if (kind === 'text') {
      candidates.push({ selectorId: artifact.selectorId, kind: 'css', value, provable: false });
    }
  }
  const dump = artifact.domDump;
  if (dump !== undefined) {
    for (const candidate of candidates) {
      candidate.provable = queryAppearsInDump(candidate, dump);
    }
  }
  return candidates;
}

function queryAppearsInDump(candidate: SelectorCandidate, dump: string): boolean {
  if (candidate.kind === 'text') {
    return dump.includes(candidate.value);
  }
  // A css candidate derived from an attribute value is proven when the dump
  // contains the real attribute pair (the dump holds HTML, not selectors).
  const attr = candidate.value.match(/^\[(aria-label|role|data-test)="([^"]+)"\]$/);
  if (attr !== null) {
    return dump.includes(`${attr[1]}="${attr[2]}"`);
  }
  return dump.includes(candidate.value);
}

/**
 * The self-healing policy: provably-safe candidates auto-apply to the
 * registry overlay (ADR-0002); ambiguous ones wait for review.
 */
export function applyCandidates(
  registry: Registry,
  candidates: SelectorCandidate[],
): { applied: SelectorCandidate[]; pending: SelectorCandidate[] } {
  const applied: SelectorCandidate[] = [];
  const pending: SelectorCandidate[] = [];
  for (const candidate of candidates) {
    if (candidate.provable) {
      registry.heal(candidate.selectorId, { kind: candidate.kind, value: candidate.value });
      applied.push(candidate);
    } else {
      pending.push(candidate);
    }
  }
  return { applied, pending };
}
