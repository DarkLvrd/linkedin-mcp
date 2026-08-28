import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ArtifactInput, ArtifactStore, FailureArtifact } from './types.js';

const SESSION_PATTERNS = [
  /li_at=[A-Za-z0-9_\-%]+/g,
  /csrf-token=[A-Za-z0-9_\-%]+/g,
  /JSESSIONID=[A-Za-z0-9_\-%:]+/g,
];

/** The redaction boundary: session values never survive into an artifact. */
export function redact(text: string): string {
  let out = text;
  for (const pattern of SESSION_PATTERNS) {
    out = out.replace(pattern, (match) => match.replace(/=.*$/, '=REDACTED'));
  }
  return out;
}

/** Shared by every store: redact, stamp id/at, pin the redacted invariant. */
export function finalizeArtifact(input: ArtifactInput): FailureArtifact {
  return {
    ...input,
    ...(input.request !== undefined
      ? { request: { ...input.request, ...(input.request.error !== undefined ? { error: redact(input.request.error) } : {}) } }
      : {}),
    id: randomUUID(),
    at: new Date().toISOString(),
    redacted: true,
  };
}

/**
 * One JSON file per artifact in a local, gitignored directory. The capture
 * API has no header field (structural redaction) and error text passes
 * through redact() before it is written.
 */
export class FileArtifactStore implements ArtifactStore {
  constructor(private readonly dir: string) {}

  save(input: ArtifactInput): FailureArtifact {
    const artifact = finalizeArtifact(input);
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(join(this.dir, `${artifact.id}.json`), JSON.stringify(artifact, null, 2));
    return artifact;
  }

  get(id: string): FailureArtifact | undefined {
    try {
      return JSON.parse(readFileSync(join(this.dir, `${id}.json`), 'utf8')) as FailureArtifact;
    } catch {
      return undefined;
    }
  }

  list(): FailureArtifact[] {
    let files: string[];
    try {
      files = readdirSync(this.dir).filter((f) => f.endsWith('.json'));
    } catch {
      return [];
    }
    return files
      .map((f) => this.get(f.replace(/\.json$/, '')))
      .filter((artifact): artifact is FailureArtifact => artifact !== undefined)
      .sort((a, b) => b.at.localeCompare(a.at));
  }
}

/** In-memory artifact store for tests. */
export class InMemoryArtifactStore implements ArtifactStore {
  private readonly artifacts = new Map<string, FailureArtifact>();

  save(input: ArtifactInput): FailureArtifact {
    const artifact = finalizeArtifact(input);
    this.artifacts.set(artifact.id, artifact);
    return artifact;
  }

  get(id: string): FailureArtifact | undefined {
    return this.artifacts.get(id);
  }

  list(): FailureArtifact[] {
    return [...this.artifacts.values()].sort((a, b) => b.at.localeCompare(a.at));
  }
}
