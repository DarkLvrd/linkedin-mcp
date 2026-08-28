import { applyCandidates, diagnose, type SelectorCandidate } from './heal.js';
import type { ArtifactInput, ArtifactStore, FailureArtifact } from './types.js';
import type { Registry } from '../registry/types.js';

export interface HealerDeps {
  store: ArtifactStore;
  registry: Registry;
}

export interface HealOutcome {
  artifact: FailureArtifact;
  applied: SelectorCandidate[];
  pending: SelectorCandidate[];
}

/**
 * The repair loop (ticket 17): capture a failure artifact, diagnose candidate
 * selectors from it, and apply the provably-safe ones to the registry overlay
 * immediately. Ambiguous candidates wait for review via update_registry.
 */
export class Healer {
  constructor(private readonly deps: HealerDeps) {}

  capture(input: ArtifactInput): HealOutcome {
    const artifact = this.deps.store.save(input);
    const candidates = diagnose(artifact);
    const { applied, pending } = applyCandidates(this.deps.registry, candidates);
    return { artifact, applied, pending };
  }
}
