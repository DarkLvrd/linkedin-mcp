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

  // Posting (ticket 13): verify-after-post, dedupe, never auto-retry. Gating
  // arrives with ticket 16.
  server.registerTool(
    'create_post',
    {
      title: 'Create a post',
      description:
        'Publishes a text post, verifies it by read-back, and refuses to double-post the same content. Reports verified:false honestly when the read-back cannot confirm.',
      inputSchema: z.object({ text: z.string().min(1) }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.createPost(args.text)),
  );

  server.registerTool(
    'edit_post',
    {
      title: 'Edit a post',
      description: 'Replaces a post\'s text and verifies the edit by read-back.',
      inputSchema: z.object({ postId: z.string(), text: z.string().min(1) }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.editPost(args.postId, args.text)),
  );

  server.registerTool(
    'delete_post',
    {
      title: 'Delete a post',
      description: 'Deletes a post through SDUI and verifies it no longer appears in the feed.',
      inputSchema: z.object({ postId: z.string() }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.deletePost(args.postId)),
  );

  server.registerTool(
    'comment',
    {
      title: 'Comment on a post',
      description: 'Leaves a text comment on a post.',
      inputSchema: z.object({ postId: z.string(), text: z.string().min(1) }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.commentOnPost(args.postId, args.text)),
  );

  server.registerTool(
    'react',
    {
      title: 'React to a post',
      description: 'Leaves a reaction on a post: LIKE, PRAISE, APPRECIATION, EMPATHY, INTEREST, or ENTERTAINMENT.',
      inputSchema: z.object({
        postId: z.string(),
        reaction: z.enum(['LIKE', 'PRAISE', 'APPRECIATION', 'EMPATHY', 'INTEREST', 'ENTERTAINMENT']),
      }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.reactToPost(args.postId, args.reaction)),
  );

  // Messaging (ticket 14): sends carry an originToken so a retry with the
  // same key can never double-send; writes are gated and paced like all others.
  server.registerTool(
    'send_message',
    {
      title: 'Send a message',
      description:
        'Sends a message in a conversation. Returns the originToken idempotency key — pass it back on a retry so nothing double-sends.',
      inputSchema: z.object({ conversationUrn: z.string(), text: z.string().min(1), originToken: z.string().optional() }),
    },
    (args) =>
      writeToolResult(options.readOnly, () =>
        transport.sendMessage(
          args.conversationUrn,
          args.text,
          args.originToken !== undefined ? args.originToken : undefined,
        ),
      ),
  );

  server.registerTool(
    'recall_message',
    {
      title: 'Recall a message',
      description: 'Recalls (deletes) a message you sent.',
      inputSchema: z.object({ conversationUrn: z.string(), messageId: z.string() }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.recallMessage(args.conversationUrn, args.messageId)),
  );

  server.registerTool(
    'react_to_message',
    {
      title: 'React to a message',
      description: 'Leaves an emoji reaction on a message.',
      inputSchema: z.object({ conversationUrn: z.string(), messageId: z.string(), emoji: z.string().min(1) }),
    },
    (args) =>
      writeToolResult(options.readOnly, () => transport.reactToMessage(args.conversationUrn, args.messageId, args.emoji)),
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

  // Network (ticket 15): writes gated and paced like all others; the quota-
  // checked connect endpoint surfaces LinkedIn's invite limits clearly.
  server.registerTool(
    'connect',
    {
      title: 'Send a connection request',
      description: 'Sends a connection request with a note via the quota-checked endpoint; LinkedIn invite limits surface as clear errors.',
      inputSchema: z.object({ profileUrn: z.string(), note: z.string() }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.connectWithNote(args.profileUrn, args.note)),
  );

  server.registerTool(
    'respond_invitation',
    {
      title: 'Respond to an invitation',
      description: 'Accepts, ignores, or withdraws a connection invitation; verified by read-back.',
      inputSchema: z.object({
        invitationUrn: z.string(),
        action: z.enum(['accept', 'ignore', 'withdraw']),
      }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.respondInvitation(args.invitationUrn, args.action)),
  );

  server.registerTool(
    'follow',
    {
      title: 'Follow or unfollow',
      description: 'Follows or unfollows a person (SDUI) or a company (Voyager patch).',
      inputSchema: z.object({
        urn: z.string(),
        kind: z.enum(['person', 'company']),
        follow: z.boolean(),
      }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.follow(args.urn, args.kind, args.follow)),
  );

  server.registerTool(
    'endorse_skill',
    {
      title: 'Endorse a skill',
      description: 'Endorses a skill on someone\'s profile.',
      inputSchema: z.object({ profileUrn: z.string(), skillId: z.string(), vanityName: z.string() }),
    },
    (args) =>
      writeToolResult(options.readOnly, () => transport.endorseSkill(args.profileUrn, args.skillId, args.vanityName)),
  );

  server.registerTool(
    'remove_connection',
    {
      title: 'Remove a connection',
      description: 'Removes a connection by vanity name.',
      inputSchema: z.object({ vanityName: z.string() }),
    },
    (args) => writeToolResult(options.readOnly, () => transport.removeConnection(args.vanityName)),
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

  return server;
}
