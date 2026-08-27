# 12 — Session/pacing engine

**What to build:** the engine that keeps the server under LinkedIn's limits: per-sign-in write budget (default 2–3 browser-context writes), ~60/hour ceiling, randomized human-like pacing, health probes before write batches, pause → re-auth → resume, and read-only mode.

**Blocked by:** 07 — Project scaffold + transport seam; 09 — Auth bootstrap; 10 — Voyager reads.

**Status:** resolved (2026-08-24)

- [x] Writes consume the per-sign-in budget and pause when exhausted until re-auth
- [x] The hourly ceiling is enforced with randomized pacing delays
- [x] On a health-probe failure the engine pauses writes, re-auths via the browser, and resumes queued work
- [x] Read-only mode blocks every write tool outright
- [x] Engine behavior is fully tested against `FakeTransport`, including challenge scenarios

## Answer

Implemented TDD: `src/engine/types.ts` (PacingConfig + DEFAULT_PACING: 3 per-sign-in browser writes, 60/hour, 1–5s pacing, 60s probe interval; WriteBudgetExhaustedError, PacingHoldError, ReadOnlyError), `src/engine/paced.ts` (PacedTransport — a decorator over the transport seam: read-only gate → session check → sign-in-change budget reset → health probe (interval-cached, i.e. per write batch) → hourly sliding-window ceiling → per-sign-in browser budget → randomized human-like delay → inner write → accounting. A fresh `obtainedAt` after re-auth resets the per-sign-in budget: pause → re-auth → resume). Server defense-in-depth: `writeToolResult` refuses every write tool outright in read-only mode (reads untouched); bin wraps `LinkedInHttpClient` in `PacedTransport`. Tests: 7 engine (budget + re-auth resume, sliding-window ceiling, pacing range, health hold, no-session, read-only, read passthrough) + 1 server read-only sweep; full suite 66/66 via `npm run check`. Review: no fixes needed; 1 judgement call — `browserWriteMethods` is empty in production until a browser-context write exists (implements the documented decision, exercised by tests). Note: the probe runs per write but is interval-cached, so a burst of writes shares one probe — that is the "per batch" behavior.
