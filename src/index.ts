#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAgenticLinkedinServer } from './server.js';
import { NoSessionTransport } from './transport/no-session.js';

const readOnly = process.env.LINKEDIN_READ_ONLY === '1' || process.env.LINKEDIN_READ_ONLY === 'true';

// The transport is the seam. Until the auth bootstrap lands (ticket 09),
// the binary runs on the honest no-session transport.
const transport = new NoSessionTransport();

const server = createAgenticLinkedinServer(transport, { readOnly });
await server.connect(new StdioServerTransport());
