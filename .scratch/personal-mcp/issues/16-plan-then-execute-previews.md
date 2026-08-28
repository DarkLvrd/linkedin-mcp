# 16 — Plan-then-execute + previews

**What to build:** the approval layer: `plan`, `approve`, `reject`, `dry_run`, the per-write gate, field-level diff previews (old → new, +/− rows), rendered feed-style previews for posts/messages, and a raw JSON toggle.

**Blocked by:** 12 — Session/pacing engine; 13 — Reliable posting.

**Status:** resolved (2026-08-24)

- [x] An agent run produces an ordered plan list with per-action previews; nothing executes before approval
- [x] `approve`/`reject` control the whole plan; `dry_run` produces the plan without executing anything
- [x] Profile changes show field-level old → new diffs; posts show rendered previews; a raw toggle shows the exact request data
- [x] Every write during execution still passes the per-write gate

## Answer

Implemented TDD: `src/planning/types.ts` (ActionPreview: profile-diff | rendered | generic with the raw args always present — the toggle; Plan lifecycle: pending → approved → executed / rejected), `src/planning/preview.ts` (buildPreview: update_profile → field-level old→new diffs (headline/about from the profile read; topSkills shows the new value only — the current order is not readable), create_post/edit_post → rendered feed-style preview with the author name, send_message → rendered message preview, everything else → generic summary + raw args), `src/planning/planner.ts` (plan stores a pending plan with previews, approve executes in order through the injected write path and marks executed (partial results preserved if an action fails), reject refuses execution, dry_run returns the plan without storing — nothing can approve it, unknown ids error). Server: write tools refactored into a table (one source of truth for MCP registration AND the plan executor — every executed action passes the read-only gate and, in the bin, the pacing engine = the per-write gate); +4 tools: plan, dry_run (both validate every action's args against its own zod schema at plan time), approve (write-gated), reject. Tests: 5 preview + 5 planner + 6 server; full suite 124/124 via `npm run check`. Review: no fixes; 1 judgement call — the plan/dry_run validation loop repeats (3 lines); the preview dispatch chain stays linear (5 branches).
