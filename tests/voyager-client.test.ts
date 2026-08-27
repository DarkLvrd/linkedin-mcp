import { describe, expect, it } from 'vitest';
import { VoyagerClient } from '../src/voyager/client.js';
import { SessionRequiredError } from '../src/transport/types.js';
import { fixtureFetch } from './fixtures/fetch.js';
import type { SessionCookies } from '../src/session/types.js';

const cookies: SessionCookies = {
  li_at: 'AQED-x',
  jsessionid: 'ajax:1',
  csrfToken: 'ajax:1',
  obtainedAt: '2026-08-24T12:00:00.000Z',
};

const fixtures = {
  '/voyager/api/me': (await import('./fixtures/voyager/me.json')).default,
  '/voyager/api/identity/dash/profiles': (await import('./fixtures/voyager/profile.json')).default,
  '/voyager/api/feed/updatesV2': (await import('./fixtures/voyager/posts.json')).default,
  '/voyager/api/messaging/conversations': (await import('./fixtures/voyager/conversations.json')).default,
  '/voyager/api/relationships/connectionsSummary': (await import('./fixtures/voyager/connections-summary.json')).default,
  '/voyager/api/graphql': (await import('./fixtures/voyager/jobs.json')).default,
  '/voyager/api/identity/profiles/urn:li:member:42/profileView': (await import('./fixtures/voyager/analytics.json')).default,
};

function makeClient() {
  return new VoyagerClient({
    cookies,
    baseUrl: 'https://www.linkedin.com',
    fetchFn: fixtureFetch(fixtures),
  });
}

describe('VoyagerClient reads (fixture-replay, no network)', () => {
  it('maps /me to a clean Member shape', async () => {
    const member = await makeClient().getMe();
    expect(member).toEqual({
      id: 'urn:li:member:42',
      firstName: 'Muizz',
      lastName: 'Bankole',
      headline: 'Engineer',
      vanityName: 'muizzbankole',
    });
  });

  it('maps the profile endpoint to a clean Profile shape', async () => {
    const profile = await makeClient().getProfile('urn:li:member:42');
    expect(profile).toEqual({
      id: 'urn:li:member:42',
      firstName: 'Muizz',
      lastName: 'Bankole',
      headline: 'Engineer',
      location: 'Toronto, Canada',
      about: 'I build things.',
    });
  });

  it('maps the feed to clean Post shapes', async () => {
    const posts = await makeClient().getPosts(25);
    expect(posts).toHaveLength(2);
    expect(posts[0]).toEqual({
      id: 'urn:li:activity:100',
      authorUrn: 'urn:li:member:42',
      text: 'Hello LinkedIn!',
      publishedAt: '2026-05-28T20:26:40.000Z',
    });
  });

  it('maps conversations to clean Conversation shapes', async () => {
    const conversations = await makeClient().getConversations(25);
    expect(conversations[0]).toEqual({
      id: 'urn:li:msg_conversation:500',
      participants: ['urn:li:member:42', 'urn:li:member:7'],
      lastActivityAt: '2026-05-28T20:30:00.000Z',
    });
  });

  it('maps the connections summary', async () => {
    const summary = await makeClient().getConnectionsSummary();
    expect(summary).toEqual({ connections: 137 });
  });

  it('maps the jobs search to clean Job shapes', async () => {
    const jobs = await makeClient().getJobs({ keywords: 'engineer' });
    expect(jobs[0]).toEqual({
      id: 'urn:li:jobPosting:900',
      title: 'Senior Engineer',
      company: 'Acme',
      location: 'Toronto, ON',
    });
  });

  it('maps profile views to analytics', async () => {
    const analytics = await makeClient().getAnalytics();
    expect(analytics).toEqual({ profileViews: 120 });
  });

  it('reports no-session when no cookies are available', async () => {
    const client = new VoyagerClient({
      cookies: null,
      baseUrl: 'https://www.linkedin.com',
      fetchFn: fixtureFetch(fixtures),
    });
    expect(await client.getSessionStatus()).toEqual({ state: 'no-session', readOnly: false });
  });

  it('refuses reads without a session with a clear error', async () => {
    const client = new VoyagerClient({
      cookies: null,
      baseUrl: 'https://www.linkedin.com',
      fetchFn: fixtureFetch(fixtures),
    });
    await expect(client.getMe()).rejects.toThrow(SessionRequiredError);
  });
});
