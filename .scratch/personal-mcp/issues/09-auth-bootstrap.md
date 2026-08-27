# 09 — Auth bootstrap

**What to build:** sign in once through the stealth browser window, persist the session, restore it across restarts, and report session health honestly.

**Blocked by:** 07 — Project scaffold + transport seam; 08 — Selector/endpoint registry.

**Status:** resolved (2026-08-24)

- [x] A `login` flow opens a browser window; after the user signs in once, the session persists to disk
- [x] On restart, the server restores the session without a new sign-in
- [x] `session_status` reports healthy/unhealthy using the health probes (401, 403-CSRF, redirect-to-self)
- [x] Session values never appear in logs or artifacts

## Answer

Implemented TDD: `src/session/types.ts` (SessionCookies, SessionStore, BrowserSession, HealthProbe, SessionManager), `store.ts` (FileSessionStore — missing/corrupt file = no session, never a crash), `probe.ts` (VoyagerHealthProbe — GET /voyager/api/me; 200 healthy, 401/403-CSRF/redirect-to-self unhealthy, never throws), `manager.ts` (SessionManagerImpl — login persists cookies, restore across restarts, clear), `browser.ts` (PlaywrightBrowserSession — headful one-time sign-in, waits for the feed redirect, then captures cookies; lazy Playwright import so tests need no browser), `src/transport/session.ts` (SessionTransport below the seam), `login` tool on the server, bin wired with env-configurable session path (default `~/.agentic-linkedin/session.json`, gitignored). `NoSessionTransport` deleted (superseded, as flagged in ticket 07's review). Tests: 4 store + 5 probe (local HTTP server) + 6 manager (fakes) + 3 server-session = 18 new; full suite 29/29 via `npm run check`. Review: 2 minor judgement calls (test-fake duplication across two files; SessionTransport is a thin delegator but is the seam); browser flow improved during review (wait for feed redirect instead of window close — avoids reading cookies from a closed context). AC4 (redaction) held by design: cookies live only in the store file and probe internals; no tool output or log contains them.

**Manual smoke (HITL, per spec Testing Decisions — live actions are never in CI):** run `npm run build`, then `node dist/index.js` with an MCP client, call `login`, sign in in the window, verify `session_status` → healthy, restart the server, verify no re-login needed. Requires `npx playwright install chromium` once.
