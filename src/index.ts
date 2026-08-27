#!/usr/bin/env node
import { homedir } from 'node:os';
import { join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAgenticLinkedinServer } from './server.js';
import { PlaywrightBrowserSession } from './session/browser.js';
import { SessionManagerImpl } from './session/manager.js';
import { VoyagerHealthProbe } from './session/probe.js';
import { FileSessionStore } from './session/store.js';
import { SessionTransport } from './transport/session.js';

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

const server = createAgenticLinkedinServer(new SessionTransport(session), {
  readOnly,
  session,
});
await server.connect(new StdioServerTransport());
