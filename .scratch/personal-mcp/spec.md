# Spec — agentic-linkedin: the LinkedIn MCP that never breaks

Status: ready-for-agent
Source: wayfinder map (`.scratch/personal-mcp/map.md`, all tickets resolved) + ADR-0001/0002 + CONTEXT.md glossary.

## Problem Statement

Using LinkedIn as a person takes time and repetition: logging in, writing posts, editing the profile, answering messages, sending connection requests. AI agents can do this work, but every existing LinkedIn MCP bridge fails in the same ways: they break whenever LinkedIn changes its website (DOM churn, monthly), they lock the user out after a burst of writes (the authwall), they can double-post when a request times out, they cannot do the full job a person can (skills reorder, ghost-entry cleanup, services), and their output reads like a machine wrote it. The user wants to describe what they want on LinkedIn in plain words and have an agent execute it — reliably, safely, and in their own voice — without ever touching the site themselves.

## Solution

An installable, open-source MCP server (npm package `agentic-linkedin`, run via `npx`) that gives an AI agent everything a person can do on LinkedIn: profile management (including skills and ghost-entry cleanup), posts/comments/reactions, messaging, connections, jobs (read), and analytics — over v1. It never breaks (self-healing selector/endpoint registry), never locks the user out (session/pacing engine), never double-posts (verify-after-post + dedupe), shows its work (plan-then-execute with diff previews), and writes in the user's voice (per-user voice profiles with an AI-tell audit). It works for any user, not just the author; identity stays in the user's environment.

## User Stories

1. As a user, I want to install the server with one command (`npx agentic-linkedin`), so that setup is trivial.
2. As a user, I want to log in once through a browser window, so that the server can act on my behalf without constant re-authentication.
3. As a user, I want my session to survive restarts, so that I don't log in again each time I use the tool.
4. As a user, I want to check my session health at any time, so that I can re-authenticate before something fails.
5. As a user, I want to describe a task in plain words, so that the agent can plan the actions for it.
6. As a user, I want to see an ordered plan list of every intended write before anything executes, so that I can approve or reject the whole plan (plan-then-execute).
7. As a user, I want a dry-run mode that produces a full session plan without executing any of it, so that I can preview safely.
8. As a user, I want every write gated on my approval even during execution, so that nothing happens without my say-so (write gate).
9. As a user, I want field-level diff previews (old → new; lists as +/− rows) for profile changes, so that I know exactly what will change.
10. As a user, I want rendered previews of posts and messages as they will appear, so that I can check them before they go live.
11. As a user, I want a raw toggle showing the exact request data, so that I can debug when I need to.
12. As a user, I want to read my own profile and other people's profiles, so that I can review information.
13. As a user, I want to edit headline, about, location, and every profile section, so that my profile stays current.
14. As a user, I want to add, remove, reorder, and pin top skills, so that my profile reflects my strengths.
15. As a user, I want profile edits addressed by stable entity URN, not list index, so that edits never hit the wrong entry.
16. As a user, I want ghost entries removed from my profile, so that entries I deleted stay deleted.
17. As a user, I want to create text, image, and article posts, so that I can share content.
18. As a user, I want to edit and delete my posts, so that I can correct mistakes.
19. As a user, I want every post verified by read-back after publishing, so that I know it landed.
20. As a user, I want a guarantee that nothing double-posts, even across sessions, so that a timeout never duplicates my content.
21. As a user, I want to like, comment, reply, and save posts, so that I can engage with my network.
22. As a user, I want to remove likes and comments, so that I can undo engagement.
23. As a user, I want to list conversations and read history, so that I can follow up with people.
24. As a user, I want message sends to be idempotent, so that retries never double-send.
25. As a user, I want to recall messages and react to them, so that I can manage conversations.
26. As a user, I want to send connection requests with notes, so that I can grow my network.
27. As a user, I want to accept, ignore, and withdraw invitations, so that I can manage my network.
28. As a user, I want to follow and unfollow companies and people, so that I can curate my feed.
29. As a user, I want to read my connections, followers, and following lists, so that I can understand my network.
30. As a user, I want to search jobs and read details, so that I can find opportunities.
31. As a user, I want to view my saved and applied jobs, so that I can track my search.
32. As a user, I want profile views and post impressions, so that I can measure my presence.
33. As a user, I want the server to keep working after LinkedIn changes its website, so that a redesign never blocks me.
34. As a user, I want registry fixes to land without a redeploy, so that repairs are fast.
35. As a user, I want failure artifacts (screenshot, DOM dump, failed request) saved locally, so that I can debug or share them.
36. As a user, I want my session values redacted from all artifacts, so that my credentials never touch disk.
37. As a user, I want provably-safe registry fixes applied automatically, so that the tool heals itself quietly.
38. As a user, I want uncertain fixes paused for review, so that nothing risky auto-applies.
39. As a user, I want pacing that stays under LinkedIn's write quotas, so that I never get flagged.
40. As a user, I want graceful re-authentication: pause writes, sign in, resume queued work, so that a session expiry loses nothing.
41. As a user, I want a read-only mode, so that I can run watch-only automation safely.
42. As a user, I want a voice profile that describes how I write, so that outbound text sounds like me.
43. As a user, I want my voice profile seeded from my past posts, so that setup is quick.
44. As a user, I want drafts audited for AI tells, so that nothing reads like a machine wrote it.
45. As a user, I want audit results as suggested fixes, not rewrites, so that I keep control of the words.
46. As a user, I want one voice applied to posts, comments, messages, and connection notes, so that my voice is consistent everywhere.
47. As a new user (not the author), I want to create my own voice profile, so that the tool works for anyone.
48. As an operator, I want separate sessions per account, so that more than one person can use the tool.

## Implementation Decisions

1. **Stack and distribution** — TypeScript/Node; npm package `agentic-linkedin` (name reserved, not yet published); `npx` distribution; MIT license; repo `DarkLvrd/linkedin-mcp` (public).
2. **Browserless-first posture** (ADR-0001) — all reads and most writes over plain HTTP; a stealth browser (Playwright-based, `navigator.webdriver` neutralised) is only the session source (login, cookie persistence) and the per-capability fallback.
3. **Three-way transport routing** (ADR-0001) — Voyager: all reads, post-create/edit, like, save/unsave, delete-repost, all messaging, connect-with-note, follow-company, media upload. SDUI: all profile edits (skills add/delete, top-skills via About form, experience, education, …), comments, unlike, delete-post, endorse, remove-connection. Browser fallback: per-capability flag for SDUI writes that fail replayable (HTTP 500 without a page context).
4. **Registry as data** (ADR-0002) — versioned JSON registry (endpoints + selectors) shipped in the package; runtime overlay file hot-reloaded without redeploy; multi-strategy lookup order aria-label → role → data-test → visible text → structural; failure artifacts feed auto-diagnosis; provably-safe candidates auto-apply, ambiguous ones pause for review; an `update registry` MCP tool applies overlay changes.
5. **Session/pacing engine** — per-sign-in browser write budget (default 2–3, configurable), ~60/hour HTTP write ceiling, randomized human-like pacing, health probes (401, 403-CSRF, redirect-to-self) before write batches; on challenge: pause, re-sign-in in the stealth browser, resume queued work; sessions persist across restarts; read-only mode blocks every write tool outright.
6. **Reliable posting** — compose via Voyager GraphQL (`voyagerContentcreationDashShares`); verify-after-post via feed read-back (`voyagerFeedDashProfileUpdates`) as the single source of truth; persisted dedupe key (content hash + target) across sessions; a timeout never auto-retries, it verifies; messaging sends carry `originToken` idempotency keys.
7. **Ghost-entry cleanup** — all deletes route through SDUI endpoints; Voyager `DELETE` is never used (constant HTTP 400 in tested key formats).
8. **Write gate and plan-then-execute** — every agent run produces an ordered plan list with per-action previews; nothing executes until the whole plan is approved; the write gate stays per-write during execution; dry-run produces the plan without executing.
9. **Diff previews** — field-level before/after for profile changes, rendered feed-style previews for posts/messages, raw JSON behind a toggle.
10. **Failure artifacts** — screenshot + DOM dump + failed request/response + failed registry strategies, saved to a local gitignored, user-configurable folder; session values redacted by default (never written to disk).
11. **Voice profiles** — per-user, multi-user by design; structured profile (tone, vocabulary do/don'ts, emoji habits, sentence length, personal stories pool, no-AI-tell checklist), bootstrapped from the user's own past posts or a short interview; the agent writes, the server audits (rule-based AI-tell scan returning suggested fixes, never rewrites); one voice governs all outbound text (posts, comments, replies, messages, connection notes).
12. **MCP tool surface** — reads: `get_me`, `get_profile`, `get_posts`, `get_post_comments`, `get_conversations`, `get_connections_summary`, `get_jobs`, `get_analytics`, `session_status`. Writes (behind the gate): `update_profile`, `add_skill`, `remove_skill`, `reorder_skills`, `create_post`, `edit_post`, `delete_post`, `comment`, `react`, `send_message`, `recall_message`, `connect`, `respond_invitation`, `follow`, `endorse_skill`, `remove_connection`, `delete_ghost_entry`. Planning: `plan`, `approve`, `reject`, `dry_run`. Registry: `update_registry`, `show_suggestions`. Voice: `get_voice_profile`, `set_voice_profile`, `audit_draft`. Artifacts: `show_artifact`.
13. **Jobs scope** — reads only in v1 (search, detail, saved/applied lists); apply is not documented as a write and is out of scope.
14. **Identity** — never stored in the repo or artifacts; provided via environment; login once through the stealth browser window.

## Testing Decisions

- **One seam**: a single `LinkedInTransport` interface (fetch-shaped) with three implementations — Voyager client, SDUI client, browser fallback — and a `FakeTransport` for tests. All domain logic sits above the seam and is tested against the fake: budget accounting, dedupe keys, verify-after-post orchestration, plan gating, diff rendering, audit rules, registry strategy fallback, artifact redaction. The browser fallback shares the seam, so nothing below it needs mocking.
- **Good tests** assert external behavior only — what a user or agent observes (plans, previews, post results, session state) — never implementation details.
- **Real-client tests** replay captured request fixtures offline (prior art: the fixture pattern in mguttmann/linkedin-internal-api `mcp/tests/fixtures/` — captured JSON bodies replayed against the client, no live network).
- **Modules tested**: engine (pacing/budget), registry (strategies, overlay, suggestions), planner (plan list, gate), diff renderer, audit rules, dedupe store, artifact store (redaction), transport routing table.
- **Live LinkedIn** is exercised only via scripted smoke tests run manually on the owner's account; never in CI. CI against LinkedIn's live DOM stays fog (see Further Notes).
- **Prior art in this repo**: none yet (greenfield); testing conventions follow the voice-summaries repo and the fixture approach cited above.

## Out of Scope

- LinkedIn coverage beyond the v1 cut: groups, company pages, events, ads, jobs-apply
- Multi-platform (X, YouTube, Behance) — decided LinkedIn-only at charting
- Monetization / paid tier / open-core boundary
- Release automation (manual `npm publish` until v1 exists)
- Official LinkedIn OAuth APIs (`w_member_social`, Profile Edit API) — not usable for a personal tool without app approval
- Testing against LinkedIn's live DOM in CI

## Further Notes

- ADR-0001 (browserless-first) and ADR-0002 (registry-as-data) govern this spec; the CONTEXT.md glossary is the vocabulary source.
- The wayfinder map remains the decision index; this spec synthesizes tickets 01–06.
- Empirical constraints recorded in research/01: authwall after ~2–3 browser writes per sign-in; ~60 writes/hour ceiling; Voyager DELETE 400s; GraphQL hashes rotate on deploys.
- Proof material for voice-profile seeding and profile work: `C:\Users\chevo\dev\linkedin-profile\applied.md`; patched selector evidence at the npm-cache path in the handoff.
- The `services` profile section has no documented endpoint in any source; v1 treats it as browser-fallback probe territory (per-capability flag), and if it proves intractable it drops to a documented limitation.
