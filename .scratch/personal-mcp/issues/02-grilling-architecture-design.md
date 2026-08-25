# 02 — Architecture design

Type: grilling
Status: resolved
Blocked by: 01

## Comments

Resolved by grilling with the user (2026-08-24). All five questions answered; recommendations accepted (Q1–Q4), Q5 confirmed. Hard-to-reverse calls recorded as ADR-0001 and ADR-0002.

## Answer

**Context pointer:** ADR-0001 (browserless-first), ADR-0002 (registry-as-data); glossary updated in `CONTEXT.md` (browserless-first, verify-after-post, write gate, transport split).

1. **Posture** — browserless-first: HTTP (Voyager + SDUI) for all reads and most writes; stealth browser only as session source + per-capability fallback. (ADR-0001)
2. **Routing table** — adopted from research: Voyager = reads, post-create/edit, like, save/unsave, delete-repost, messaging, connect-with-note, follow-company, media upload; SDUI = profile edits (skills, top-skills via About form, experience, education…), comments, unlike, delete-post, endorse, remove-connection; browser fallback behind a per-capability flag.
3. **Selector/endpoint registry** — versioned JSON shipped in package + runtime overlay file (hot-reload, no redeploy); multi-strategy lookup (aria-label → role → data-test → visible text → structural); failure artifacts (screenshot + DOM dump + failed strategies) feed auto-diagnosis; candidate suggestions applied via an `update registry` tool. (ADR-0002)
4. **Session/pacing engine** — per-sign-in browser write budget (default 2–3, configurable), ~60/hr HTTP write ceiling, randomized human-like pacing, health probes (401 / 403-CSRF / redirect-to-self) before each write batch; on challenge: pause writes, re-sign-in in the stealth browser, resume queued work.
5. **Reliable posting + write gate** — compose via Voyager GQL; verify-after-post via `voyagerFeedDashProfileUpdates` read-back as single source of truth; persisted local dedupe key (content hash + target) so nothing double-posts across sessions; a timeout never auto-retries, it verifies; every write behind a confirm/dry-run gate by default (gate UX designed in ticket 04 — Observability design).
