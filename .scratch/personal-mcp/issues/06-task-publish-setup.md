# 06 — Publish setup

Type: task
Status: open
Blocked by: none

## Question

Manual work that must happen before publishing can be exercised (graduated from the fog by ticket 03 — Distribution and naming):

1. **npm login** on this machine (HITL — only the user can do this; `npm login`).
2. **Create the GitHub repo** `DarkLvrd/linkedin-mcp` (public, MIT license) and push `main` (the agent can drive this via `gh repo create`).
3. Wire the local repo remote to it.

Resolved when all three are done. The answer records what was done and any facts later tickets depend on (npm account name, repo URL). Release automation design stays fog until v1 code exists.

## Answer

<!-- filled on resolution -->
