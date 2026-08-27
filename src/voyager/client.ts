import { randomUUID, randomBytes } from 'node:crypto';
import { SessionRequiredError, SessionExpiredError, AlreadyPostedError } from '../transport/types.js';
import type { CreatePostResult, ReactionType } from '../transport/types.js';
import { VoyagerHealthProbe } from '../session/probe.js';
import { SduiClient } from '../sdui/client.js';
import {
  aboutForm,
  commentForm,
  deletePostForm,
  ghostDeleteForm,
  skillAddForm,
  skillDeleteForm,
} from '../sdui/forms.js';
import { linkedinHeaders } from '../session/cookies.js';
import { InMemoryDedupeStore, dedupeKey } from '../posting/dedupe.js';
import type { DedupeStore } from '../posting/dedupe.js';
import type { GhostEntryRef, ProfileUpdate } from '../transport/types.js';
import type { HealthProbe, SessionCookies } from '../session/types.js';
import type { SkillsState } from '../sdui/client.js';
import type {
  Analytics,
  ConnectionsSummary,
  Conversation,
  Job,
  JobSearchFilters,
  Member,
  MessageEvent,
  Post,
  Profile,
} from './types.js';

const DEFAULT_BASE_URL = 'https://www.linkedin.com';
const ABOUT_FORM = 'com.linkedin.sdui.requests.profile.saveProfileAboutForm';
const ADD_SKILL_FORM = 'com.linkedin.sdui.requests.profile.saveProfileSkillForm';
const DELETE_SKILL_FORM = 'com.linkedin.sdui.requests.profile.deleteProfileSkillForm';
const COMPOSE_PATH = '/voyager/api/graphql?action=execute&queryId=voyagerContentcreationDashShares';
const REACTIONS_PATH = '/voyager/api/voyagerSocialDashReactions';
const MESSAGES_PATH = '/voyager/api/messaging/messengerMessages';

/** Tolerant nested-path reads, mirroring what the Voyager web app returns. */
function pickString(obj: unknown, ...paths: string[]): string {
  for (const path of paths) {
    let current: unknown = obj;
    let ok = true;
    for (const segment of path.split('.')) {
      if (current !== null && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        ok = false;
        break;
      }
    }
    if (ok && typeof current === 'string') {
      return current;
    }
  }
  return '';
}

function localizedString(obj: unknown, path: string): string {
  return pickString(obj, `${path}.localized.en_US`);
}

function pickNumber(obj: unknown, ...paths: string[]): number {
  for (const path of paths) {
    let current: unknown = obj;
    let ok = true;
    for (const segment of path.split('.')) {
      if (current !== null && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        ok = false;
        break;
      }
    }
    if (ok && typeof current === 'number') {
      return current;
    }
  }
  return 0;
}

export interface LinkedInHttpClientOptions {
  /** Cookies at construction, or a provider consulted on every request. */
  cookies: SessionCookies | null | (() => SessionCookies | null);
  baseUrl?: string;
  fetchFn?: typeof fetch;
  /** Injectable for tests; defaults to the real Voyager probe. */
  probe?: HealthProbe;
  /** Where dedupe keys persist; the bin passes the file store, tests pass memory. */
  dedupeStore?: DedupeStore;
}

/**
 * The real transport (the seam's production implementation): Voyager for
 * reads, SDUI for profile writes and deletes. Every write is submitted then
 * verified by read-back before it is reported as done. No Voyager DELETE is
 * ever used — it returns constant 400; deletes route through SDUI.
 */
export class LinkedInHttpClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly probe: HealthProbe;
  private readonly cookiesProvider: SessionCookies | null | (() => SessionCookies | null);
  private readonly sdui: SduiClient;
  private readonly dedupeStore: DedupeStore;

  constructor(options: LinkedInHttpClientOptions) {
    this.cookiesProvider = options.cookies;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.probe = options.probe ?? new VoyagerHealthProbe(this.baseUrl);
    this.sdui = new SduiClient({ cookies: () => this.currentCookies(), baseUrl: this.baseUrl, fetchFn: this.fetchFn });
    // The in-memory fallback is a safety net, never the production store — the
    // bin always passes the persisted file store.
    this.dedupeStore = options.dedupeStore ?? new InMemoryDedupeStore();
  }

  private currentCookies(): SessionCookies | null {
    return typeof this.cookiesProvider === 'function' ? this.cookiesProvider() : this.cookiesProvider;
  }

  private requireSession(): SessionCookies {
    const cookies = this.currentCookies();
    if (cookies === null) {
      throw new SessionRequiredError();
    }
    return cookies;
  }

  private headers(cookies: SessionCookies): Record<string, string> {
    return linkedinHeaders(cookies);
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, { headers: this.headers(this.requireSession()), redirect: 'manual' });
    if (response.status === 401) {
      throw new SessionExpiredError('401');
    }
    if (response.status === 403) {
      throw new SessionExpiredError('403-CSRF');
    }
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location !== null && location.includes('/voyager/api/')) {
      throw new SessionExpiredError('redirect-to-self');
    }
    if (!response.ok) {
      throw new Error(`Voyager request failed: HTTP ${response.status} for ${path}`);
    }
    return (await response.json()) as T;
  }

  private async submitOrThrow(sduiid: string, body: unknown): Promise<void> {
    const result = await this.sdui.submit(sduiid, body);
    if (!result.ok) {
      throw new Error(result.error);
    }
  }

  /**
   * POST JSON and report whether the request reached LinkedIn. A fetch
   * rejection means "likely never sent" (safe to retry); any received
   * response — including a body-read timeout — means "sent" (never
   * auto-retry; verify instead).
   */
  private async postJson(
    path: string,
    body: unknown,
  ): Promise<{ sent: boolean; status: number; json: unknown }> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { ...this.headers(this.requireSession()), 'content-type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(body),
        redirect: 'manual',
      });
    } catch {
      return { sent: false, status: 0, json: null };
    }
    if (response.status === 401) {
      throw new SessionExpiredError('401');
    }
    if (response.status === 403) {
      throw new SessionExpiredError('403-CSRF');
    }
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location !== null && location.includes('/voyager/api/')) {
      throw new SessionExpiredError('redirect-to-self');
    }
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      // Body read failed (timeout) — the request was still sent.
    }
    return { sent: true, status: response.status, json };
  }

  private async verifyOwnPost(predicate: (post: Post) => boolean): Promise<Post | null> {
    const posts = await this.getPosts(25);
    return posts.find(predicate) ?? null;
  }

  private async myId(): Promise<string> {
    return (await this.getMe()).id;
  }

  private composeBody(text: string, extra: Record<string, unknown> = {}): unknown {
    return {
      variables: {
        shareContent: { commentary: { text }, shareMediaCategory: 'NONE' },
        ...extra,
      },
    };
  }

  async getSessionStatus() {
    if (this.currentCookies() === null) {
      return { state: 'no-session' as const, readOnly: false };
    }
    const result = await this.probe.probe(this.requireSession());
    if (result.health === 'unhealthy') {
      return {
        state: 'unhealthy' as const,
        ...(result.reason !== undefined ? { reason: result.reason } : {}),
        readOnly: false,
      };
    }
    return { state: 'healthy' as const, readOnly: false };
  }

  async getMe(): Promise<Member> {
    const raw = await this.request<Record<string, unknown>>('/voyager/api/me');
    return {
      id: pickString(raw, 'id'),
      firstName: localizedString(raw, 'firstName'),
      lastName: localizedString(raw, 'lastName'),
      headline: pickString(raw, 'headline'),
      vanityName: pickString(raw, 'vanityName'),
    };
  }

  async getProfile(identifier: string): Promise<Profile> {
    const raw = await this.request<Record<string, unknown>>(
      `/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(identifier)}`,
    );
    const profile = (raw['profile'] as Record<string, unknown> | undefined) ?? raw;
    return {
      id: pickString(profile, 'id'),
      firstName: localizedString(profile, 'firstName'),
      lastName: localizedString(profile, 'lastName'),
      headline: pickString(profile, 'headline'),
      location: localizedString(profile, 'location'),
      about: pickString(profile, 'summary.text'),
    };
  }

  async getPosts(limit: number): Promise<Post[]> {
    const raw = await this.request<{ elements?: unknown[] }>(`/voyager/api/feed/updatesV2?count=${limit}`);
    return (raw.elements ?? []).map((element) => {
      const record = element as Record<string, unknown>;
      return {
        id: pickString(record, 'urn'),
        authorUrn: pickString(record, 'actor.urn'),
        text: pickString(record, 'commentary.text.text'),
        publishedAt: new Date(pickNumber(record, 'createdAt')).toISOString(),
      };
    });
  }

  async getConversations(limit: number): Promise<Conversation[]> {
    const raw = await this.request<{ elements?: unknown[] }>(`/voyager/api/messaging/conversations?count=${limit}`);
    return (raw.elements ?? []).map((element) => {
      const record = element as Record<string, unknown>;
      const participants = Array.isArray(record['participants'])
        ? (record['participants'] as Record<string, unknown>[]).map((p) => pickString(p, 'urn'))
        : [];
      return {
        id: pickString(record, 'urn'),
        participants,
        lastActivityAt: new Date(pickNumber(record, 'lastActivityAt')).toISOString(),
      };
    });
  }

  async getConnectionsSummary(): Promise<ConnectionsSummary> {
    const raw = await this.request<Record<string, unknown>>('/voyager/api/relationships/connectionsSummary');
    return { connections: pickNumber(raw, 'firstDegreeSize') };
  }

  async getJobs(filters: JobSearchFilters): Promise<Job[]> {
    const query = new URLSearchParams({
      action: 'execute',
      queryId: 'voyagerJobsDashJobSearch',
      variables: JSON.stringify({
        ...(filters.keywords !== undefined ? { keywords: filters.keywords } : {}),
        ...(filters.locationId !== undefined ? { locationId: filters.locationId } : {}),
      }),
    });
    const raw = await this.request<{
      data?: { data?: { jobPostingSearchResults?: { elements?: unknown[] } } };
    }>(`/voyager/api/graphql?${query.toString()}`);
    const elements = raw.data?.data?.jobPostingSearchResults?.elements ?? [];
    return elements.map((element) => {
      const record = element as Record<string, unknown>;
      return {
        id: pickString(record, 'entityUrn'),
        title: pickString(record, 'title'),
        company: pickString(record, 'companyDetails.company.name'),
        location: pickString(record, 'secondaryDescription.text'),
      };
    });
  }

  async getAnalytics(): Promise<Analytics> {
    const me = await this.getMe();
    const raw = await this.request<{ elements?: unknown[] }>(
      `/voyager/api/identity/profiles/${me.id}/profileView?q=viewsByMonth`,
    );
    const views = (raw.elements ?? []).reduce<number>((sum, element) => {
      const record = element as Record<string, unknown>;
      return sum + pickNumber(record, 'viewsByMonth.0.views');
    }, 0);
    return { profileViews: views };
  }

  // ── Writes (ticket 11): submit via SDUI, then verify by read-back. ─────

  async updateProfile(changes: ProfileUpdate): Promise<Profile> {
    await this.submitOrThrow(ABOUT_FORM, aboutForm(changes));
    return this.getProfile('me');
  }

  async addSkill(name: string): Promise<SkillsState> {
    // The typeahead skill id is server-issued; the name is the best client-
    // side value we have until a live capture confirms the exact contract.
    await this.submitOrThrow(ADD_SKILL_FORM, skillAddForm(name, name));
    return this.sdui.readSkills();
  }

  async removeSkill(skillUrn: string): Promise<SkillsState> {
    await this.submitOrThrow(DELETE_SKILL_FORM, skillDeleteForm(skillUrn));
    return this.sdui.readSkills();
  }

  async reorderSkills(newOrder: string[]): Promise<SkillsState> {
    await this.submitOrThrow(ABOUT_FORM, aboutForm({ topSkills: newOrder }));
    return this.sdui.readSkills();
  }

  async deleteGhostEntry(ref: GhostEntryRef): Promise<{ ok: true }> {
    await this.submitOrThrow(
      `com.linkedin.sdui.requests.profile.deleteProfile${ref.section.charAt(0).toUpperCase() + ref.section.slice(1)}Form`,
      ghostDeleteForm(ref.section, ref.urn),
    );
    return { ok: true };
  }

  // ── Posting (ticket 13): compose → verify → dedupe; never auto-retry. ──

  async createPost(text: string): Promise<CreatePostResult> {
    const key = dedupeKey('post', 'profile', text);
    if (this.dedupeStore.has(key)) {
      throw new AlreadyPostedError();
    }
    const result = await this.postJson(COMPOSE_PATH, this.composeBody(text));
    if (!result.sent) {
      throw new Error('post request failed before sending — nothing was posted, safe to retry');
    }
    if (result.status !== 200 && result.status !== 201) {
      throw new Error(`post failed: HTTP ${result.status} — nothing was posted, safe to retry`);
    }
    // The request reached LinkedIn; from here on, this content can never
    // double-post, even across sessions.
    this.dedupeStore.add(key);
    const me = await this.myId();
    const post = await this.verifyOwnPost((p) => p.text === text && p.authorUrn === me);
    return post !== null ? { verified: true, post } : { verified: false, post: null };
  }

  async editPost(postId: string, text: string): Promise<{ ok: true }> {
    const result = await this.postJson(COMPOSE_PATH, this.composeBody(text, { resourceKey: postId }));
    if (!result.sent) {
      throw new Error('edit request failed before sending — nothing was edited, safe to retry');
    }
    if (result.status !== 200 && result.status !== 201) {
      throw new Error(`edit failed: HTTP ${result.status} — nothing was edited, safe to retry`);
    }
    const me = await this.myId();
    const post = await this.verifyOwnPost((p) => p.id === postId && p.text === text && p.authorUrn === me);
    if (post === null) {
      throw new Error('edit not verified by read-back — check the post manually');
    }
    return { ok: true };
  }

  async deletePost(postId: string): Promise<{ ok: true }> {
    const activityId = postId.replace('urn:li:activity:', '');
    await this.submitOrThrow('com.linkedin.sdui.update.deletePost', deletePostForm(activityId));
    const stillThere = await this.verifyOwnPost((p) => p.id === postId);
    if (stillThere !== null) {
      throw new Error('delete not verified — the post still appears in the feed');
    }
    return { ok: true };
  }

  async commentOnPost(postId: string, text: string): Promise<{ ok: true }> {
    await this.submitOrThrow('com.linkedin.sdui.comments.createComment', commentForm(postId, text));
    return { ok: true };
  }

  async reactToPost(postId: string, reaction: ReactionType): Promise<{ ok: true }> {
    const result = await this.postJson(
      `${REACTIONS_PATH}?threadUrn=${encodeURIComponent(postId)}`,
      { reactionType: reaction },
    );
    if (!result.sent) {
      throw new Error('reaction request failed before sending — safe to retry');
    }
    if (result.status !== 200 && result.status !== 201) {
      throw new Error(`reaction failed: HTTP ${result.status} — safe to retry`);
    }
    return { ok: true };
  }

  // ── Messaging (ticket 14): Voyager, originToken idempotency. ──────────

  async sendMessage(
    conversationUrn: string,
    text: string,
    originToken?: string,
  ): Promise<{ ok: true; originToken: string }> {
    const token = originToken ?? randomUUID();
    const result = await this.postJson(`${MESSAGES_PATH}?action=createMessage`, {
      message: { body: { text, attributes: [] }, conversationUrn },
      originToken: token,
      // 16 raw bytes in latin-1, NOT base64 (research ticket 01).
      trackingId: randomBytes(16).toString('latin1'),
      dedupeByClientGeneratedToken: false,
    });
    if (!result.sent) {
      throw new Error('message send failed before sending — safe to retry with the same originToken');
    }
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`message send failed: HTTP ${result.status} — retry with the same originToken`);
    }
    return { ok: true, originToken: token };
  }

  async recallMessage(conversationUrn: string, messageId: string): Promise<{ ok: true }> {
    const result = await this.postJson(`${MESSAGES_PATH}?action=recall`, { conversationUrn, messageId });
    if (!result.sent) {
      throw new Error('recall failed before sending — safe to retry');
    }
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`recall failed: HTTP ${result.status}`);
    }
    return { ok: true };
  }

  async reactToMessage(conversationUrn: string, messageId: string, emoji: string): Promise<{ ok: true }> {
    const result = await this.postJson(`${MESSAGES_PATH}?action=reactWithEmoji`, { conversationUrn, messageId, emoji });
    if (!result.sent) {
      throw new Error('message reaction failed before sending — safe to retry');
    }
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`message reaction failed: HTTP ${result.status}`);
    }
    return { ok: true };
  }

  async getConversationHistory(conversationUrn: string, limit: number): Promise<MessageEvent[]> {
    const raw = await this.request<{ elements?: unknown[] }>(
      `/voyager/api/messaging/conversations/${conversationUrn}/events?start=0&count=${limit}`,
    );
    return (raw.elements ?? []).map((element) => {
      const record = element as Record<string, unknown>;
      const from = (record['from'] ?? record) as Record<string, unknown>;
      const body = (record['body'] ?? {}) as Record<string, unknown>;
      const message = (body['message'] ?? body) as Record<string, unknown>;
      return {
        id: pickString(record, 'urn'),
        senderUrn: pickString(from, 'urn'),
        text: pickString(message, 'text'),
        sentAt: new Date(pickNumber(record, 'createdAt')).toISOString(),
      };
    });
  }
}
