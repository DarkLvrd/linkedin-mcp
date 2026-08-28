import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Planner } from './planning/planner.js';
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

interface WriteTool {
  name: string;
  title: string;
  description: string;
  schema: z.ZodType;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Build the MCP server exposing the agentic-linkedin tools.
 * The transport is injected through the seam; domain logic and tools are
 * tested against FakeTransport. Write tools are table-driven so the planner's
 * executor and the MCP registration share one source of truth.
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

  server.registerTool(
    'get_conversation_history',
    {
      title: 'Get conversation history',
      description: 'Returns the events of a conversation with id, sender, text, and sent time.',
      inputSchema: z.object({ conversationUrn: z.string(), limit: z.number().int().min(1).max(100).optional() }),
    },
    (args) => toolResult(() => transport.getConversationHistory(args.conversationUrn, args.limit ?? 25)),
  );

  server.registerTool(
    'get_invitations',
    {
      title: 'Get invitations',
      description: 'Returns pending connection invitations with id, profile, and sent time.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
    },
    (args) => toolResult(() => transport.getInvitations(args.limit ?? 25)),
  );

  // Writes (tickets 11–15): table-driven, one source of truth for the MCP
  // registration and the plan executor. Every write verifies by read-back
  // where one exists; all are gated by read-only, budgets, and pacing.
  const writeTools: WriteTool[] = [
    {
      name: 'update_profile',
      title: 'Update profile',
      description: 'Edits headline, about, or top-skills and returns the verified profile (read-back).',
      schema: z.object({
        headline: z.string().optional(),
        about: z.string().optional(),
        topSkills: z.array(z.string()).optional(),
      }),
      handler: (args) =>
        transport.updateProfile({
          ...(args['headline'] !== undefined ? { headline: args['headline'] as string } : {}),
          ...(args['about'] !== undefined ? { about: args['about'] as string } : {}),
          ...(args['topSkills'] !== undefined ? { topSkills: args['topSkills'] as string[] } : {}),
        }),
    },
    {
      name: 'add_skill',
      title: 'Add a skill',
      description: 'Adds a skill to the profile and returns the verified skills state.',
      schema: z.object({ name: z.string() }),
      handler: (args) => transport.addSkill(args['name'] as string),
    },
    {
      name: 'remove_skill',
      title: 'Remove a skill',
      description: 'Removes a skill by its profile-skill URN and returns the verified skills state.',
      schema: z.object({ skillUrn: z.string() }),
      handler: (args) => transport.removeSkill(args['skillUrn'] as string),
    },
    {
      name: 'reorder_skills',
      title: 'Reorder skills',
      description: 'Reorders top skills (newest first) and returns the verified skills state.',
      schema: z.object({ order: z.array(z.string()).min(1) }),
      handler: (args) => transport.reorderSkills(args['order'] as string[]),
    },
    {
      name: 'delete_ghost_entry',
      title: 'Delete a ghost entry',
      description: 'Removes a profile entry that standard deletes miss, routed through SDUI.',
      schema: z.object({ section: z.string(), urn: z.string() }),
      handler: (args) =>
        transport.deleteGhostEntry({ section: args['section'] as string, urn: args['urn'] as string }),
    },
    {
      name: 'create_post',
      title: 'Create a post',
      description:
        'Publishes a text post, verifies it by read-back, and refuses to double-post the same content. Reports verified:false honestly when the read-back cannot confirm.',
      schema: z.object({ text: z.string().min(1) }),
      handler: (args) => transport.createPost(args['text'] as string),
    },
    {
      name: 'edit_post',
      title: 'Edit a post',
      description: "Replaces a post's text and verifies the edit by read-back.",
      schema: z.object({ postId: z.string(), text: z.string().min(1) }),
      handler: (args) => transport.editPost(args['postId'] as string, args['text'] as string),
    },
    {
      name: 'delete_post',
      title: 'Delete a post',
      description: 'Deletes a post through SDUI and verifies it no longer appears in the feed.',
      schema: z.object({ postId: z.string() }),
      handler: (args) => transport.deletePost(args['postId'] as string),
    },
    {
      name: 'comment',
      title: 'Comment on a post',
      description: 'Leaves a text comment on a post.',
      schema: z.object({ postId: z.string(), text: z.string().min(1) }),
      handler: (args) => transport.commentOnPost(args['postId'] as string, args['text'] as string),
    },
    {
      name: 'react',
      title: 'React to a post',
      description: 'Leaves a reaction on a post: LIKE, PRAISE, APPRECIATION, EMPATHY, INTEREST, or ENTERTAINMENT.',
      schema: z.object({
        postId: z.string(),
        reaction: z.enum(['LIKE', 'PRAISE', 'APPRECIATION', 'EMPATHY', 'INTEREST', 'ENTERTAINMENT']),
      }),
      handler: (args) => transport.reactToPost(args['postId'] as string, args['reaction'] as 'LIKE'),
    },
    {
      name: 'send_message',
      title: 'Send a message',
      description:
        'Sends a message in a conversation. Returns the originToken idempotency key — pass it back on a retry so nothing double-sends.',
      schema: z.object({ conversationUrn: z.string(), text: z.string().min(1), originToken: z.string().optional() }),
      handler: (args) =>
        transport.sendMessage(
          args['conversationUrn'] as string,
          args['text'] as string,
          args['originToken'] !== undefined ? (args['originToken'] as string) : undefined,
        ),
    },
    {
      name: 'recall_message',
      title: 'Recall a message',
      description: 'Recalls (deletes) a message you sent.',
      schema: z.object({ conversationUrn: z.string(), messageId: z.string() }),
      handler: (args) =>
        transport.recallMessage(args['conversationUrn'] as string, args['messageId'] as string),
    },
    {
      name: 'react_to_message',
      title: 'React to a message',
      description: 'Leaves an emoji reaction on a message.',
      schema: z.object({ conversationUrn: z.string(), messageId: z.string(), emoji: z.string().min(1) }),
      handler: (args) =>
        transport.reactToMessage(args['conversationUrn'] as string, args['messageId'] as string, args['emoji'] as string),
    },
    {
      name: 'connect',
      title: 'Send a connection request',
      description:
        'Sends a connection request with a note via the quota-checked endpoint; LinkedIn invite limits surface as clear errors.',
      schema: z.object({ profileUrn: z.string(), note: z.string() }),
      handler: (args) => transport.connectWithNote(args['profileUrn'] as string, args['note'] as string),
    },
    {
      name: 'respond_invitation',
      title: 'Respond to an invitation',
      description: 'Accepts, ignores, or withdraws a connection invitation; verified by read-back.',
      schema: z.object({
        invitationUrn: z.string(),
        action: z.enum(['accept', 'ignore', 'withdraw']),
      }),
      handler: (args) =>
        transport.respondInvitation(args['invitationUrn'] as string, args['action'] as 'accept'),
    },
    {
      name: 'follow',
      title: 'Follow or unfollow',
      description: 'Follows or unfollows a person (SDUI) or a company (Voyager patch).',
      schema: z.object({
        urn: z.string(),
        kind: z.enum(['person', 'company']),
        follow: z.boolean(),
      }),
      handler: (args) =>
        transport.follow(args['urn'] as string, args['kind'] as 'person', args['follow'] as boolean),
    },
    {
      name: 'endorse_skill',
      title: 'Endorse a skill',
      description: "Endorses a skill on someone's profile.",
      schema: z.object({ profileUrn: z.string(), skillId: z.string(), vanityName: z.string() }),
      handler: (args) =>
        transport.endorseSkill(
          args['profileUrn'] as string,
          args['skillId'] as string,
          args['vanityName'] as string,
        ),
    },
    {
      name: 'remove_connection',
      title: 'Remove a connection',
      description: 'Removes a connection by vanity name.',
      schema: z.object({ vanityName: z.string() }),
      handler: (args) => transport.removeConnection(args['vanityName'] as string),
    },
  ];

  const writeNames = writeTools.map((t) => t.name);
  const writeSchemas = new Map(writeTools.map((t) => [t.name, t.schema]));
  const writeHandlers = new Map(writeTools.map((t) => [t.name, t.handler]));

  for (const tool of writeTools) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.schema },
      (args) => writeToolResult(options.readOnly, () => tool.handler(args as Record<string, unknown>)),
    );
  }

  // Plan-then-execute (ticket 16): the planner's executor is the same write
  // path the MCP tools use, so every executed action passes the read-only
  // gate and, in the binary, the pacing engine.
  const planner = new Planner({
    transport,
    execute: (tool, args) => {
      const handler = writeHandlers.get(tool);
      if (handler === undefined) {
        throw new Error(`unknown write tool ${tool}`);
      }
      if (options.readOnly) {
        throw new Error('read-only mode — writes are blocked');
      }
      return handler(args);
    },
  });

  const actionSchema = z.object({
    tool: z.enum(writeNames as [string, ...string[]]),
    args: z.record(z.string(), z.unknown()),
  });

  async function planFromActions(actions: { tool: string; args: Record<string, unknown> }[]) {
    // Plan-time validation: every action's args must satisfy its own schema.
    for (const action of actions) {
      writeSchemas.get(action.tool)?.parse(action.args);
    }
    return planner.plan(actions);
  }

  server.registerTool(
    'plan',
    {
      title: 'Plan actions',
      description:
        'Turns intended writes into an ordered plan with per-action previews (diffs for profile changes, rendered previews for posts/messages, raw args always available). Nothing executes until approve.',
      inputSchema: z.object({ actions: z.array(actionSchema).min(1) }),
    },
    async (args) => {
      try {
        const plan = await planFromActions(args.actions);
        return { content: [{ type: 'text', text: JSON.stringify(plan) }], isError: false };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: `error: ${message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'dry_run',
    {
      title: 'Dry-run actions',
      description: 'Produces the same plan and previews as plan, but nothing is stored and nothing can be approved.',
      inputSchema: z.object({ actions: z.array(actionSchema).min(1) }),
    },
    async (args) => {
      try {
        for (const action of args.actions) {
          writeSchemas.get(action.tool)?.parse(action.args);
        }
        const plan = await planner.dryRun(args.actions);
        return { content: [{ type: 'text', text: JSON.stringify(plan) }], isError: false };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: `error: ${message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'approve',
    {
      title: 'Approve a plan',
      description: 'Executes the actions of a pending plan, in order, through the same gated write path as direct tool calls.',
      inputSchema: z.object({ planId: z.string() }),
    },
    (args) => writeToolResult(options.readOnly, () => planner.approve(args.planId)),
  );

  server.registerTool(
    'reject',
    {
      title: 'Reject a plan',
      description: 'Marks a pending plan rejected; nothing executes.',
      inputSchema: z.object({ planId: z.string() }),
    },
    async (args) => {
      try {
        planner.reject(args.planId);
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }], isError: false };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: `error: ${message}` }], isError: true };
      }
    },
  );

  return server;
}
