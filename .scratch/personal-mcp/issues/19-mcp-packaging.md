# 19 — MCP packaging

**What to build:** the finished, publishable server: stdio MCP server wiring every tool, configuration (identity via environment, budgets, read-only, artifacts dir), the `npx agentic-linkedin` binary, CI, and a README that documents install, login, and the plan-then-execute workflow.

**Blocked by:** 10 — Voyager reads; 11 — SDUI profile + skills; 12 — Session/pacing engine; 13 — Reliable posting; 14 — Messaging; 15 — Network; 16 — Plan-then-execute + previews; 17 — Failure artifacts + self-healing; 18 — Voice profiles + audit.

**Status:** ready-for-agent

- [ ] `npx agentic-linkedin` starts the server with all tools registered
- [ ] Configuration is honored: identity via environment, budgets, read-only mode, artifacts directory
- [ ] The package builds, lints, and passes the full test suite in CI
- [ ] README documents install, login, and the plan-then-execute workflow
