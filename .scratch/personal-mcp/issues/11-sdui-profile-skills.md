# 11 — SDUI profile + skills

**What to build:** the write side of profile management: `update_profile`, `add_skill`, `remove_skill`, `reorder_skills` (top-skills via the About form), and `delete_ghost_entry` — edits addressed by stable URN, every delete routed through SDUI.

**Blocked by:** 07 — Project scaffold + transport seam; 08 — Selector/endpoint registry; 10 — Voyager reads.

**Status:** resolved (2026-08-24)

- [x] `update_profile` edits headline/about/sections by stable URN and verifies by read-back
- [x] `add_skill`, `remove_skill`, `reorder_skills` work (top-skills via the About form) and verify by read-back
- [x] `delete_ghost_entry` removes entries that standard deletes miss, via SDUI endpoints
- [x] No Voyager `DELETE` is used anywhere in the write path

## Answer

Implemented TDD: `src/sdui/forms.ts` (MemoryNamespace state-refs + states[] literal pattern from research ticket 01: skillAddForm, skillDeleteForm, aboutForm with top-skills, ghostDeleteForm per deleteProfile<Section>Form), `src/sdui/client.ts` (SduiClient: POSTs to the rsc-action endpoint with the CSRF header; 200/201 ok, 401/403 → readable session errors, readSkills read-back), seam extended (ProfileUpdate, GhostEntryRef + 5 write methods), `VoyagerClient` renamed to `LinkedInHttpClient` (it now covers both API families) with the write methods composing SduiClient + verify-by-read-back, FakeTransport extended, 5 write tools registered (update_profile, add_skill, remove_skill, reorder_skills, delete_ghost_entry) with zod schemas; toolResult now surfaces all failures as clean tool errors. Shared cookie-header builder extracted (`src/session/cookies.ts` — one redaction boundary). Tests: 5 sdui forms/client + 6 transport writes (incl. a method-log test proving no Voyager DELETE ever fires) + 6 server writes; full suite 58/58 via `npm run check`. Review: 2 fixes applied (cookie-header duplication extracted; unused `sdui` option removed — YAGNI). Notes: add_skill sends the skill name as the typeahead id placeholder (server-issued ids need a live capture — manual smoke); reorder goes through the About form top-skills per the research; update_profile addresses the own profile implicitly as 'me'.
