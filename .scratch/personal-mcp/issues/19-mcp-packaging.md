# 19 — MCP packaging

**What to build:** the finished, publishable server: stdio MCP server wiring every tool, configuration (identity via environment, budgets, read-only, artifacts dir), the `npx agentic-linkedin` binary, CI, and a README that documents install, login, and the plan-then-execute workflow.

**Blocked by:** 10 — Voyager reads; 11 — SDUI profile + skills; 12 — Session/pacing engine; 13 — Reliable posting; 14 — Messaging; 15 — Network; 16 — Plan-then-execute + previews; 17 — Failure artifacts + self-healing; 18 — Voice profiles + audit.

**Status:** resolved (2026-08-24)

- [x] `npx agentic-linkedin` starts the server with all tools registered
- [x] Configuration is honored: identity via environment, budgets, read-only mode, artifacts directory
- [x] The package builds, lints, and passes the full test suite in CI
- [x] README documents install, login, and the plan-then-execute workflow

## Answer

Final ticket — the map is fully clear. Implemented: `src/config.ts` (readConfig: LINKEDIN_READ_ONLY, pacing budget/delay/probe overrides with safe numeric parsing, all five path overrides; defaults conservative), bin rewritten around it (pacing config now flows into PacedTransport), `tests/stdio-smoke.test.ts` (spawns the built binary and drives a real MCP handshake over stdio: initialize → tools/list → session_status; asserts all 39 tools registered and honest no-session state), build now copies `src/registry/selectors.json` into `dist` (tsc never did — **the published package would have crashed at startup**; the smoke test caught it end-to-end), `prepublishOnly: npm run check`, `.github/workflows/ci.yml` (ubuntu, node 22, npm ci, npm run check), README rewritten (install, one-time login, plan-then-execute workflow, tool list, env config table, offline-testing note, MIT). Tests: 5 config + 3 stdio smoke; full suite 161/161 via `npm run check`. Live verification: `LINKEDIN_READ_ONLY=1 node dist/index.js` reports `readOnly: true` over stdio. Review: no fixes; 1 note — "lints" is served by strict tsc typecheck; no ESLint dependency (conscious choice, flagged in CI).
