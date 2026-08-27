import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from './session/types.js';
import type { LinkedInTransport, SessionStatus } from './transport/types.js';

export interface AgenticLinkedinServerOptions {
  /** When true, every write tool is blocked outright; reads keep working. */
  readOnly: boolean;
  /** When provided, the server registers the one-time sign-in tool. */
  session?: SessionManager;
}

/**
 * Build the MCP server exposing the agentic-linkedin tools.
 * The transport is injected through the seam; domain logic and tools are
 * tested against FakeTransport.
 */
export function createAgenticLinkedinServer(
  transport: LinkedInTransport,
  options: AgenticLinkedinServerOptions,
): McpServer {
  const server = new McpServer({ name: 'agentic-linkedin', version: '0.1.0' });

  server.registerTool(
    'session_status',
    {
      title: 'Session status',
      description:
        'Reports the health of the LinkedIn session (healthy, unhealthy with a reason, or no-session) and whether the server runs read-only.',
      inputSchema: z.object({}),
    },
    async () => {
      const status: SessionStatus = await transport.getSessionStatus();
      // Read-only is a server-level guarantee: the server's own flag counts
      // even when the transport does not know about it.
      const reported: SessionStatus = { ...status, readOnly: status.readOnly || options.readOnly };
      return { content: [{ type: 'text', text: JSON.stringify(reported) }] };
    },
  );

  if (options.session !== undefined) {
    server.registerTool(
      'login',
      {
        title: 'Sign in to LinkedIn',
        description:
          'Opens a browser window for a one-time sign-in. Sign in and close the window; the session is then persisted and restored across restarts.',
        inputSchema: z.object({}),
      },
      async () => {
        const result = await options.session?.login();
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    );
  }

  return server;
}
