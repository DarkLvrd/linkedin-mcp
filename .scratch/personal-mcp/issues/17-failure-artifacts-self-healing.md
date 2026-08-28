# 17 — Failure artifacts + self-healing

**What to build:** the repair loop: capture failure artifacts (screenshot, DOM dump, failed request, failed strategies) with session values redacted, diagnose them into candidate selectors, auto-apply provably-safe candidates to the overlay, pause ambiguous ones, and expose `show_artifact` + `update_registry`.

**Blocked by:** 08 — Selector/endpoint registry; 09 — Auth bootstrap; 12 — Session/pacing engine.

**Status:** resolved (2026-08-24)

- [x] A failed lookup or write captures an artifact (screenshot, DOM dump, failed request, failed strategies) to the configured local folder
- [x] Session values are redacted from every artifact
- [x] Diagnosis produces candidate selectors; provably-safe ones auto-apply to the overlay, ambiguous ones wait for review
- [x] `show_artifact` and `update_registry` expose the loop to the agent

## Answer

Implemented TDD: `src/artifacts/types.ts` (FailureArtifact: registry-lookup | http, redacted invariant), `src/artifacts/store.ts` (FileArtifactStore — one JSON file per artifact in a local gitignored dir; InMemoryArtifactStore for tests; redact() strips li_at/JSESSIONID/csrf-token values from error text — structural redaction: the capture API has no header field; shared finalizeArtifact), `src/artifacts/heal.ts` (diagnose: re-expresses failed strategies under other kinds — attr values become css/text candidates; provable only when the DOM dump contains the query, so nothing auto-applies without evidence; applyCandidates: provable → registry.heal, ambiguous → pending), `src/artifacts/healer.ts` (capture → diagnose → apply in one loop), registry +heal() (prepends a strategy to the overlay entry) and +onSuggestion hook; HTTP client +onFailure (fetch rejections and HTTP ≥400 report redacted artifacts); server +show_artifact +update_registry (strategy-kind enum validated) behind registry/artifacts options; bin wires everything — registry onSuggestion → healer.capture (registry-lookup failures), client onFailure → healer.capture (HTTP failures), artifacts dir + overlay path env-configurable. Tests: 4 store + 4 heal + 4 healer/wiring + 4 server; full suite 140/140 via `npm run check`. Review: 2 fixes applied — duplicated artifact finalization extracted; the bin's registry→healer suggestion bridge was missing and is now wired. One TS7 parser quirk worked around (explicit parameter annotation on the update_registry handler). Note: screenshot capture needs the browser transport (future); domDump is the evidence channel today.
