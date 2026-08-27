# 11 — SDUI profile + skills

**What to build:** the write side of profile management: `update_profile`, `add_skill`, `remove_skill`, `reorder_skills` (top-skills via the About form), and `delete_ghost_entry` — edits addressed by stable URN, every delete routed through SDUI.

**Blocked by:** 07 — Project scaffold + transport seam; 08 — Selector/endpoint registry; 10 — Voyager reads.

**Status:** ready-for-agent

- [ ] `update_profile` edits headline/about/sections by stable URN and verifies by read-back
- [ ] `add_skill`, `remove_skill`, `reorder_skills` work (top-skills via the About form) and verify by read-back
- [ ] `delete_ghost_entry` removes entries that standard deletes miss, via SDUI endpoints
- [ ] No Voyager `DELETE` is used anywhere in the write path
