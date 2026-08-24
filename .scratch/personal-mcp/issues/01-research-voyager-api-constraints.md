# 01 — Voyager API constraints

Type: research
Status: resolved
Blocked by: none

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

Resolved during charting by the research subagent. Findings: `research/01-voyager-api-constraints.md` (see `.scratch/personal-mcp/research/`).
