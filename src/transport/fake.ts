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
} from '../voyager/types.js';
import type { SkillsState } from '../sdui/client.js';
import type {
  CreatePostResult,
  GhostEntryRef,
  LinkedInTransport,
  ProfileUpdate,
  ReactionType,
  SessionStatus,
} from './types.js';

export interface FakeTransportOptions {
  state: SessionStatus['state'];
  reason?: SessionStatus['reason'];
  readOnly?: boolean;
  reads?: {
    me?: Member;
    profile?: Profile;
    posts?: Post[];
    conversations?: Conversation[];
    connectionsSummary?: ConnectionsSummary;
    jobs?: Job[];
    analytics?: Analytics;
  };
}

/**
 * In-memory transport for tests and offline development. Implements the full
 * LinkedInTransport contract — the read methods return canned data, overridable
 * per test — so nothing about a real LinkedIn session leaks into it.
 */
export class FakeTransport implements LinkedInTransport {
  private readonly status: SessionStatus;
  private readonly reads: NonNullable<FakeTransportOptions['reads']>;

  constructor(options: FakeTransportOptions) {
    this.status = {
      state: options.state,
      ...(options.reason !== undefined ? { reason: options.reason } : {}),
      readOnly: options.readOnly ?? false,
    };
    this.reads = {
      me: { id: 'urn:li:member:42', firstName: 'Test', lastName: 'User', headline: 'Tester', vanityName: 'testuser' },
      profile: {
        id: 'urn:li:member:42',
        firstName: 'Test',
        lastName: 'User',
        headline: 'Tester',
        location: 'Testville',
        about: 'Testing things.',
      },
      posts: [],
      conversations: [],
      connectionsSummary: { connections: 0 },
      jobs: [],
      analytics: { profileViews: 0 },
      ...options.reads,
    };
  }

  getSessionStatus(): Promise<SessionStatus> {
    return Promise.resolve(this.status);
  }

  getMe(): Promise<Member> {
    return Promise.resolve(this.reads.me!);
  }

  getProfile(): Promise<Profile> {
    return Promise.resolve(this.reads.profile!);
  }

  getPosts(): Promise<Post[]> {
    return Promise.resolve(this.reads.posts!);
  }

  getConversations(): Promise<Conversation[]> {
    return Promise.resolve(this.reads.conversations!);
  }

  getConnectionsSummary(): Promise<ConnectionsSummary> {
    return Promise.resolve(this.reads.connectionsSummary!);
  }

  getJobs(_filters: JobSearchFilters): Promise<Job[]> {
    return Promise.resolve(this.reads.jobs!);
  }

  getAnalytics(): Promise<Analytics> {
    return Promise.resolve(this.reads.analytics!);
  }

  updateProfile(changes: ProfileUpdate): Promise<Profile> {
    const profile = this.reads.profile!;
    return Promise.resolve({
      ...profile,
      ...(changes.headline !== undefined ? { headline: changes.headline } : {}),
      ...(changes.about !== undefined ? { about: changes.about } : {}),
    });
  }

  addSkill(name: string): Promise<SkillsState> {
    return Promise.resolve({ skills: [{ name, urn: 'urn:li:fsd_profileSkill:fake' }] });
  }

  removeSkill(): Promise<SkillsState> {
    return Promise.resolve({ skills: [] });
  }

  reorderSkills(newOrder: string[]): Promise<SkillsState> {
    return Promise.resolve({ skills: newOrder.map((name, index) => ({ name, urn: `urn:li:fsd_profileSkill:${index}` })) });
  }

  deleteGhostEntry(_ref: GhostEntryRef): Promise<{ ok: true }> {
    return Promise.resolve({ ok: true });
  }

  createPost(text: string): Promise<CreatePostResult> {
    return Promise.resolve({ verified: true, post: { id: 'urn:li:activity:new', authorUrn: 'urn:li:member:42', text, publishedAt: '2026-05-28T20:26:40.000Z' } });
  }

  editPost(): Promise<{ ok: true }> {
    return Promise.resolve({ ok: true });
  }

  deletePost(): Promise<{ ok: true }> {
    return Promise.resolve({ ok: true });
  }

  commentOnPost(): Promise<{ ok: true }> {
    return Promise.resolve({ ok: true });
  }

  reactToPost(_postId: string, _reaction: ReactionType): Promise<{ ok: true }> {
    return Promise.resolve({ ok: true });
  }

  sendMessage(_conversationUrn: string, _text: string, originToken?: string): Promise<{ ok: true; originToken: string }> {
    return Promise.resolve({ ok: true, originToken: originToken ?? '00000000-0000-4000-8000-000000000000' });
  }

  recallMessage(): Promise<{ ok: true }> {
    return Promise.resolve({ ok: true });
  }

  reactToMessage(): Promise<{ ok: true }> {
    return Promise.resolve({ ok: true });
  }

  getConversationHistory(): Promise<MessageEvent[]> {
    return Promise.resolve([]);
  }
}
