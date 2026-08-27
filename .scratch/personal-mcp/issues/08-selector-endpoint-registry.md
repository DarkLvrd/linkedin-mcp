# 08 — Selector/endpoint registry

**What to build:** the registry as data (ADR-0002): shipped JSON for endpoints and selectors, a runtime overlay that hot-reloads without redeploy, multi-strategy lookup in the fixed order, and a suggestion store fed by failures.

**Blocked by:** 07 — Project scaffold + transport seam.

**Status:** resolved (2026-08-24)

- [x] Registry loads from shipped JSON; lookup tries strategies in order: aria-label → role → data-test → visible text → structural
- [x] An overlay file can add or override entries and is picked up on reload without a redeploy
- [x] A failed lookup records a suggestion entry referencing the failure
- [x] Lookup behavior is covered by tests using fixture DOM

## Answer

Implemented TDD (ADR-0002): `src/registry/types.ts` (StrategyKind, STRATEGY_ORDER, SelectorEntry, DomQuery, ResolvedSelector, Suggestion, Registry), `src/registry/selectors.json` (shipped seed: `feed.startPostButton` from the bridge patch evidence), `src/registry/registry.ts` (`createRegistry`: shipped load, overlay file with ENOENT-safe reload, applyOverlay, suggestion recording). Tests: 5 registry tests + FakeDom fixture (`tests/fixtures/dom.ts`); full suite 11/11 via `npm run check`. Review: 2 minor judgement calls (JSON-parse duplication; unused `shipped` option), 1 conscious deferral — endpoint entries wait for ticket 10 (first consumer); zero AC misses, zero creep. Test-driven fix: missing overlay file at startup now means "no overlay yet" instead of a crash.
