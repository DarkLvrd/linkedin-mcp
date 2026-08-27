# 18 — Voice profiles + audit

**What to build:** the humanized content layer: per-user `voice_profile` (multi-user by design, bootstrapped from past posts or a short interview), `audit_draft` (the AI-tell scan returning suggested fixes, never rewrites), and the audit result shown in the posting preview.

**Blocked by:** 07 — Project scaffold + transport seam; 13 — Reliable posting.

**Status:** ready-for-agent

- [ ] `get_voice_profile` / `set_voice_profile` work per user; a new user can bootstrap from past posts or a short interview
- [ ] `audit_draft` flags AI tells (inflated claims, formulaic structure, em-dash overuse, chatbot phrasing) and returns suggested fixes, never rewrites
- [ ] Drafts in the posting flow show their audit result in the preview
- [ ] Audit rules are tested against sample human-written and machine-written texts
