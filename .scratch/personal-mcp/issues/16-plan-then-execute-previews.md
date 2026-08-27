# 16 — Plan-then-execute + previews

**What to build:** the approval layer: `plan`, `approve`, `reject`, `dry_run`, the per-write gate, field-level diff previews (old → new, +/− rows), rendered feed-style previews for posts/messages, and a raw JSON toggle.

**Blocked by:** 12 — Session/pacing engine; 13 — Reliable posting.

**Status:** ready-for-agent

- [ ] An agent run produces an ordered plan list with per-action previews; nothing executes before approval
- [ ] `approve`/`reject` control the whole plan; `dry_run` produces the plan without executing anything
- [ ] Profile changes show field-level old → new diffs; posts show rendered previews; a raw toggle shows the exact request data
- [ ] Every write during execution still passes the per-write gate
