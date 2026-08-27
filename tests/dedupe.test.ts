import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dedupeKey, FileDedupeStore, InMemoryDedupeStore } from '../src/posting/dedupe.js';

describe('dedupe keys', () => {
  it('hashes content + target so identical posts share one key', () => {
    expect(dedupeKey('post', 'profile', 'Hello world')).toBe(dedupeKey('post', 'profile', 'Hello world'));
    expect(dedupeKey('post', 'profile', 'Hello world')).not.toBe(dedupeKey('post', 'profile', 'Hello world!'));
  });
});

describe('InMemoryDedupeStore', () => {
  it('remembers keys added', () => {
    const store = new InMemoryDedupeStore();
    expect(store.has('k1')).toBe(false);
    store.add('k1');
    expect(store.has('k1')).toBe(true);
  });
});

describe('FileDedupeStore', () => {
  it('persists keys across store instances (sessions)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dedupe-'));
    try {
      const path = join(dir, 'posts.json');
      const first = new FileDedupeStore(path);
      first.add('k1');
      const second = new FileDedupeStore(path);
      expect(second.has('k1')).toBe(true);
      expect(second.has('k2')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('treats a missing file as an empty store', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dedupe-'));
    try {
      const store = new FileDedupeStore(join(dir, 'missing.json'));
      expect(store.has('k1')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
