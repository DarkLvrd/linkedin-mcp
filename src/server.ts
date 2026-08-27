import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LinkedInTransport, SessionStatus } from './transport/types.js';

export interface AgenticLinkedinServerOptions {
  /** When true, every write tool is blocked outright; reads keep working. */
  readOnly: boolean;
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

  return server;
}
