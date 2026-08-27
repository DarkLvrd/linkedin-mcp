# linkedin-mcp

The LinkedIn MCP that **never breaks**.

An MCP server that gives an AI agent everything a person can do on LinkedIn:
you describe what you want, the agent executes it, and you never touch the site.

- **Self-healing** — selector/endpoint registry as data; repairs itself when LinkedIn changes its DOM
- **Session hygiene** — human-like pacing, write budgets, graceful re-auth; never locks you out
- **Reliable posting** — verify-after-post, no double-posts
- **Humanized content** — per-user voice profiles; everything reads like you wrote it
- **Observable** — plan-then-execute, diff previews, redacted failure artifacts

Install: `npx agentic-linkedin` (package pending publish).

Status: design complete, spec in progress — see `.scratch/personal-mcp/map.md` for the wayfinder map.
