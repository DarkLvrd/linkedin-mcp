/**
 * The humanized content layer (ticket 18): a per-user voice profile that
 * governs all outbound text, multi-user by design — never hard-coded to the
 * author. The server audits drafts against AI tells; it never rewrites them.
 */

export interface VoiceProfile {
  userId: string;
  tone: string;
  vocabularyDo: string[];
  vocabularyAvoid: string[];
  emoji: 'none' | 'sparing' | 'freely';
  sentenceLength: 'short' | 'mixed' | 'long';
  personalStories: string[];
  notes: string;
  updatedAt: string;
}

export interface VoiceProfileStore {
  get(userId: string): VoiceProfile | undefined;
  set(profile: VoiceProfile): void;
  /** Derives a starting profile from the user's past posts. */
  bootstrap(userId: string, samples: string[]): VoiceProfile;
}
