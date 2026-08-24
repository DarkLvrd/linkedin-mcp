# Map — Personal LinkedIn MCP (agent-executed LinkedIn)

Label: wayfinder:map

## Destination

An installable, open-source MCP server that gives an AI agent everything a person can do on LinkedIn: the user describes what they want, and the agent executes it — the user never touches the site. It **never breaks**: self-healing against LinkedIn's DOM churn, never locks the user out (session hygiene), never double-posts. Built on the six gaps discovered with the bridge (see Notes), delivered as spec → tickets → implementation. Personal use first; GitHub + possible sale later.

Reaching the end of this map = the way to that destination is clear and no decisions remain; then hand off to `/to-spec`.

## Notes

- **Domain**: LinkedIn automation via MCP. Every session should consult: `wayfinder` (primary), `grilling`, `domain-modeling`, `research`, `prototype`, `to-spec`, `to-tickets`, `implement` (drives `tdd` + `code-review`), `setup-matt-pocock-skills`.
- **Prior evidence — do not re-interview the user about it, refer by ticket name not id**: handoff `C:\Users\chevo\AppData\Local\Temp\personal-mcp-handoff.md`; ops log `C:\Users\chevo\dev\linkedin-profile\applied.md`; patched selectors at `C:\Users\chevo\AppData\Local\npm-cache\_npx\f47d141da18a3eba\node_modules\linkedin-mcp-bridge\dist\browser\selectors.js` (backup `.bak`). Proof material: `voice-summaries`, `mechanics-site`, `millwright-ad`, `hide-hunt`.
- **Settled during charting (2026-08-24)**: destination = agent-executed LinkedIn, LinkedIn-only; headline = "never breaks" (session hygiene + self-healing selectors); v1 capability cut = profile + posts/comments + messages + connections + jobs-read + analytics; stack = TypeScript/Node; distribution direction = public repo, MIT core, paid tier as fog, names decided late; architecture direction = transport split (Voyager reads, browser writes) with a session/pacing engine.
- **Standing preferences**: plan, don't do (decisions, not deliverables); never resolve more than one ticket per session (research tickets excepted); refer to tickets by name, never bare id.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

## Not yet specified

- **Coverage beyond the v1 cut**: groups, company pages, events, ads, jobs-apply — feasibility and priority once v1 ships.
- **Monetization/positioning if sold**: paid tier shape, pricing, open-core boundary.
- **Testing strategy**: fixtures vs live DOM; CI against LinkedIn DOM churn.
- **npm publish mechanics**: login (task ticket), release automation — graduates from the distribution ticket.

## Out of scope

- **Multi-platform (X, YouTube, Behance)** — decided LinkedIn-only during charting: multiplies auth, DOM, and API surface by N; returns only if the destination is redrawn.
- **Fork-and-patch the bridge as the destination** — ruled out when the destination was confirmed as a new installable server; the patched selector is evidence, not the product.
