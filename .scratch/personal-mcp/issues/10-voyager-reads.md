# 10 — Voyager reads

**What to build:** the read side of the transport: `get_me`, `get_profile`, `get_posts`, `get_conversations`, `get_connections_summary`, `get_jobs`, `get_analytics` — tested by replaying recorded Voyager fixtures offline.

**Blocked by:** 07 — Project scaffold + transport seam.

**Status:** ready-for-agent

- [ ] All seven read tools work against recorded Voyager fixtures with no network access
- [ ] Every read goes through the transport seam
- [ ] Responses map to clean tool output — no raw internal response shapes leak to the agent
