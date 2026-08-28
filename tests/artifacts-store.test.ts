import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileArtifactStore } from '../src/artifacts/store.js';
import type { FailureArtifact } from '../src/artifacts/types.js';

function makeStore() {
  const dir = mkdtempSync(join(tmpdir(), 'artifacts-'));
  const store = new FileArtifactStore(dir);
  return { dir, store };
}

describe('FileArtifactStore', () => {
  it('saves, retrieves, and lists artifacts with id/at/redacted filled in', () => {
    const { dir, store } = makeStore();
    try {
      const saved = store.save({
        kind: 'registry-lookup',
        selectorId: 'feed.startPostButton',
        failedKinds: ['aria-label', 'role'],
      });
      expect(saved.id).toBeTruthy();
      expect(saved.at).toBeTruthy();
      expect(saved.redacted).toBe(true);
      expect(store.get(saved.id)).toEqual(saved);
      expect(store.list()).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('stores HTTP failures with method, path, status, and error', () => {
    const { dir, store } = makeStore();
    try {
      const saved = store.save({
        kind: 'http',
        request: { method: 'POST', path: '/voyager/api/graphql', status: 500, error: 'boom' },
      });
      expect(store.get(saved.id)?.request).toEqual({
        method: 'POST',
        path: '/voyager/api/graphql',
        status: 500,
        error: 'boom',
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('redacts session values from error text — nothing secret ever touches disk', () => {
    const { dir, store } = makeStore();
    try {
      const saved = store.save({
        kind: 'http',
        request: { method: 'GET', path: '/voyager/api/me', status: 401, error: 'li_at=AQED-SECRET csrf-token=csrf-X' },
      });
      expect(saved.request?.error).toContain('REDACTED');
      expect(saved.request?.error).not.toContain('AQED-SECRET');
      expect(saved.request?.error).not.toContain('csrf-X');
      const onDisk = readFileSync(join(dir, `${saved.id}.json`), 'utf8');
      expect(onDisk).not.toContain('AQED-SECRET');
      expect(onDisk).not.toContain('csrf-X');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns undefined for an unknown artifact id', () => {
    const { dir, store } = makeStore();
    try {
      expect(store.get('nope')).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
