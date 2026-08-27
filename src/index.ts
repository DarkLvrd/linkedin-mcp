#!/usr/bin/env node
import { homedir } from 'node:os';
import { join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAgenticLinkedinServer } from './server.js';
import { PlaywrightBrowserSession } from './session/browser.js';
import { SessionManagerImpl } from './session/manager.js';
import { VoyagerHealthProbe } from './session/probe.js';
import { FileSessionStore } from './session/store.js';
import { VoyagerClient } from './voyager/client.js';

const readOnly =
  process.env.LINKEDIN_READ_ONLY === '1' || process.env.LINKEDIN_READ_ONLY === 'true';

const sessionPath =
  process.env.AGENTIC_LINKEDIN_SESSION_PATH ?? join(homedir(), '.agentic-linkedin', 'session.json');

const session = new SessionManagerImpl({
  browser: new PlaywrightBrowserSession(),
  store: new FileSessionStore(sessionPath),
  probe: new VoyagerHealthProbe(),
});
session.restore();

// The transport is the seam: the Voyager client consults the manager's
// cookies on every request (or honestly reports no-session before a sign-in).
const transport = new VoyagerClient({ cookies: () => session.getCookies() });

const server = createAgenticLinkedinServer(transport, {
  readOnly,
  session,
});
await server.connect(new StdioServerTransport());
