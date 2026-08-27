import type { DomQuery } from '../../src/registry/types.js';

/**
 * Minimal DOM for registry tests: a query string either exists or it does not.
 * The browser transport will implement the same DomQuery contract against
 * Playwright later (ticket 17).
 */
export class FakeDom implements DomQuery {
  private readonly present: ReadonlySet<string>;

  constructor(present: Iterable<string>) {
    this.present = new Set(present);
  }

  find(query: string): string | null {
    return this.present.has(query) ? query : null;
  }
}
