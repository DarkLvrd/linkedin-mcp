import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileVoiceProfileStore } from '../src/voice/store.js';
import type { VoiceProfile } from '../src/voice/types.js';

function makeStore() {
  const dir = mkdtempSync(join(tmpdir(), 'voice-'));
  const store = new FileVoiceProfileStore(dir);
  return { dir, store };
}

const profile: VoiceProfile = {
  userId: 'urn:li:member:42',
  tone: 'direct and practical',
  vocabularyDo: ['build', 'ship'],
  vocabularyAvoid: ['delve', 'unlock'],
  emoji: 'sparing',
  sentenceLength: 'short',
  personalStories: [],
  notes: 'tuned by hand',
  updatedAt: '2026-08-24T12:00:00.000Z',
};

describe('FileVoiceProfileStore', () => {
  it('stores and retrieves a voice profile per user', () => {
    const { dir, store } = makeStore();
    try {
      expect(store.get('urn:li:member:42')).toBeUndefined();
      store.set(profile);
      expect(store.get('urn:li:member:42')).toEqual(profile);
      // Another user has no profile — profiles never bleed across users.
      expect(store.get('urn:li:member:7')).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('persists profiles across store instances', () => {
    const dir = mkdtempSync(join(tmpdir(), 'voice-'));
    try {
      new FileVoiceProfileStore(dir).set(profile);
      const second = new FileVoiceProfileStore(dir);
      expect(second.get('urn:li:member:42')?.tone).toBe('direct and practical');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('bootstraps emoji and sentence-length from sample posts', () => {
    const { dir, store } = makeStore();
    try {
      const emojiHeavy = store.bootstrap('urn:li:member:1', [
        'We shipped the entire feature today and the whole team is buzzing about it, so tomorrow we start on the mobile app which everyone has been waiting for. 🚀 🔥',
      ]);
      expect(emojiHeavy.emoji).toBe('freely');
      expect(emojiHeavy.sentenceLength).toBe('long');
      expect(emojiHeavy.notes).toContain('bootstrapped');

      const plain = store.bootstrap('urn:li:member:2', ['Shipped it. Tests pass. On to the next thing.']);
      expect(plain.emoji).toBe('none');
      expect(plain.sentenceLength).toBe('short');
      expect(store.get('urn:li:member:2')).toEqual(plain);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
