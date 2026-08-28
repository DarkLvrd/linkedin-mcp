import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  STRATEGY_ORDER,
  type DomQuery,
  type Registry,
  type ResolvedSelector,
  type SelectorEntry,
  type SelectorStrategy,
  type StrategyKind,
  type Suggestion,
} from './types.js';

const SHIPPED_SELECTORS_URL = new URL('./selectors.json', import.meta.url);

function queryFor(strategy: SelectorStrategy): string {
  switch (strategy.kind) {
    case 'aria-label':
      return `[aria-label="${strategy.value}"]`;
    case 'role':
      return `[role="${strategy.value}"]`;
    case 'data-test':
      return `[data-test="${strategy.value}"]`;
    case 'text':
      // Convention for the DOM layer: Playwright maps this to getByText.
      return `text="${strategy.value}"`;
    case 'css':
      return strategy.value;
  }
}

/** Read the selectors shipped inside the package. */
export function loadShippedSelectors(): SelectorEntry[] {
  const raw = readFileSync(fileURLToPath(SHIPPED_SELECTORS_URL), 'utf8');
  const parsed = JSON.parse(raw) as { selectors: SelectorEntry[] };
  return parsed.selectors;
}

export interface RegistryOptions {
  /** Overlay file path; read on create and on every reload(). */
  overlayPath?: string;
  /** Override the shipped entries (used by tests that want a clean slate). */
  shipped?: SelectorEntry[];
  /** Called when a lookup fails and a suggestion is recorded (ticket 17). */
  onSuggestion?: (suggestion: Suggestion) => void;
}

export function createRegistry(options: RegistryOptions = {}): Registry {
  const shipped = new Map<string, SelectorEntry>();
  for (const entry of options.shipped ?? loadShippedSelectors()) {
    shipped.set(entry.id, entry);
  }

  const overlay = new Map<string, SelectorEntry>();
  const pending: Suggestion[] = [];

  function readOverlayFile(): void {
    if (options.overlayPath === undefined) {
      return;
    }
    let raw: string;
    try {
      raw = readFileSync(options.overlayPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // No overlay yet — that is the normal first-run state, not a crash.
        return;
      }
      throw error;
    }
    const parsed = JSON.parse(raw) as { selectors: SelectorEntry[] };
    for (const entry of parsed.selectors) {
      overlay.set(entry.id, entry);
    }
  }

  readOverlayFile();

  return {
    resolve(name, dom: DomQuery): ResolvedSelector | null {
      const entry = overlay.get(name) ?? shipped.get(name);
      if (entry === undefined) {
        // Unknown name is a programming error, not a LinkedIn breakage.
        return null;
      }
      const tried: StrategyKind[] = [];
      const triedValues: string[] = [];
      for (const kind of STRATEGY_ORDER) {
        const strategy = entry.strategies.find((s) => s.kind === kind);
        if (strategy === undefined) {
          continue;
        }
        const query = queryFor(strategy);
        if (dom.find(query) !== null) {
          return { kind, value: strategy.value };
        }
        tried.push(kind);
        triedValues.push(strategy.value);
      }
      pending.push({ selectorId: entry.id, failedKinds: tried, failedValues: triedValues, at: new Date().toISOString() });
      const suggestion = pending[pending.length - 1]!;
      options.onSuggestion?.(suggestion);
      return null;
    },

    reload() {
      readOverlayFile();
    },

    applyOverlay(entry: SelectorEntry) {
      overlay.set(entry.id, entry);
    },

    heal(selectorId: string, strategy: SelectorStrategy) {
      const existing = overlay.get(selectorId) ?? shipped.get(selectorId);
      if (existing === undefined) {
        overlay.set(selectorId, { id: selectorId, strategies: [strategy] });
        return;
      }
      overlay.set(selectorId, {
        ...existing,
        strategies: [strategy, ...existing.strategies.filter((s) => s.kind !== strategy.kind)],
      });
    },

    suggestions() {
      return [...pending];
    },
  };
}
