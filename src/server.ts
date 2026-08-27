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
 * Runs a tool body and maps any failure to a clean tool error instead of a
 * raw exception — session problems, SDUI rejections, and network failures
 * all surface as readable messages.
 */
async function toolResult<T>(fn: () => Promise<T>): Promise<{ content: { type: 'text'; text: string }[]; isError: boolean }> {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await fn()) }], isError: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `error: ${message}` }], isError: true };
  }
}

/** Write tools: refused outright in read-only mode, then run like any tool. */
async function writeToolResult<T>(
  readOnly: boolean,
  fn: () => Promise<T>,
): Promise<{ content: { type: 'text'; text: string }[]; isError: boolean }> {
  if (readOnly) {
    return { content: [{ type: 'text', text: 'error: read-only mode — writes are blocked' }], isError: true };
  }
  return toolResult(fn);
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

  // Reads (ticket 10). Every read goes through the transport seam and returns
  // clean domain shapes — raw Voyager response shapes never reach the agent.
  server.registerTool(
    'get_me',
    {
      title: 'Get my member info',
      description: 'Returns the signed-in member: id, name, headline, vanity name.',
      inputSchema: z.object({}),
    },
    () => toolResult(() => transport.getMe()),
  );

  server.registerTool(
    'get_profile',
    {
      title: 'Get a profile',
      description: 'Returns a member profile (id, name, headline, location, about) by identifier.',
      inputSchema: z.object({ identifier: z.string() }),
    },
    (args) => toolResult(() => transport.getProfile(args.identifier)),
  );

  server.registerTool(
    'get_posts',
    {
      title: 'Get feed posts',
      description: 'Returns recent feed posts with id, author, text, and publish time.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
    },
    (args) => toolResult(() => transport.getPosts(args.limit ?? 25)),
  );

  server.registerTool(
    'get_conversations',
    {
      title: 'Get conversations',
      description: 'Returns recent messaging conversations with participants and last activity.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
    },
    (args) => toolResult(() => transport.getConversations(args.limit ?? 25)),
  );

  server.registerTool(
    'get_connections_summary',
    {
      title: 'Get connections summary',
      description: 'Returns the first-degree connection count.',
      inputSchema: z.object({}),
    },
    () => toolResult(() => transport.getConnectionsSummary()),
  );

  server.registerTool(
    'get_jobs',
    {
      title: 'Search jobs',
      description: 'Searches jobs by keywords and location id.',
      inputSchema: z.object({
        keywords: z.string().optional(),
        locationId: z.string().optional(),
      }),
    },
    (args) =>
      toolResult(() =>
        transport.getJobs({
          ...(args.keywords !== undefined ? { keywords: args.keywords } : {}),
          ...(args.locationId !== undefined ? { locationId: args.locationId } : {}),
        }),
      ),
  );

  server.registerTool(
    'get_analytics',
    {
      title: 'Get profile analytics',
      description: 'Returns profile view counts for the signed-in member.',
      inputSchema: z.object({}),
    },
    () => toolResult(() => transport.getAnalytics()),
  );

  // Writes (ticket 11). Every write verifies by read-back before reporting
  // success; every delete routes through SDUI. Gating and pacing arrive with
  // tickets 12 and 16.
  server.registerTool(
    'update_profile',
    {
      title: 'Update profile',
      description: 'Edits headline, about, or top-skills and returns the verified profile (read-back).',
      inputSchema: z.object({
        headline: z.string().optional(),
        about: z.string().optional(),
        topSkills: z.array(z.string()).optional(),
      }),
    },
    (args) =>
      writeToolResult(options.readOnly, () =>
        transport.updateProfile({
          ...(args.headline !== undefined ? { headline: args.headline } : {}),
          ...(args.about !== undefined ? { about: args.about } : {}),
          ...(args.topSkills !== undefined ? { topSkills: args.topSkills } : {}),
        }),
      ),
  );

  server.registerTool(
    'add_skill',
    {
      title: 'Add a skill',
      description: 'Adds a skill to the profile and returns the verified skills state.',
      inputSchema: z.object({ name: z.string() }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.addSkill(args.name)),
  );

  server.registerTool(
    'remove_skill',
    {
      title: 'Remove a skill',
      description: 'Removes a skill by its profile-skill URN and returns the verified skills state.',
      inputSchema: z.object({ skillUrn: z.string() }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.removeSkill(args.skillUrn)),
  );

  server.registerTool(
    'reorder_skills',
    {
      title: 'Reorder skills',
      description: 'Reorders top skills (newest first) and returns the verified skills state.',
      inputSchema: z.object({ order: z.array(z.string()).min(1) }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.reorderSkills(args.order)),
  );

  server.registerTool(
    'delete_ghost_entry',
    {
      title: 'Delete a ghost entry',
      description: 'Removes a profile entry that standard deletes miss, routed through SDUI.',
      inputSchema: z.object({ section: z.string(), urn: z.string() }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.deleteGhostEntry({ section: args.section, urn: args.urn })),
  );

  return server;
}
