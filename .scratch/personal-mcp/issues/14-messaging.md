# 14 — Messaging

**What to build:** `send_message` with `originToken` idempotency (retries never double-send), `recall_message`, `react_to_message`, conversation list, and history — all Voyager, fixture-tested.

**Blocked by:** 10 — Voyager reads.

**Status:** ready-for-agent

- [ ] `send_message` sends with an idempotency key; a retry with the same key never double-sends
- [ ] `recall_message`, `react_to_message`, conversation list, and history work against fixtures
- [ ] Messaging tools are gated and paced like all other writes
