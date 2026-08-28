import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VoiceProfile, VoiceProfileStore } from './types.js';

const EMOJI = /[\p{Extended_Pictographic}]/u;

function averageWordsPerSentence(samples: string[]): number {
  const sentences = samples
    .flatMap((sample) => sample.split(/(?<=[.!?])\s+/))
    // Emoji-only fragments after a period are decorations, not sentences.
    .filter((sentence) => /[\p{L}]/u.test(sentence));
  if (sentences.length === 0) {
    return 0;
  }
  const words = sentences.reduce((sum, sentence) => sum + sentence.split(/\s+/).filter((w) => w.length > 0).length, 0);
  return words / sentences.length;
}

function emojiPerHundredWords(samples: string[]): number {
  const text = samples.join(' ');
  const words = text.split(/\s+/).filter((w) => w.length > 0).length;
  const emoji = (text.match(EMOJI) ?? []).length;
  return words === 0 ? 0 : (emoji / words) * 100;
}

/** Shared derivation — every store bootstraps identically. */
export function deriveVoiceProfile(userId: string, samples: string[]): VoiceProfile {
  const wordsPerSentence = averageWordsPerSentence(samples);
  const emojiRate = emojiPerHundredWords(samples);
  return {
    userId,
    tone: 'derived from your sample posts — tune it with set_voice_profile',
    vocabularyDo: [],
    vocabularyAvoid: [],
    emoji: emojiRate > 2 ? 'freely' : emojiRate > 0 ? 'sparing' : 'none',
    sentenceLength: wordsPerSentence < 12 ? 'short' : wordsPerSentence > 22 ? 'long' : 'mixed',
    personalStories: [],
    notes: `bootstrapped from ${samples.length} sample post(s) on ${new Date().toISOString()}`,
    updatedAt: new Date().toISOString(),
  };
}

export class FileVoiceProfileStore implements VoiceProfileStore {
  constructor(private readonly dir: string) {}

  get(userId: string): VoiceProfile | undefined {
    try {
      return JSON.parse(readFileSync(join(this.dir, `${encodeURIComponent(userId)}.json`), 'utf8')) as VoiceProfile;
    } catch {
      return undefined;
    }
  }

  set(profile: VoiceProfile): void {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(join(this.dir, `${encodeURIComponent(profile.userId)}.json`), JSON.stringify(profile, null, 2));
  }

  bootstrap(userId: string, samples: string[]): VoiceProfile {
    const profile = deriveVoiceProfile(userId, samples);
    this.set(profile);
    return profile;
  }
}

/** In-memory voice profile store for tests — identical bootstrap derivation. */
export class InMemoryVoiceProfileStore implements VoiceProfileStore {
  private readonly profiles = new Map<string, VoiceProfile>();

  get(userId: string): VoiceProfile | undefined {
    return this.profiles.get(userId);
  }

  set(profile: VoiceProfile): void {
    this.profiles.set(profile.userId, profile);
  }

  bootstrap(userId: string, samples: string[]): VoiceProfile {
    const profile = deriveVoiceProfile(userId, samples);
    this.set(profile);
    return profile;
  }
}
