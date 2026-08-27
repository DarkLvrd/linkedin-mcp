# 15 — Network

**What to build:** the network write tools: `connect` with a note (quota-checked endpoint), `respond_invitation` (accept/ignore/withdraw), `follow`, `endorse_skill`, `remove_connection` — each verified after the write.

**Blocked by:** 10 — Voyager reads; 11 — SDUI profile + skills.

**Status:** resolved (2026-08-24)

- [x] `connect` sends a request with a note via the quota-checked endpoint; a quota rejection surfaces clearly to the user
- [x] `respond_invitation`, `follow`, `endorse_skill`, `remove_connection` work and are verified after the write
- [x] All network writes respect pacing and the write gate

## Answer

Implemented TDD: seam +6 (connectWithNote, respondInvitation, follow, endorseSkill, removeConnection, getInvitations; Invitation domain type; ConnectionQuotaError). LinkedInHttpClient: connect POSTs `voyagerRelationshipsDashMemberRelationships?action=verifyQuotaAndCreateV2` with memberIdentity + customMessage through a new quotaAware postJson mode — 429, and 403 whose body mentions quota, map to ConnectionQuotaError (a plain 403 still means session-expired); 2xx from the quota-checked endpoint IS the verification. respondInvitation routes accept/ignore/withdraw through the SDUI mynetwork invitation-action family and verifies by invitation read-back (still present → error). follow: person via SDUI addaUpdateFollowState, company via Voyager `feed/dash/followingStates/{urn}` patch. endorseSkill + removeConnection via SDUI (endorseSkill, RemoveConnectionVanityName). getInvitations reads invitationViews into clean shapes. SDUI forms +4 (invitationActionForm, followPersonForm, endorseSkillForm, removeConnectionForm). FakeTransport + PacedTransport extended; server +6 tools (connect, respond_invitation, follow, endorse_skill, remove_connection — write-gated; get_invitations — read), action/kind enums validated. Tests: 10 client (connect body + 429 + 403-quota + plain-403-session, accept verified, accept-unverified error, withdraw, person/company follow, endorse+remove, invitations mapping) + 4 server; full suite 108/108 via `npm run check`. Review: no fixes; 1 noted limitation — follow/endorse/remove verify at the HTTP layer (2xx) because no read-back exists for following state or endorsements; add with the manual smoke. get_invitations was added (not in the ticket) because invitations must be discoverable to respond — serves the slice.
