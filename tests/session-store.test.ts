import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileSessionStore } from '../src/session/store.js';
import type { SessionCookies } from '../src/session/types.js';

const cookies: SessionCookies = {
  li_at: 'AQED-cookie-value',
  jsessionid: 'ajax:12345',
  csrfToken: 'csrf:token',
  obtainedAt: '2026-08-24T12:00:00.000Z',
};

describe('FileSessionStore', () => {
  it('round-trips cookies to disk and back', () => {
    const dir = mkdtempSync(join(tmpdir(), 'session-store-'));
    try {
      const store = new FileSessionStore(join(dir, 'session.json'));
      expect(store.load()).toBeNull();
      store.save(cookies);
      expect(store.load()).toEqual(cookies);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('treats a missing file as no session', () => {
    const dir = mkdtempSync(join(tmpdir(), 'session-store-'));
    try {
      const store = new FileSessionStore(join(dir, 'does-not-exist.json'));
      expect(store.load()).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('treats a corrupt session file as no session instead of crashing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'session-store-'));
    try {
      const path = join(dir, 'session.json');
      writeFileSync(path, '{not json');
      const store = new FileSessionStore(path);
      expect(store.load()).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('clears a saved session', () => {
    const dir = mkdtempSync(join(tmpdir(), 'session-store-'));
    try {
      const store = new FileSessionStore(join(dir, 'session.json'));
      store.save(cookies);
      store.clear();
      expect(store.load()).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
