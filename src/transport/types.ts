/**
 * The one seam of the server (spec: Testing Decisions).
 *
 * Every LinkedIn capability is reached through this interface. The domain
 * logic above it (pacing, dedupe, verification, planning) is tested against
 * FakeTransport; the real implementations (Voyager client, SDUI client,
 * browser fallback) plug in below it without touching that logic.
 */

import type {
  Analytics,
  ConnectionsSummary,
  Conversation,
  Invitation,
  Job,
  JobSearchFilters,
  Member,
  MessageEvent,
  Post,
  Profile,
} from '../voyager/types.js';
import type { SkillsState } from '../sdui/client.js';

/** The reactions a person can leave on a post (research ticket 01). */
export type ReactionType = 'LIKE' | 'PRAISE' | 'APPRECIATION' | 'EMPATHY' | 'INTEREST' | 'ENTERTAINMENT';

export type SessionState = 'healthy' | 'unhealthy' | 'no-session';

export interface SessionStatus {
  state: SessionState;
  /** Present when the session is unhealthy — e.g. 'authwall', '401', '403-CSRF'. */
  reason?: string;
  readOnly: boolean;
}

/** A read or write was attempted without a sign-in. */
export class SessionRequiredError extends Error {
  constructor() {
    super('no LinkedIn session — run login first');
    this.name = 'SessionRequiredError';
  }
}

/** The session died mid-flight (401, 403-CSRF, or redirect-to-self). */
export class SessionExpiredError extends Error {
  constructor(reason: string) {
    super(`session expired (${reason}) — run login again`);
    this.name = 'SessionExpiredError';
  }
}

/** The dedupe store already holds this content + target — never double-post. */
export class AlreadyPostedError extends Error {
  constructor() {
    super('this content was already posted — refusing to double-post');
    this.name = 'AlreadyPostedError';
  }
}

/** LinkedIn is rate-limiting connection invites (the quota-checked endpoint spoke). */
export class ConnectionQuotaError extends Error {
  constructor() {
    super('connection quota reached — LinkedIn is limiting invites; wait before connecting again');
    this.name = 'ConnectionQuotaError';
  }
}

/** The outcome of create_post: verified by read-back, or honestly unverified. */
export type CreatePostResult = { verified: true; post: Post } | { verified: false; post: null };

/** Profile changes accepted by the About form (ticket 11). */
export interface ProfileUpdate {
  headline?: string;
  about?: string;
  topSkills?: string[];
}

/** A profile entry that standard deletes miss — removed via SDUI. */
export interface GhostEntryRef {
  section: string;
  urn: string;
}

export interface LinkedInTransport {
  /** Probe the current session. Never throws; reports health honestly. */
  getSessionStatus(): Promise<SessionStatus>;
  // Reads (ticket 10). Throw SessionRequiredError / SessionExpiredError when
  // the session is missing or dead.
  getMe(): Promise<Member>;
  getProfile(identifier: string): Promise<Profile>;
  getPosts(limit: number): Promise<Post[]>;
  getConversations(limit: number): Promise<Conversation[]>;
  getConnectionsSummary(): Promise<ConnectionsSummary>;
  getJobs(filters: JobSearchFilters): Promise<Job[]>;
  getAnalytics(): Promise<Analytics>;
  // Writes (ticket 11). Every write verifies by read-back before reporting
  // success; every delete routes through SDUI, never Voyager DELETE.
  updateProfile(changes: ProfileUpdate): Promise<Profile>;
  addSkill(name: string): Promise<SkillsState>;
  removeSkill(skillUrn: string): Promise<SkillsState>;
  reorderSkills(newOrder: string[]): Promise<SkillsState>;
  deleteGhostEntry(ref: GhostEntryRef): Promise<{ ok: true }>;
  // Posting (ticket 13). create_post verifies by read-back and refuses
  // double-posts through the persisted dedupe store; a timeout never
  // auto-retries, it verifies.
  createPost(text: string): Promise<CreatePostResult>;
  editPost(postId: string, text: string): Promise<{ ok: true }>;
  deletePost(postId: string): Promise<{ ok: true }>;
  commentOnPost(postId: string, text: string): Promise<{ ok: true }>;
  reactToPost(postId: string, reaction: ReactionType): Promise<{ ok: true }>;
  // Messaging (ticket 14). Sends carry an originToken idempotency key, so a
  // retry with the same key can never double-send.
  sendMessage(conversationUrn: string, text: string, originToken?: string): Promise<{ ok: true; originToken: string }>;
  recallMessage(conversationUrn: string, messageId: string): Promise<{ ok: true }>;
  reactToMessage(conversationUrn: string, messageId: string, emoji: string): Promise<{ ok: true }>;
  getConversationHistory(conversationUrn: string, limit: number): Promise<MessageEvent[]>;
  // Network (ticket 15). Connect uses the quota-checked endpoint; responses
  // to invitations, follows, and removals are verified where a read-back exists.
  connectWithNote(profileUrn: string, note: string): Promise<{ ok: true }>;
  respondInvitation(invitationUrn: string, action: 'accept' | 'ignore' | 'withdraw'): Promise<{ ok: true }>;
  follow(urn: string, kind: 'person' | 'company', follow: boolean): Promise<{ ok: true }>;
  endorseSkill(profileUrn: string, skillId: string, vanityName: string): Promise<{ ok: true }>;
  removeConnection(vanityName: string): Promise<{ ok: true }>;
  getInvitations(limit: number): Promise<Invitation[]>;
}
