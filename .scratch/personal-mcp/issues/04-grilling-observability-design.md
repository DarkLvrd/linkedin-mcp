# 04 — Observability design

Type: grilling
Status: open
Blocked by: 02

## Question

Design the observability layer (gap #6): what the user sees before, during, and after agent-executed actions.

- **Dry-run mode**: simulate a whole session of writes without executing any.
- **Diff previews**: show exactly what will change on the profile before a write lands.
- **Failure artifacts**: screenshots, DOM dumps, and diagnostics captured when something breaks — and how they feed the selector registry's self-healing loop.

Work with `/grilling` and `/domain-modeling`; depends on the architecture from ticket 02 — Architecture design.
