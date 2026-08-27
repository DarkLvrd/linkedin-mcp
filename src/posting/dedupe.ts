import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * The persisted dedupe store (ticket 13): once content + target has been
 * submitted, its key is written to disk so nothing can double-post — even
 * across sessions, even after a timeout that left the outcome ambiguous.
 */

export interface DedupeStore {
  has(key: string): boolean;
  add(key: string): void;
}

/** The stable identity of one submission: kind + target + content hash. */
export function dedupeKey(kind: string, target: string, content: string): string {
  return createHash('sha256').update(`${kind}:${target}:${content}`).digest('hex');
}

export class InMemoryDedupeStore implements DedupeStore {
  private readonly keys = new Set<string>();
  has(key: string): boolean {
    return this.keys.has(key);
  }
  add(key: string): void {
    this.keys.add(key);
  }
}

export class FileDedupeStore implements DedupeStore {
  private readonly keys: Set<string>;

  constructor(private readonly path: string) {
    this.keys = new Set(this.read());
  }

  private read(): string[] {
    try {
      const raw = JSON.parse(readFileSync(this.path, 'utf8')) as { keys?: string[] };
      return Array.isArray(raw.keys) ? raw.keys : [];
    } catch {
      return [];
    }
  }

  private write(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify({ keys: [...this.keys] }, null, 2));
  }

  has(key: string): boolean {
    return this.keys.has(key);
  }

  add(key: string): void {
    this.keys.add(key);
    this.write();
  }
}
