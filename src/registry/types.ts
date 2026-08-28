/**
 * The selector registry (ADR-0002): endpoints and selectors live as data,
 * never in code. The lookup order is fixed; the overlay lets fixes land
 * without a redeploy; failed lookups feed the self-healing loop.
 */

export type StrategyKind = 'aria-label' | 'role' | 'data-test' | 'text' | 'css';

/** The fixed multi-strategy lookup order (ADR-0002). */
export const STRATEGY_ORDER: readonly StrategyKind[] = ['aria-label', 'role', 'data-test', 'text', 'css'];

export interface SelectorStrategy {
  kind: StrategyKind;
  value: string;
}

export interface SelectorEntry {
  /** Stable logical name, e.g. 'feed.startPostButton'. */
  id: string;
  strategies: SelectorStrategy[];
}

/** The minimal DOM surface the registry resolves against. */
export interface DomQuery {
  /** Returns a handle when the query matches, null otherwise. */
  find(query: string): unknown | null;
}

export interface ResolvedSelector {
  kind: StrategyKind;
  value: string;
}

export interface Suggestion {
  selectorId: string;
  /** The strategy kinds that were tried and failed, in order. */
  failedKinds: StrategyKind[];
  /** The strategy values tried, parallel to failedKinds. */
  failedValues: string[];
  at: string;
}

export interface Registry {
  resolve(name: string, dom: DomQuery): ResolvedSelector | null;
  /** Re-read the overlay file so fixes land without a redeploy. */
  reload(): void;
  /** Apply an overlay entry programmatically (the `update registry` tool path). */
  applyOverlay(entry: SelectorEntry): void;
  /** Prepend a healed strategy to the overlay entry (the self-healing path). */
  heal(selectorId: string, strategy: SelectorStrategy): void;
  suggestions(): Suggestion[];
}
