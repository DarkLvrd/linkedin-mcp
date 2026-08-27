import { describe, expect, it } from 'vitest';
import { LinkedInHttpClient } from '../src/voyager/client.js';
import { AlreadyPostedError } from '../src/transport/types.js';
import { InMemoryDedupeStore, dedupeKey } from '../src/posting/dedupe.js';
import { fixtureFetch } from './fixtures/fetch.js';
import type { SessionCookies } from '../src/session/types.js';

const cookies: SessionCookies = {
  li_at: 'AQED-x',
  jsessionid: 'ajax:1',
  csrfToken: 'ajax:1',
  obtainedAt: '2026-08-24T12:00:00.000Z',
};

const ME = {
  id: 'urn:li:member:42',
  firstName: { localized: { en_US: 'Muizz' } },
  lastName: { localized: { en_US: 'Bankole' } },
  headline: 'Engineer',
  vanityName: 'muizzbankole',
};

const POSTS_WITH_HELLO = {
  elements: [
    {
      urn: 'urn:li:activity:100',
      actor: { urn: 'urn:li:member:42' },
      commentary: { text: { text: 'Hello LinkedIn!' } },
      createdAt: 1780000000000,
    },
  ],
};

const COMPOSE = '/voyager/api/graphql?action=execute&queryId=voyagerContentcreationDashShares';

interface RecordedRequest {
  url: string;
  method: string;
  body?: string;
}

function makeClient(fixtures: Record<string, unknown>, recorded: RecordedRequest[]) {
  const recordingFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    recorded.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
    return fixtureFetch(fixtures)(input, init);
  };
  return new LinkedInHttpClient({
    cookies,
    baseUrl: 'https://www.linkedin.com',
    fetchFn: recordingFetch,
    dedupeStore: new InMemoryDedupeStore(),
  });
}

describe('create_post (reliable posting)', () => {
  it('publishes via the compose endpoint and verifies by read-back', async () => {
    const recorded: RecordedRequest[] = [];
    const client = makeClient(
      {
        [COMPOSE]: {},
        '/voyager/api/feed/updatesV2': POSTS_WITH_HELLO,
        '/voyager/api/me': ME,
      },
      recorded,
    );
    const result = await client.createPost('Hello LinkedIn!');
    expect(result).toEqual({
      verified: true,
      post: {
        id: 'urn:li:activity:100',
        authorUrn: 'urn:li:member:42',
        text: 'Hello LinkedIn!',
        publishedAt: '2026-05-28T20:26:40.000Z',
      },
    });
    // The compose request carried the post text and went to the compose query.
    const compose = recorded.find((r) => r.url.includes('voyagerContentcreationDashShares'));
    expect(compose?.method).toBe('POST');
    expect(JSON.parse(compose?.body ?? '{}').variables.shareContent.commentary.text).toBe('Hello LinkedIn!');
  });

  it('reports verified:false when the read-back cannot find the post (never guesses)', async () => {
    const client = makeClient(
      {
        [COMPOSE]: {},
        '/voyager/api/feed/updatesV2': { elements: [] },
        '/voyager/api/me': ME,
      },
      [],
    );
    const result = await client.createPost('Hello LinkedIn!');
    expect(result).toEqual({ verified: false, post: null });
  });

  it('writes the dedupe key once the request reached LinkedIn — no double-post ever', async () => {
    const recorded: RecordedRequest[] = [];
    const client = makeClient(
      {
        [COMPOSE]: {},
        '/voyager/api/feed/updatesV2': { elements: [] },
        '/voyager/api/me': ME,
      },
      recorded,
    );
    const key = dedupeKey('post', 'profile', 'Hello LinkedIn!');
    await client.createPost('Hello LinkedIn!');
    // Second attempt with the same content is refused before any request.
    await expect(client.createPost('Hello LinkedIn!')).rejects.toThrow(AlreadyPostedError);
    expect(recorded.filter((r) => r.url.includes('voyagerContentcreationDashShares'))).toHaveLength(1);
  });

  it('writes no dedupe key when the request never reached LinkedIn — safe to retry', async () => {
    const failingFetch: typeof fetch = async () => {
      throw new Error('connection refused');
    };
    const store = new InMemoryDedupeStore();
    const client = new LinkedInHttpClient({
      cookies,
      baseUrl: 'https://www.linkedin.com',
      fetchFn: failingFetch,
      dedupeStore: store,
    });
    await expect(client.createPost('Hello LinkedIn!')).rejects.toThrow(/nothing was posted/);
    expect(store.has(dedupeKey('post', 'profile', 'Hello LinkedIn!'))).toBe(false);
  });
});

describe('edit / delete / comment / react', () => {
  const DELETE_POST = '?sduiid=com.linkedin.sdui.update.deletePost';
  const CREATE_COMMENT = '?sduiid=com.linkedin.sdui.comments.createComment';
  const RSC = '/flagship-web/rsc-action/actions/server-request';
  const REACTIONS = '/voyager/api/voyagerSocialDashReactions';
  const POSTS_EMPTY = { elements: [] };
  const POSTS_WITH_EDITED = {
    elements: [
      {
        urn: 'urn:li:activity:100',
        actor: { urn: 'urn:li:member:42' },
        commentary: { text: { text: 'Edited text' } },
        createdAt: 1780000000000,
      },
    ],
  };

  it('editPost submits the compose endpoint and verifies the edited text by read-back', async () => {
    const recorded: RecordedRequest[] = [];
    const client = makeClient(
      { [COMPOSE]: {}, '/voyager/api/feed/updatesV2': POSTS_WITH_EDITED, '/voyager/api/me': ME },
      recorded,
    );
    await expect(client.editPost('urn:li:activity:100', 'Edited text')).resolves.toEqual({ ok: true });
    const edit = recorded.find((r) => r.url.includes('voyagerContentcreationDashShares'));
    expect(JSON.parse(edit?.body ?? '{}').variables.resourceKey).toBe('urn:li:activity:100');
  });

  it('editPost throws when the read-back cannot confirm the edit', async () => {
    const client = makeClient({ [COMPOSE]: {}, '/voyager/api/feed/updatesV2': POSTS_EMPTY, '/voyager/api/me': ME }, []);
    await expect(client.editPost('urn:li:activity:100', 'Edited text')).rejects.toThrow(/edit not verified/);
  });

  it('deletePost routes through SDUI and verifies the post is gone', async () => {
    const recorded: RecordedRequest[] = [];
    const client = makeClient(
      { [RSC + DELETE_POST]: {}, '/voyager/api/feed/updatesV2': POSTS_EMPTY },
      recorded,
    );
    await expect(client.deletePost('urn:li:activity:100')).resolves.toEqual({ ok: true });
    expect(recorded.some((r) => r.url.includes('deletePost'))).toBe(true);
  });

  it('deletePost throws when the post still appears after the delete', async () => {
    const client = makeClient(
      { [RSC + DELETE_POST]: {}, '/voyager/api/feed/updatesV2': POSTS_WITH_HELLO },
      [],
    );
    await expect(client.deletePost('urn:li:activity:100')).rejects.toThrow(/delete not verified/);
  });

  it('commentOnPost submits the SDUI comment form', async () => {
    const client = makeClient({ [RSC + CREATE_COMMENT]: {} }, []);
    await expect(client.commentOnPost('urn:li:activity:100', 'Nice!')).resolves.toEqual({ ok: true });
  });

  it('reactToPost POSTs the reaction with the reactionType body', async () => {
    const recorded: RecordedRequest[] = [];
    const client = makeClient({ [REACTIONS]: {} }, recorded);
    await expect(client.reactToPost('urn:li:activity:100', 'LIKE')).resolves.toEqual({ ok: true });
    const reaction = recorded.find((r) => r.url.includes('voyagerSocialDashReactions'));
    expect(JSON.parse(reaction?.body ?? '{}').reactionType).toBe('LIKE');
  });
});
