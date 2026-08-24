# Research 01 — Voyager API constraints

Resolved by the research subagent during wayfinder charting (2026-08-24), on branch `research/01-voyager-api-constraints`.
Question: what does LinkedIn's Voyager (internal REST) API allow, per capability — reads, writes, and limits?

## Headline

LinkedIn's frontend talks to **two private backend APIs**, both reachable with a logged-in session:

- **Voyager** — `/voyager/api/...` (REST.li + GraphQL): reads, plus a browserless-friendly write family (post-create, like, all messaging, connect, follow-company, save/unsave, delete-repost).
- **SDUI** — `/flagship-web/rsc-action/...` (Server-Driven UI, protobuf-JSON): profile edits (all 16 sections), comments, unlike, delete-post, endorse, remove-connection. Some SDUI writes replayable browserless via a `states[]` payload trick; others require a browser context.

Rule of thumb (from the reference project): *if it works over Voyager, use it (stable, no browser); fall back to SDUI only when Voyager fails.* Note the mixed patterns: create-post = Voyager, delete-post = SDUI; like = Voyager, unlike = SDUI.

## Verified endpoint map (primary source: mguttmann/linkedin-internal-api, captured from live traffic)

### Engagement / posts
| Operation | Layer | Endpoint | Browserless |
|---|---|---|---|
| Like a post | Voyager | `POST voyagerSocialDashReactions?threadUrn={urn}` `{reactionType:LIKE}` | ✅ HTTP 201 |
| Unlike | SDUI | `com.linkedin.sdui.reactions.delete` | ⚠️ HTTP 500 (browser) |
| Create post | Voyager GQL | `graphql?action=execute&queryId=voyagerContentcreationDashShares.<hash>` | ✅ HTTP 200 |
| Edit post | Voyager GQL | `voyagerContentcreationDashShares.<hash>` + `resourceKey`/`updateUrn` | ✅ |
| Delete post | SDUI | `com.linkedin.sdui.update.deletePost` (activityId + trackingId) | ✅ (browser-capture) |
| Post media (image/video) | Voyager | `POST voyagerVideoDashMediaUploadMetadata?action=upload` → PUT → `Shares` | ✅ |
| Link preview, @mention, polls | Voyager | `voyagerContentcreationDashUpdateUrlPreview.<hash>` etc. | ✅ |
| Read own posts (full text) | Voyager GQL | `voyagerFeedDashProfileUpdates.<hash>` | ✅ (also the verify-after-post hook) |
| Read comments | Voyager | `GET feed/comments?q=comments&updateId={urn}` | ✅ |
| Create / delete comment | SDUI | `com.linkedin.sdui.comments.createComment` / `deleteComment` | ⚠️ (browser) |
| Repost / instant repost | SDUI | `com.linkedin.sdui.feed.requests.createInstantRepost` | ⚠️ HTTP 500 |
| Delete repost | Voyager GQL | `voyagerFeedDashReposts` (delete-by-key) | ✅ |
| Save / unsave post | SDUI | `com.linkedin.sdui.update.saveState` (`isSaved` toggle) | ✅ HTTP 200 |

### Messaging (all Voyager, browserless-friendly)
- Send: `POST voyagerMessagingDashMessengerMessages?action=createMessage` — body carries `originToken` (client UUID), documented as a **reuse-safe idempotency key that prevents double-send**. `trackingId` = 16 raw bytes (latin-1, NOT base64), `dedupeByClientGeneratedToken:false`.
- Recall (delete): `?action=recall` (→ 204). React emoji: `?action=reactWithEmoji`. Mark read: `voyagerMessagingDashMessengerConversations?ids=List(...)` `patch.$set.read`. List: `GET voyagerMessagingGraphQL/graphql messengerConversations.<hash>`.

### Network
- Connect (with note): `POST voyagerRelationshipsDashMemberRelationships?action=verifyQuotaAndCreateV2` + `customMessage` — **LinkedIn's own quota check is built into this endpoint**.
- Accept / ignore invitation: SDUI `mynetwork` invitation-action family. Follow company: `POST feed/dash/followingStates/{urn}` `patch.$set.following` (Voyager). Follow person: SDUI `addaUpdateFollowState`. Endorse skill: SDUI `endorseSkill` (vanityName + profileId + skillId). Remove connection: SDUI `RemoveConnectionVanityName`. Reads: `relationships/invitationViews`, `sentInvitationViews`, `connectionsSummary` (all Voyager).

### Profile editing (SDUI — the `saveProfile<X>Form` / `deleteProfile<X>` family, 16 sections)
- Universal pattern: `POST /flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.requests.profile.saveProfile<Section>Form`. Sections include skills (`saveProfileSkillForm`), about (`saveProfileAboutForm`), experience (`saveProfilePositionForm`), education, honors, publications, courses, etc.
- **Skills**: add + delete **verified live** (`saveProfileSkillForm`, `deleteProfileSkillForm`; test skill added then removed). Read-back via `fetchSkillsCollection`.
- **Top-skills / reorder**: top-skills live inside the About form (`saveProfileAboutForm` — a re-orderable top-skills picker; needs `states[]` literals for browserless replay). LinkedIn Help confirms **only Education and Skills sections are reorderable**, max 100 skills.
- **Browserless replay breakthrough**: SDUI profile forms carry `MemoryNamespace` state-refs AND a top-level `states[]` array with real literal values — a `saveProfileLanguageForm` create was replayed from pure HTTP → **HTTP 200, live profile change** (docs/BROWSERLESS-REPLAY.md). Some SDUI writes still 500 without a browser (page-bound context).
- **Services page**: NOT documented by any third-party source ("N/A — not offered on this account"); the bridge's services/project edit form 404s. Remains an open, empirically-hard gap → browser probing needed.

### Jobs & analytics
- Jobs: reads via Voyager GraphQL (search/feed/detail, saved/applied lists — bridge + docs/27). **Apply is not documented** as a write; treat as read-only for v1.
- Analytics: profile view counts via `/identity/dash/profiles` profileView (bridge `getAnalytics`); post impressions via `voyagerFeedDashProfileUpdates`.

## Session, limits, and failure taxonomy

- **Rate limiting**: HTTP 429 documented as "anticipated, never seen" by the reference project; their guardrail is pacing ("no mass automation, no loops over strangers"). The ~**60 writes/hour** server-side quota and the **authwall after ~2–3 browser writes per sign-in** are **empirical observations from our own bridge sessions** (handoff + applied.md), not third-party figures.
- **Failure taxonomy (agreed across bridge + reference project)**: 403 = CSRF missing → set `csrf-token` header from JSESSIONID; 401 = session dead → `/me` probe; 302-redirect-to-self = session being challenged; Voyager `DELETE` on reactions returns **constant HTTP 400** (LinkedIn removes reactions only via SDUI) — the likely mechanism behind our **ghost entries** (no third-party doc covers ghost entries; our bridge session observed them empirically).
- **Browserless vs bot-management**: devag7/linkedin-mcp reports Cloudflare bot-management rejects plain HTTP (endless redirect) in 2026; mguttmann proves pure-`requests` writes work with **fresh session cookies** (li_at + JSESSIONID + csrf header). Reconciliation: fresh cookies + realistic headers/pacing work browserless; stale or cookie-less requests get challenged. A stealth browser (patchright, `navigator.webdriver=false`) is the session source and stays logged in across restarts.
- **GraphQL query-id hashes rotate on LinkedIn deploys** — endpoints break without notice (mguttmann disclaimer). This is the empirical argument for the **self-healing registry**: selector/endpoint lookup must be data-driven and repairable, not hard-coded.

## What this means for our map (feeds ticket 02 — Architecture design)

1. **Transport split is finer than "reads API / writes browser"**: Voyager handles most writes browserless (post-create, like, messaging, connect, follow-company); SDUI handles profile edits + comments + unlike + delete-post + endorse + remove-connection, and many SDUI writes are replayable browserless via `states[]`. The browser is a fallback, not the write path.
2. **Reliable posting is solvable**: create-post via Voyager GQL; verify-after-post via `voyagerFeedDashProfileUpdates` read-back; messaging has a documented idempotency key (`originToken`) — posts have **no documented idempotency key**, so never-double-post needs local dedupe + verify-after-post.
3. **Complete write coverage is tractable**: the `saveProfile<X>Form` family covers 16 sections incl. skills add/delete; top-skills via About form; ghost entries likely stem from the Voyager-DELETE-400 pattern → route deletes through SDUI. Services page is the one genuinely undocumented area.
4. **Session hygiene is the hard, differentiating part**: authwall/quota are empirical and stricter than any third-party account; pacing engine + per-sign-in write budgets + graceful re-auth are where the "never breaks / never locks you out" headline is won.
5. **Guardrail precedent**: the reference project gates every write behind `confirm=True` and ships a `LINKEDIN_READ_ONLY=1` mode — direct support for our dry-run/diff observability gap.
6. **New competitor surfaced**: mguttmann/linkedin-internal-api (Python/FastMCP, 26 tools, browserless-first, honest docs, Oct 2025–active) — not in the handoff's competitor list; it's the strongest reference for architecture AND a serious competitor for the "best MCP" goal.

## Sources

- **mguttmann/linkedin-internal-api** (primary; cloned at `C:\tmp\pi-github-repos\mguttmann\linkedin-internal-api`): README, docs/00-OVERVIEW, 02-VOYAGER-API, 04-WRITE-OPERATIONS, 06-MESSAGING, 08-NETWORK, 09-PROFILE-EDITING, 10-POST-INTERACTIONS, 21-PROFILE-ABOUT, 24-POST-ADVANCED, 25-NETWORK-PROFILE-ACTIONS, BROWSERLESS-REPLAY, SESSION-AND-ERRORS-DESIGN, tools/_endpoints_writes.md
- **linkedin-mcp-bridge v1.0.6** (local: npm-cache path in the handoff): `dist/voyager/client.js`, `dist/domains/*` — empirical read-endpoint map + browser write paths (headline via `withIntroForm`, skills via `/in/{id}/details/skills/`)
- **tomquirk/linkedin-api** v2.3.1 (pypi.org/project/linkedin-api) — HTTP-only: search people/companies/jobs/posts, send/retrieve messages, send/accept connection requests, get/react to posts
- **LinkedIn Help** — "Add and remove skills" (max 100), "Display Order of Skills" (only Education + Skills reorderable)
- **Microsoft Learn** — UGC Post API (`w_member_social`), Profile Edit API skills (CREATE/PARTIAL_UPDATE/DELETE) — official OAuth APIs needing app approval; not usable for a personal tool without approval
- **devag7/linkedin-mcp** — Cloudflare/bot-management note (plain HTTP rejected)
- **Our own empirical record** — handoff + `C:\Users\chevo\dev\linkedin-profile\applied.md` (60/hr quota, authwall at ~2–3 writes/sign-in, ghost entries, patched selectors)
