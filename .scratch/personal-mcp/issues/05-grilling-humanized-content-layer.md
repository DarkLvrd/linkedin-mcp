# 05 — Humanized content layer

Type: grilling
Status: resolved
Blocked by: 02 (resolved)

## Comments

Resolved by grilling with the user (2026-08-24). Q1–Q4 settled; Q1 added a hard requirement: the voice system must work for any user, not just the author (multi-user by design, zero AI vibe).

## Answer

1. **Voice profile** — per-user, multi-user by design ("works for everyone, not just me"): a structured profile file (tone, vocabulary do/don'ts, emoji habits, sentence length, personal stories pool, no-AI-tell checklist), editable via an MCP tool. Bootstrapped from the user's own past posts or a short onboarding interview — nothing hard-coded to the author. The "no AI vibe at all" guarantee is the core requirement.
2. **Writing intelligence** — the agent writes; the server audits: a rule-based pass scans any draft for AI tells (inflated significance, formulaic structure, em-dash overuse, chatbot phrasing, robotic rhythm) and returns suggested fixes, never rewrites. The server stays a tool, not a writer — the package stays light and the LLM choice stays with the agent.
3. **Flow** — integrated: a draft is the first step of the normal posting pipeline; it appears in the plan-then-execute plan list with its audit result attached to the rendered preview (ticket 04), and publishes through verify-after-post (ticket 02).
4. **Scope** — all outbound text: posts, comments, replies, messages, connection notes. One voice profile per user governs everything that leaves the account.
