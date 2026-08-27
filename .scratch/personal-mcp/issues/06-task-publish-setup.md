# 06 — Publish setup

Type: task
Status: resolved
Blocked by: none

## Comments

2026-08-24: items 2 and 3 done — repo `DarkLvrd/linkedin-mcp` created (public, MIT LICENSE), `main` pushed, `origin` wired. Item 1 (npm login) pending the user's action.

2026-08-24: item 1 done — user ran `npm login`; verified with `npm whoami` → `darklvrd`. All three items complete.

## Question

Manual work that must happen before publishing can be exercised (graduated from the fog by ticket 03 — Distribution and naming):

1. **npm login** on this machine (HITL — only the user can do this; `npm login`).
2. **Create the GitHub repo** `DarkLvrd/linkedin-mcp` (public, MIT license) and push `main` (the agent can drive this via `gh repo create`).
3. Wire the local repo remote to it.

Resolved when all three are done. The answer records what was done and any facts later tickets depend on (npm account name, repo URL). Release automation design stays fog until v1 code exists.

## Answer

All three items done (2026-08-24):

1. npm login — done by user; verified `npm whoami` → **darklvrd** (this machine is now authorized to publish).
2. GitHub repo — **https://github.com/DarkLvrd/linkedin-mcp** (public, MIT LICENSE, README).
3. Remote wired — `origin` → https://github.com/DarkLvrd/linkedin-mcp.git, `main` tracks `origin/main`.

Facts later tickets depend on: repo URL above; npm account `darklvrd`; package name `agentic-linkedin` (name reserved on npm, not yet published). Release automation design stays fog until v1 code exists.
