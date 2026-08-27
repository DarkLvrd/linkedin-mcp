# 07 — Project scaffold + transport seam

**What to build:** the TypeScript project skeleton with a working MCP server process that exposes `session_status`; the `LinkedInTransport` interface (the one seam) with `FakeTransport`; a green test suite that needs no live LinkedIn.

**Blocked by:** None — can start immediately.

**Status:** resolved (2026-08-24)

- [x] The project builds and the full test suite runs green with one command (`npm run check`)
- [x] The MCP server starts and `session_status` returns real state from the transport
- [x] `FakeTransport` implements the full `LinkedInTransport` contract and drives the tools in tests
- [x] No live LinkedIn calls are needed to run the test suite

## Answer

Implemented TDD at the transport seam (spec Testing Decisions): `src/transport/types.ts` (the `LinkedInTransport` contract + `SessionStatus`), `src/transport/fake.ts` (`FakeTransport`), `src/transport/no-session.ts` (honest placeholder for the bin until ticket 09), `src/server.ts` (`createAgenticLinkedinServer` registering `session_status`, read-only overlay), `src/index.ts` (stdio bin, `LINKEDIN_READ_ONLY` env). Tests: 4 contract + 3 server tests (via SDK in-memory client, external behavior only). `npm run check` = typecheck + build + 7/7 tests green; stdio smoke verified. Review (code-review): 2 minor judgement calls noted (NoSessionTransport placeholder; `reason` as free string — formalize in ticket 12), 1 partial AC fixed (single-command `check` script), zero scope creep.
