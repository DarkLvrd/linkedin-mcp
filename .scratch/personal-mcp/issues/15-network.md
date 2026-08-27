# 15 — Network

**What to build:** the network write tools: `connect` with a note (quota-checked endpoint), `respond_invitation` (accept/ignore/withdraw), `follow`, `endorse_skill`, `remove_connection` — each verified after the write.

**Blocked by:** 10 — Voyager reads; 11 — SDUI profile + skills.

**Status:** ready-for-agent

- [ ] `connect` sends a request with a note via the quota-checked endpoint; a quota rejection surfaces clearly to the user
- [ ] `respond_invitation`, `follow`, `endorse_skill`, `remove_connection` work and are verified after the write
- [ ] All network writes respect pacing and the write gate
