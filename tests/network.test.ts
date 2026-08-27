import { describe, expect, it } from 'vitest';
import { LinkedInHttpClient } from '../src/voyager/client.js';
import { ConnectionQuotaError } from '../src/transport/types.js';
import { fixtureFetch } from './fixtures/fetch.js';
import type { SessionCookies } from '../src/session/types.js';

const cookies: SessionCookies = {
  li_at: 'AQED-x',
  jsessionid: 'ajax:1',
  csrfToken: 'ajax:1',
  obtainedAt: '2026-08-24T12:00:00.000Z',
};

const CONNECT = '/voyager/api/voyagerRelationshipsDashMemberRelationships';
const PROFILE = 'urn:li:member:7';

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
  });
}

describe('connect (quota-checked endpoint)', () => {
  it('POSTs the invite with the note to verifyQuotaAndCreateV2', async () => {
    const recorded: RecordedRequest[] = [];
    const client = makeClient({ [CONNECT]: {} }, recorded);
    await expect(client.connectWithNote(PROFILE, 'Loved your post')).resolves.toEqual({ ok: true });
    const connect = recorded.find((r) => r.url.includes('verifyQuotaAndCreateV2'));
    expect(connect?.method).toBe('POST');
    const body = JSON.parse(connect?.body ?? '{}');
    expect(body.memberIdentity).toBe(PROFILE);
    expect(body.customMessage).toBe('Loved your post');
  });

  it('surfaces an HTTP 429 quota rejection clearly', async () => {
    const quotaFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ message: 'Invitation quota exceeded' }), { status: 429 });
    const client = new LinkedInHttpClient({ cookies, baseUrl: 'https://www.linkedin.com', fetchFn: quotaFetch });
    await expect(client.connectWithNote(PROFILE, 'Hi')).rejects.toThrow(ConnectionQuotaError);
  });

  it('surfaces a 403 with a quota body as a quota error, not a session error', async () => {
    const quotaFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ message: 'Monthly invite quota reached' }), { status: 403 });
    const client = new LinkedInHttpClient({ cookies, baseUrl: 'https://www.linkedin.com', fetchFn: quotaFetch });
    await expect(client.connectWithNote(PROFILE, 'Hi')).rejects.toThrow(ConnectionQuotaError);
  });

  it('still treats a plain 403 as a session problem', async () => {
    const forbiddenFetch: typeof fetch = async () => new Response('forbidden', { status: 403 });
    const client = new LinkedInHttpClient({ cookies, baseUrl: 'https://www.linkedin.com', fetchFn: forbiddenFetch });
    await expect(client.connectWithNote(PROFILE, 'Hi')).rejects.toThrow(/session expired/);
  });
});

describe('respond / follow / endorse / remove / invitations', () => {
  const RSC = '/flagship-web/rsc-action/actions/server-request';
  const ACCEPT = '?sduiid=com.linkedin.sdui.requests.mynetwork.acceptInvitation';
  const WITHDRAW = '?sduiid=com.linkedin.sdui.requests.mynetwork.withdrawInvitation';
  const FOLLOW_PERSON = '?sduiid=com.linkedin.sdui.requests.mynetwork.addaUpdateFollowState';
  const ENDORSE = '?sduiid=com.linkedin.sdui.requests.profile.endorseSkill';
  const REMOVE = '?sduiid=com.linkedin.sdui.mynetwork.RemoveConnectionVanityName';
  const INVITATIONS = '/voyager/api/relationships/invitationViews';
  const FOLLOWING = '/voyager/api/feed/dash/followingStates/urn:li:company:1';

  it('acceptInvitation routes through SDUI and verifies the invitation is gone', async () => {
    const recorded: RecordedRequest[] = [];
    const client = makeClient(
      { [RSC + ACCEPT]: {}, [INVITATIONS]: { elements: [] } },
      recorded,
    );
    await expect(client.respondInvitation('urn:li:invitation:1', 'accept')).resolves.toEqual({ ok: true });
    expect(recorded.some((r) => r.url.includes('acceptInvitation'))).toBe(true);
  });

  it('respondInvitation throws when the invitation still appears after the response', async () => {
    const client = makeClient(
      {
        [RSC + ACCEPT]: {},
        [INVITATIONS]: {
          elements: [
            { entityUrn: 'urn:li:invitation:1', profile: { urn: PROFILE }, sentAt: 1780000000000 },
          ],
        },
      },
      [],
    );
    await expect(client.respondInvitation('urn:li:invitation:1', 'accept')).rejects.toThrow(/not verified/);
  });

  it('withdrawInvitation routes through SDUI', async () => {
    const client = makeClient({ [RSC + WITHDRAW]: {}, [INVITATIONS]: { elements: [] } }, []);
    await expect(client.respondInvitation('urn:li:invitation:1', 'withdraw')).resolves.toEqual({ ok: true });
  });

  it('follows a person via SDUI and a company via the Voyager patch endpoint', async () => {
    const recorded: RecordedRequest[] = [];
    const client = makeClient(
      { [RSC + FOLLOW_PERSON]: {}, [FOLLOWING]: {} },
      recorded,
    );
    await expect(client.follow('urn:li:member:7', 'person', true)).resolves.toEqual({ ok: true });
    await expect(client.follow('urn:li:company:1', 'company', false)).resolves.toEqual({ ok: true });
    const companyFollow = recorded.find((r) => r.url.includes('followingStates'));
    expect(JSON.parse(companyFollow?.body ?? '{}').patch.$set.following).toBe(false);
  });

  it('endorses a skill and removes a connection via SDUI', async () => {
    const client = makeClient({ [RSC + ENDORSE]: {}, [RSC + REMOVE]: {} }, []);
    await expect(client.endorseSkill(PROFILE, 'urn:li:fsd_skill:123', 'someone')).resolves.toEqual({ ok: true });
    await expect(client.removeConnection('someone')).resolves.toEqual({ ok: true });
  });

  it('maps the invitation list into clean shapes', async () => {
    const client = makeClient(
      {
        [INVITATIONS]: {
          elements: [
            { entityUrn: 'urn:li:invitation:1', profile: { urn: PROFILE }, sentAt: 1780000000000 },
          ],
        },
      },
      [],
    );
    const invitations = await client.getInvitations(25);
    expect(invitations).toEqual([
      { id: 'urn:li:invitation:1', profileUrn: PROFILE, sentAt: '2026-05-28T20:26:40.000Z' },
    ]);
  });
});
