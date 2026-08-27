# 07 — Project scaffold + transport seam

**What to build:** the TypeScript project skeleton with a working MCP server process that exposes `session_status`; the `LinkedInTransport` interface (the one seam) with `FakeTransport`; a green test suite that needs no live LinkedIn.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The project builds and the full test suite runs green with one command
- [ ] The MCP server starts and `session_status` returns real state from the transport
- [ ] `FakeTransport` implements the full `LinkedInTransport` contract and drives the tools in tests
- [ ] No live LinkedIn calls are needed to run the test suite
