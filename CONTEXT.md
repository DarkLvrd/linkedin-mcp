# Context — Personal LinkedIn MCP

The shared vocabulary of this effort. Terms are resolved during wayfinder charting and domain-modeling; add new ones as they crystallise.

## Glossary

- **agent-executed LinkedIn** — the destination: an MCP server that lets an AI agent do everything a person can do on LinkedIn. The user describes what they want; the agent executes it; the user never touches the site.
- **never breaks** — the product headline. The server keeps working when LinkedIn changes its DOM (self-healing selectors) and never locks the user out (session hygiene).
- **authwall** — LinkedIn's anti-automation challenge, triggered after ~2–3 browser writes per sign-in. Resolved by a fresh sign-in before more writes.
- **write quota** — LinkedIn's server-side write ceiling (~60/hour), plus the stricter per-sign-in browser write budget behind the authwall.
- **transport split** — the resilience architecture: reads via the Voyager API, writes via a browser transport, with a session/pacing engine managing sign-in bursts.
- **selector registry** — the data-driven store of DOM selectors, updatable without redeploying the server.
- **self-healing selector** — a lookup that tries multiple strategies (aria-label → role → data-test → visible text → structural) and repairs itself from failure artifacts when LinkedIn changes its DOM.
- **ghost entry** — a profile entry that persists even though it cannot be deleted through the available transports.
- **humanized content** — posts and comments that read like the user wrote them, via the humanize-writing and linkedin-posts knowledge.
- **dry-run / diff preview** — observability before any write: show what would change, then execute only on approval.
