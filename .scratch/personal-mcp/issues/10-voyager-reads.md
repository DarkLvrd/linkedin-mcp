# 10 — Voyager reads

**What to build:** the read side of the transport: `get_me`, `get_profile`, `get_posts`, `get_conversations`, `get_connections_summary`, `get_jobs`, `get_analytics` — tested by replaying recorded Voyager fixtures offline.

**Blocked by:** 07 — Project scaffold + transport seam.

**Status:** resolved (2026-08-24)

- [x] All seven read tools work against recorded Voyager fixtures with no network access
- [x] Every read goes through the transport seam
- [x] Responses map to clean tool output — no raw internal response shapes leak to the agent

## Answer

Implemented TDD: `src/voyager/types.ts` (Member, Profile, Post, Conversation, ConnectionsSummary, Job, Analytics — the clean shapes), `src/voyager/client.ts` (VoyagerClient: real transport below the seam — fetch with session cookies + CSRF header, tolerant pickString/pickNumber mappers, 401/403/redirect-to-self → SessionExpiredError, no-session → SessionRequiredError, cookies as a per-request provider so a later login is picked up, injectable probe/fetch for tests), seam extended (`LinkedInTransport` + 7 read methods, SessionRequiredError/SessionExpiredError), FakeTransport extended to the full contract, 7 read tools registered on the server with zod schemas + uniform toolResult error wrapper, bin rewired to VoyagerClient with `session.getCookies()` provider. Deleted `SessionTransport` (superseded — flagged in ticket 09's review). Tests: 9 client (fixture-replay, no network) + 3 server reads + server-session rewritten against the real transport; fixtures in `tests/fixtures/voyager/` (hand-crafted from documented shapes — to be replaced by captured recordings during the manual smoke). Full suite 41/41 via `npm run check`. Review: 1 hack removed (`_signature` static → `_filters` param), 2 judgement calls noted (pickString/pickNumber share a walk — extract if a third appears; test fakes now in two files — extract if a third). Test-driven findings: fixture prefix-collision bug (`/voyager/api/me` matched `/voyager/api/messaging/…` — fixed with segment-boundary matching); stale-cookies wiring bug (login after startup would never be picked up — fixed with the provider function); URN percent-encoding broke the profileView path (raw URN now).

**Manual smoke (HITL):** after a real `login`, call each read tool against the live account and replace hand-crafted fixtures with captured recordings; verify the jobs search endpoint shape (community docs show GraphQL — the exact query id needs a live capture).
