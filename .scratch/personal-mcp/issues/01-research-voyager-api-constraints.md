# 01 — Voyager API constraints

Type: research
Status: resolved
Blocked by: none

## Comments

Resolved by research subagent during charting (2026-08-24). Answer below.

## Question

What does LinkedIn's Voyager (internal REST) API actually allow, per capability?

For each of these, establish: can it be done via the Voyager API at all, via which endpoint/URN, and is it read or write?

- Profile: reads and edits — including skills add/remove/reorder, top-skills pinning, services page, ghost-entry cleanup, and edits by stable entity URN (not index)
- Posting: create post, verify-after-post, dedupe (does LinkedIn surface an error when the same post text is posted twice?)
- Comments and reactions
- Messaging (send/list)
- Connection invites (send/withdraw)
- Jobs: search/read, and apply
- Analytics: profile view counts, post impressions

Also: documented write limits / rate limits (the handoff records ~60 writes/hour server-side and ~2–3 browser writes per sign-in before the authwall); whether the browser transport is strictly required for writes; and any known third-party documentation or source (community docs, linkedin-api packages, the bridge's own Voyager calls) that maps these endpoints.

Deliverable: a findings file with each claim cited to its source, linked from this ticket (resolution comment references the file path).

## Answer

**Context pointer:** findings at `.scratch/personal-mcp/research/01-voyager-api-constraints.md` (branch `research/01-voyager-api-constraints`, merged to `main`).

Gist: LinkedIn exposes two private APIs — Voyager (reads + browserless writes: post-create, like, messaging, connect, follow-company) and SDUI (profile edits across 16 sections incl. skills add/delete, top-skills via About form, comments, unlike, delete-post, endorse, remove-connection). Many SDUI writes replayable browserless via a `states[]` payload; some need a browser. Messages have a documented idempotency key (`originToken`); posts do not → never-double-post needs local dedupe + verify-after-post via `voyagerFeedDashProfileUpdates` read-back. Ghost entries likely stem from Voyager `DELETE` returning constant 400 → deletes must route through SDUI. Services page is the one undocumented gap. GraphQL query-id hashes rotate on deploys → endpoints break without notice, which is the core argument for a data-driven, self-healing endpoint/selector registry. Authwall (~2–3 browser writes/sign-in) and 60/hr quota remain empirical from our own sessions. New serious competitor surfaced: **mguttmann/linkedin-internal-api** (browserless-first, 26 tools, honest endpoint docs) — not in the handoff's list.
