# 09 — Auth bootstrap

**What to build:** sign in once through the stealth browser window, persist the session, restore it across restarts, and report session health honestly.

**Blocked by:** 07 — Project scaffold + transport seam; 08 — Selector/endpoint registry.

**Status:** ready-for-agent

- [ ] A `login` flow opens a browser window; after the user signs in once, the session persists to disk
- [ ] On restart, the server restores the session without a new sign-in
- [ ] `session_status` reports healthy/unhealthy using the health probes (401, 403-CSRF, redirect-to-self)
- [ ] Session values never appear in logs or artifacts
