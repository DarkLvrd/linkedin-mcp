#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAgenticLinkedinServer } from './server.js';
import { readConfig } from './config.js';
import { Healer } from './artifacts/healer.js';
import { FileArtifactStore } from './artifacts/store.js';
import { PacedTransport } from './engine/paced.js';
import { createRegistry } from './registry/registry.js';
import { PlaywrightBrowserSession } from './session/browser.js';
import { SessionManagerImpl } from './session/manager.js';
import { VoyagerHealthProbe } from './session/probe.js';
import { FileSessionStore } from './session/store.js';
import { FileVoiceProfileStore } from './voice/store.js';
import { FileDedupeStore } from './posting/dedupe.js';
import { LinkedInHttpClient } from './voyager/client.js';
import type { FailureArtifact } from './artifacts/types.js';

const config = readConfig(process.env);

const session = new SessionManagerImpl({
  browser: new PlaywrightBrowserSession(),
  store: new FileSessionStore(config.sessionPath),
  probe: new VoyagerHealthProbe(),
});
session.restore();

// The self-healing loop (ticket 17): failures become redacted artifacts;
// provable fixes auto-apply to the registry overlay; the rest wait for review.
let captureSuggestion: ((s: { selectorId: string; failedKinds: string[]; failedValues: string[] }) => void) | undefined;
const registry = createRegistry({
  overlayPath: config.overlayPath,
  onSuggestion: (s) => captureSuggestion?.(s),
});
const artifacts = new FileArtifactStore(config.artifactsPath);
const healer = new Healer({ store: artifacts, registry });
captureSuggestion = (s) => {
  healer.capture({
    kind: 'registry-lookup',
    selectorId: s.selectorId,
    failedKinds: s.failedKinds as Exclude<FailureArtifact['failedKinds'], undefined>,
    failedValues: s.failedValues,
  });
};

// The transport is the seam: the HTTP client consults the manager's cookies
// on every request (or honestly reports no-session before a sign-in); the
// pacing engine wraps it with budgets, pacing, health holds, and read-only.
const httpClient = new LinkedInHttpClient({
  cookies: () => session.getCookies(),
  // The persisted dedupe store: nothing double-posts, even across sessions.
  dedupeStore: new FileDedupeStore(config.dedupePath),
  onFailure: (input) => {
    healer.capture(input);
  },
});
const transport = new PacedTransport({ inner: httpClient, session, readOnly: config.readOnly, config: config.pacing });

const server = createAgenticLinkedinServer(transport, {
  readOnly: config.readOnly,
  session,
  registry,
  artifacts,
  voice: new FileVoiceProfileStore(config.voicePath),
});
await server.connect(new StdioServerTransport());
