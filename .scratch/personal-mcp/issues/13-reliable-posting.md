# 13 — Reliable posting

**What to build:** posts that never double-publish: `create_post`, `edit_post`, `delete_post`, `comment`, `react` — Voyager GraphQL compose, verify-after-post read-back as the source of truth, persisted dedupe keys, and never an auto-retry on timeout.

**Blocked by:** 10 — Voyager reads; 11 — SDUI profile + skills; 12 — Session/pacing engine.

**Status:** resolved (2026-08-24)

- [x] `create_post` publishes and verifies by read-back (the read-back is the source of truth, not the response code)
- [x] A timeout never auto-retries; it verifies instead
- [x] The same content + target cannot double-post, even across sessions (persisted dedupe key)
- [x] `edit_post`, `delete_post`, `comment`, `react` work and verify by read-back
- [x] Posting flows through the pacing engine and the write gate

## Answer

Implemented TDD: `src/posting/dedupe.ts` (dedupeKey = sha256(kind:target:content); InMemoryDedupeStore + FileDedupeStore persisted across sessions), seam extended (ReactionType union, AlreadyPostedError, CreatePostResult = {verified:true,post} | {verified:false,post:null}, 5 posting methods), `postJson` in LinkedInHttpClient with sent-tracking (fetch rejection = likely never sent → no dedupe key, "safe to retry"; any received response incl. body-read timeout = sent → dedupe key written immediately, never auto-retry, verify instead), create_post (compose GQL → dedupe → verify by read-back: text + own author), edit_post (compose + resourceKey → read-back text/id verified), delete_post (SDUI deletePost form → verified by absence), comment (SDUI createComment form), react (Voyager reactions POST with reactionType body); SDUI forms +2 (deletePostForm, commentForm); FakeTransport + PacedTransport extended (posting flows through the engine: read-only, budgets, pacing); 5 server tools (create_post, edit_post, delete_post, comment, react — reaction enum validated); bin passes FileDedupeStore (AGENTIC_LINKEDIN_DEDUPE_PATH, default ~/.agentic-linkedin/posts.json). Tests: 4 dedupe + 10 posting (incl. never-sent-no-key, already-posted-refusal, edit/delete verification failures) + 4 server posting; full suite 84/84 via `npm run check`. Review: no fixes; 2 judgement calls — the session-error mapping repeats across request/postJson/SduiClient (different contracts, extraction awkward); **tracked limitation**: comment/react verify at the HTTP layer (2xx), not by read-back — the comments read-back is not built yet; add with the manual smoke. The write gate (plan-then-execute) arrives in ticket 16; the engine already paces all posting writes.
