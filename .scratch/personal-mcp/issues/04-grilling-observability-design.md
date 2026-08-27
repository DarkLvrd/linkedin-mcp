# 04 — Observability design

Type: grilling
Status: resolved
Blocked by: 02 (resolved)

## Comments

Resolved by grilling with the user (2026-08-24). Q1 yes, Q2 yes (after re-explanation with concrete examples), Q3 yes, Q4 recommendation accepted.

## Answer

1. **Dry-run scope** — plan-then-execute: every agent run first produces an ordered plan list of all intended writes with per-action previews; nothing executes until the user approves the whole plan. The write gate stays as the per-write check inside execution.
2. **Diff previews** — field-level before/after is the default for profile changes (old → new; lists as +/− rows); rendered previews are the default for posts/messages (shown as they will appear in the feed); raw request JSON is available via a hidden toggle, never the default.
3. **Failure artifacts** — screenshot + DOM dump + failed request/response + which registry strategies failed, saved to a local, gitignored, user-configurable artifacts folder; session values (cookies, CSRF tokens) redacted by default, never written to disk.
4. **Self-healing apply policy** — auto-apply registry candidates that provably match against the artifact; pause for human/agent review only when diagnosis is ambiguous. Consistent with ADR-0002's suggestion loop.
