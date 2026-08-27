import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SessionCookies, SessionStore } from './types.js';

/**
 * Sessions persist as a JSON file. A missing or corrupt file means "no
 * session" — the honest first-run state, never a crash.
 */
export class FileSessionStore implements SessionStore {
  constructor(private readonly path: string) {}

  load(): SessionCookies | null {
    let raw: string;
    try {
      raw = readFileSync(this.path, 'utf8');
    } catch {
      return null;
    }
    try {
      return JSON.parse(raw) as SessionCookies;
    } catch {
      return null;
    }
  }

  save(cookies: SessionCookies): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(cookies, null, 2));
  }

  clear(): void {
    rmSync(this.path, { force: true });
  }
}
