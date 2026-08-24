# 02 — Architecture design

Type: grilling
Status: open
Blocked by: 01

## Question

Lock the architecture of the server, within the settled direction of a transport split (Voyager reads, browser writes) with a session/pacing engine as the spine.

- **Transport split**: which capabilities go via Voyager vs browser? (Depends on what research ticket 01 — Voyager API constraints — reports.)
- **Selector registry**: schema, storage, and the update-without-redeploy mechanism; the multi-strategy lookup order (aria-label → role → data-test → visible text → structural); how a failure artifact (screenshot/DOM dump) feeds an auto-diagnosis that repairs the registry.
- **Session/pacing engine**: write quotas, sign-in scheduling around the authwall, graceful re-auth, and the browser-transport lifecycle.
- **Reliable posting**: fast compose, verify-after-post with dedupe, timeout-safe flows (never double-post).

Work with `/grilling` and `/domain-modeling`; capture any hard-to-reverse calls as ADRs.
