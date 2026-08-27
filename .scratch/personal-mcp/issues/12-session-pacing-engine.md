# 12 — Session/pacing engine

**What to build:** the engine that keeps the server under LinkedIn's limits: per-sign-in write budget (default 2–3 browser-context writes), ~60/hour ceiling, randomized human-like pacing, health probes before write batches, pause → re-auth → resume, and read-only mode.

**Blocked by:** 07 — Project scaffold + transport seam; 09 — Auth bootstrap; 10 — Voyager reads.

**Status:** ready-for-agent

- [ ] Writes consume the per-sign-in budget and pause when exhausted until re-auth
- [ ] The hourly ceiling is enforced with randomized pacing delays
- [ ] On a health-probe failure the engine pauses writes, re-auths via the browser, and resumes queued work
- [ ] Read-only mode blocks every write tool outright
- [ ] Engine behavior is fully tested against `FakeTransport`, including challenge scenarios
