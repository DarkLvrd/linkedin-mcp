# 08 — Selector/endpoint registry

**What to build:** the registry as data (ADR-0002): shipped JSON for endpoints and selectors, a runtime overlay that hot-reloads without redeploy, multi-strategy lookup in the fixed order, and a suggestion store fed by failures.

**Blocked by:** 07 — Project scaffold + transport seam.

**Status:** ready-for-agent

- [ ] Registry loads from shipped JSON; lookup tries strategies in order: aria-label → role → data-test → visible text → structural
- [ ] An overlay file can add or override entries and is picked up on reload without a redeploy
- [ ] A failed lookup records a suggestion entry referencing the failure
- [ ] Lookup behavior is covered by tests using fixture DOM
