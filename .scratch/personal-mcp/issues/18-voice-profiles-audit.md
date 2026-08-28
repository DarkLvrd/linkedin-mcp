# 18 — Voice profiles + audit

**What to build:** the humanized content layer: per-user `voice_profile` (multi-user by design, bootstrapped from past posts or a short interview), `audit_draft` (the AI-tell scan returning suggested fixes, never rewrites), and the audit result shown in the posting preview.

**Blocked by:** 07 — Project scaffold + transport seam; 13 — Reliable posting.

**Status:** resolved (2026-08-24)

- [x] `get_voice_profile` / `set_voice_profile` work per user; a new user can bootstrap from past posts or a short interview
- [x] `audit_draft` flags AI tells (inflated claims, formulaic structure, em-dash overuse, chatbot phrasing) and returns suggested fixes, never rewrites
- [x] Drafts in the posting flow show their audit result in the preview
- [x] Audit rules are tested against sample human-written and machine-written texts

## Answer

Implemented TDD: `src/voice/types.ts` (VoiceProfile: tone, vocabulary do/avoid, emoji, sentenceLength, personalStories, notes — per-user, multi-user by design), `src/voice/store.ts` (FileVoiceProfileStore per-user JSON files; deriveVoiceProfile shared by both stores — emoji rate per 100 words and average words per sentence derive the starting profile; emoji-only fragments after periods filtered out of the sentence average), `src/voice/audit.ts` (auditDraft: five AI-tell rules — inflated-claims wordlist, formulaic-structure patterns, em-dash overuse (>2), chatbot-phrasing patterns, robotic-rhythm (same sentence opener 3×); every finding carries a suggested fix, never a rewrite; score human/suspect/machine by finding count), previews now carry the audit on every outbound text (posts, edits, messages — ticket 18 integration), server +4 tools (get/set/bootstrap_voice_profile, audit_draft — local tools, available in read-only mode), bin wires FileVoiceProfileStore. Tests: 3 store + 5 audit + 5 server (incl. the audit visible in the plan preview for both clean and machine drafts); full suite 153/153 via `npm run check`. Review: 1 fix applied — the in-memory store's bootstrap hardcoded 'none'/'short' and diverged from production; shared deriveVoiceProfile now guarantees identical behavior.
