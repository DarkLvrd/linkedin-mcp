# Context — Personal LinkedIn MCP

The shared vocabulary of this effort. Terms are resolved during wayfinder charting and domain-modeling; add new ones as they crystallise.

## Glossary

- **agent-executed LinkedIn** — the destination: an MCP server that lets an AI agent do everything a person can do on LinkedIn. The user describes what they want; the agent executes it; the user never touches the site.
- **never breaks** — the product headline. The server keeps working when LinkedIn changes its DOM (self-healing selectors) and never locks the user out (session hygiene).
- **authwall** — LinkedIn's anti-automation challenge, triggered after ~2–3 browser writes per sign-in. Resolved by a fresh sign-in before more writes.
- **write quota** — LinkedIn's server-side write ceiling (~60/hour), plus the stricter per-sign-in browser write budget behind the authwall.
- **transport split** — the resilience architecture: reads and most writes go over HTTP (Voyager + SDUI); a browser is used only for sign-in and for the few writes that need a page context.
- **selector registry** — the data-driven store of DOM selectors, updatable without redeploying the server.
- **self-healing selector** — a lookup that tries multiple strategies (aria-label → role → data-test → visible text → structural) and repairs itself from failure artifacts when LinkedIn changes its DOM.
- **ghost entry** — a profile entry that persists even though it cannot be deleted through the available transports.
- **humanized content** — posts and comments that read like the user wrote them, via the humanize-writing and linkedin-posts knowledge.
- **dry-run / diff preview** — observability before any write: show what would change, then execute only on approval.
- **browserless-first** — the posture: the server talks to LinkedIn over plain HTTP (Voyager + SDUI); a browser is used only for sign-in and for the few writes that need a page context.
- **verify-after-post** — after a write, the server reads back what it wrote and confirms it landed; the read-back is the single source of truth, never the response code.
- **write gate** — every write requires approval (dry-run / diff preview) before it executes.
- **plan-then-execute** — the agent first shows an ordered plan list of all intended writes with previews; nothing executes until the user approves the whole plan.
- **failure artifact** — screenshot, DOM dump, and diagnostics captured when a lookup or write fails; session values are redacted, never written to disk.
