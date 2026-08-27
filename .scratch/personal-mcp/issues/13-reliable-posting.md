# 13 — Reliable posting

**What to build:** posts that never double-publish: `create_post`, `edit_post`, `delete_post`, `comment`, `react` — Voyager GraphQL compose, verify-after-post read-back as the source of truth, persisted dedupe keys, and never an auto-retry on timeout.

**Blocked by:** 10 — Voyager reads; 11 — SDUI profile + skills; 12 — Session/pacing engine.

**Status:** ready-for-agent

- [ ] `create_post` publishes and verifies by read-back (the read-back is the source of truth, not the response code)
- [ ] A timeout never auto-retries; it verifies instead
- [ ] The same content + target cannot double-post, even across sessions (persisted dedupe key)
- [ ] `edit_post`, `delete_post`, `comment`, `react` work and verify by read-back
- [ ] Posting flows through the pacing engine and the write gate
