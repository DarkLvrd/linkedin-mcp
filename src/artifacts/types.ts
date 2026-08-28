/**
 * Failure artifacts (ticket 17): what the server keeps when something breaks.
 * Session values are redacted by construction — the capture API has no header
 * field, and error text is sanitized before anything touches disk.
 */

export interface ArtifactRequest {
  method: string;
  path: string;
  status: number;
  error?: string;
}

export interface FailureArtifact {
  id: string;
  at: string;
  kind: 'registry-lookup' | 'http';
  /** The registry entry whose lookup failed (registry-lookup artifacts). */
  selectorId?: string;
  /** The strategy kinds tried, in order (registry-lookup artifacts). */
  failedKinds?: string[];
  /** The strategy values tried, parallel to failedKinds. */
  failedValues?: string[];
  /** Present when a browser context captured the page. */
  domDump?: string;
  request?: ArtifactRequest;
  /** Invariant: every stored artifact is redacted. */
  redacted: true;
}

export type ArtifactInput = Omit<FailureArtifact, 'id' | 'at' | 'redacted'>;

export interface ArtifactStore {
  save(artifact: ArtifactInput): FailureArtifact;
  get(id: string): FailureArtifact | undefined;
  list(): FailureArtifact[];
}
