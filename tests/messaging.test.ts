import { describe, expect, it } from 'vitest';
import { LinkedInHttpClient } from '../src/voyager/client.js';
import { fixtureFetch } from './fixtures/fetch.js';
import type { SessionCookies } from '../src/session/types.js';

const cookies: SessionCookies = {
  li_at: 'AQED-x',
  jsessionid: 'ajax:1',
  csrfToken: 'ajax:1',
  obtainedAt: '2026-08-24T12:00:00.000Z',
};

const MESSAGES = '/voyager/api/messaging/messengerMessages';
const CONVERSATION = 'urn:li:msg_conversation:500';

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

describe('send_message (originToken idempotency)', () => {
  it('sends with a generated idempotency key and the documented body shape', async () => {
    const recorded: RecordedRequest[] = [];
    const client = makeClient({ [MESSAGES]: {} }, recorded);
    const result = await client.sendMessage(CONVERSATION, 'Hello there');
    expect(result.ok).toBe(true);
    const send = recorded.find((r) => r.url.includes('action=createMessage'));
    expect(send?.method).toBe('POST');
    const body = JSON.parse(send?.body ?? '{}');
    expect(body.message.body.text).toBe('Hello there');
    expect(body.message.conversationUrn).toBe(CONVERSATION);
    expect(body.dedupeByClientGeneratedToken).toBe(false);
    expect(typeof body.originToken).toBe('string');
    expect(body.originToken).toHaveLength(36); // uuid
    expect(result.originToken).toBe(body.originToken);
    // trackingId must be 16 raw latin-1 bytes, not base64 (research ticket 01).
    expect(Buffer.from(body.trackingId, 'latin1')).toHaveLength(16);
  });

  it('a retry with the same originToken never mints a new key', async () => {
    const recorded: RecordedRequest[] = [];
    const client = makeClient({ [MESSAGES]: {} }, recorded);
    const token = 'a4c7f1e0-0000-4000-8000-000000000000';
    await client.sendMessage(CONVERSATION, 'Hello there', token);
    await client.sendMessage(CONVERSATION, 'Hello there', token);
    const sends = recorded.filter((r) => r.url.includes('action=createMessage'));
    expect(sends).toHaveLength(2);
    const bodies = sends.map((s) => JSON.parse(s.body ?? '{}'));
    expect(bodies[0].originToken).toBe(token);
    expect(bodies[1].originToken).toBe(token);
  });

  it('throws when the send fails', async () => {
    const failingFetch: typeof fetch = async () => new Response('nope', { status: 500 });
    const client = new LinkedInHttpClient({ cookies, baseUrl: 'https://www.linkedin.com', fetchFn: failingFetch });
    await expect(client.sendMessage(CONVERSATION, 'Hello there')).rejects.toThrow(/send failed/);
  });
});

describe('recall / react / history', () => {
  it('recallMessage POSTs the recall action with the message id', async () => {
    const recorded: RecordedRequest[] = [];
    const client = makeClient({ [MESSAGES]: {} }, recorded);
    await expect(client.recallMessage(CONVERSATION, 'urn:li:msg_event:11')).resolves.toEqual({ ok: true });
    const recall = recorded.find((r) => r.url.includes('action=recall'));
    expect(recall?.method).toBe('POST');
    expect(JSON.parse(recall?.body ?? '{}').messageId).toBe('urn:li:msg_event:11');
  });

  it('reactToMessage POSTs the emoji reaction', async () => {
    const recorded: RecordedRequest[] = [];
    const client = makeClient({ [MESSAGES]: {} }, recorded);
    await expect(client.reactToMessage(CONVERSATION, 'urn:li:msg_event:11', '👍')).resolves.toEqual({ ok: true });
    const reaction = recorded.find((r) => r.url.includes('action=reactWithEmoji'));
    expect(JSON.parse(reaction?.body ?? '{}').emoji).toBe('👍');
  });

  it('getConversationHistory maps events into clean shapes', async () => {
    const HISTORY = `/voyager/api/messaging/conversations/${CONVERSATION}/events`;
    const client = makeClient(
      {
        [HISTORY]: {
          elements: [
            {
              urn: 'urn:li:msg_event:11',
              from: { urn: 'urn:li:member:7' },
              body: { message: { text: 'Hello there' } },
              createdAt: 1780000000000,
            },
          ],
        },
      },
      [],
    );
    const events = await client.getConversationHistory(CONVERSATION, 25);
    expect(events).toEqual([
      {
        id: 'urn:li:msg_event:11',
        senderUrn: 'urn:li:member:7',
        text: 'Hello there',
        sentAt: '2026-05-28T20:26:40.000Z',
      },
    ]);
  });
});
