# 14 — Messaging

**What to build:** `send_message` with `originToken` idempotency (retries never double-send), `recall_message`, `react_to_message`, conversation list, and history — all Voyager, fixture-tested.

**Blocked by:** 10 — Voyager reads.

**Status:** resolved (2026-08-24)

- [x] `send_message` sends with an idempotency key; a retry with the same key never double-sends
- [x] `recall_message`, `react_to_message`, conversation list, and history work against fixtures
- [x] Messaging tools are gated and paced like all other writes

## Answer

Implemented TDD: seam +4 (sendMessage, recallMessage, reactToMessage, getConversationHistory; MessageEvent domain type), LinkedInHttpClient: send_message POSTs `voyagerMessagingDashMessengerMessages?action=createMessage` with the documented body (message + conversationUrn, originToken = client uuid — reuse-safe idempotency key, trackingId = 16 raw latin-1 bytes NOT base64, dedupeByClientGeneratedToken: false — research ticket 01); returns the originToken so a retry passes it back and LinkedIn dedupes; recall (?action=recall), react (?action=reactWithEmoji), history (GET conversations/{urn}/events → clean MessageEvent shapes). FakeTransport + PacedTransport extended (the three messaging writes are gated and paced; history is a read). Server: send_message (originToken surfaced), recall_message, react_to_message, get_conversation_history. Tests: 6 client (token generation + shape, retry-key stability, failure, recall body, emoji body, history mapping) + 4 server (registration, originToken surfaced, all four tools, read-only block); full suite 94/94 via `npm run check`. Review: no fixes; 1 judgement call — the 2xx check repeats in three messaging methods while posting methods check 200/201 deliberately (per research); extraction deferred. Fix during implementation: `MessageEvent` collided with the global web-API type in transport/types.ts (missing import) — caught by tsc, imported our own.
