# 17 — Failure artifacts + self-healing

**What to build:** the repair loop: capture failure artifacts (screenshot, DOM dump, failed request, failed strategies) with session values redacted, diagnose them into candidate selectors, auto-apply provably-safe candidates to the overlay, pause ambiguous ones, and expose `show_artifact` + `update_registry`.

**Blocked by:** 08 — Selector/endpoint registry; 09 — Auth bootstrap; 12 — Session/pacing engine.

**Status:** ready-for-agent

- [ ] A failed lookup or write captures an artifact (screenshot, DOM dump, failed request, failed strategies) to the configured local folder
- [ ] Session values are redacted from every artifact
- [ ] Diagnosis produces candidate selectors; provably-safe ones auto-apply to the overlay, ambiguous ones wait for review
- [ ] `show_artifact` and `update_registry` expose the loop to the agent
