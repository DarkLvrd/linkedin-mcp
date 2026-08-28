import { describe, expect, it } from 'vitest';
import { buildPreview } from '../src/planning/preview.js';
import { FakeTransport } from '../src/transport/fake.js';

describe('buildPreview', () => {
  const transport = new FakeTransport({ state: 'healthy' });

  it('update_profile shows a field-level old → new diff', async () => {
    const preview = await buildPreview(transport, 'update_profile', {
      headline: 'New headline',
      about: 'New about',
    });
    expect(preview.kind).toBe('profile-diff');
    expect(preview.summary).toContain('New headline');
    expect(preview.diff?.fields).toEqual(
      expect.arrayContaining([
        { field: 'headline', old: 'Tester', new: 'New headline' },
        { field: 'about', old: 'Testing things.', new: 'New about' },
      ]),
    );
    expect(preview.raw).toEqual({ headline: 'New headline', about: 'New about' });
  });

  it('update_profile with topSkills lists them as the new value', async () => {
    const preview = await buildPreview(transport, 'update_profile', { topSkills: ['TypeScript'] });
    expect(preview.diff?.fields).toEqual(
      expect.arrayContaining([{ field: 'topSkills', new: 'TypeScript' }]),
    );
  });

  it('create_post renders a feed-style preview with the author name', async () => {
    const preview = await buildPreview(transport, 'create_post', { text: 'Hello LinkedIn!' });
    expect(preview.kind).toBe('rendered');
    expect(preview.rendered).toEqual({
      type: 'post',
      author: 'Test User',
      text: 'Hello LinkedIn!',
    });
    expect(preview.raw).toEqual({ text: 'Hello LinkedIn!' });
  });

  it('send_message renders a message preview with the target conversation', async () => {
    const preview = await buildPreview(transport, 'send_message', {
      conversationUrn: 'urn:li:msg_conversation:500',
      text: 'Hello there',
    });
    expect(preview.rendered).toEqual({
      type: 'message',
      text: 'Hello there',
      target: 'urn:li:msg_conversation:500',
    });
  });

  it('other tools get a generic preview with the raw args', async () => {
    const preview = await buildPreview(transport, 'add_skill', { name: 'TypeScript' });
    expect(preview.kind).toBe('generic');
    expect(preview.summary).toContain('add_skill');
    expect(preview.raw).toEqual({ name: 'TypeScript' });
  });
});
