# agentic-linkedin

The LinkedIn MCP that **never breaks**.

An MCP server that gives an AI agent everything a person can do on LinkedIn:
you describe what you want, the agent executes it, and you never touch the site.

- **Self-healing** — selectors and endpoints live as data; provable fixes auto-apply when LinkedIn changes its DOM
- **Session hygiene** — human-like pacing, write budgets, health probes, graceful re-auth; never locks you out
- **Reliable posting** — verify-after-post, persisted dedupe keys, never an auto-retry: nothing double-posts
- **Humanized content** — per-user voice profiles and an AI-tell audit; everything reads like you wrote it
- **Observable** — plan-then-execute with field-level diffs and rendered previews; redacted failure artifacts

## Install

```
npx agentic-linkedin
```

Requires Node 20+. The package is published to npm; the repository lives at
[github.com/DarkLvrd/linkedin-mcp](https://github.com/DarkLvrd/linkedin-mcp).

## For normal people (no code, no terminal)

You don't need to know anything about computers to use this. You need three
things: a free chat app, one click to connect, and a one-time LinkedIn sign-in.

### Easiest: Cherry Studio (one click)

1. Download **Cherry Studio** (free) from cherry-ai.com and install it like any app.
2. **Click this one-click install link**:

   [Install agentic-linkedin in Cherry Studio](cherrystudio://mcp/install?servers=eyJtY3BTZXJ2ZXJzIjp7ImFnZW50aWMtbGlua2VkaW4iOnsiY29tbWFuZCI6Im5weCIsImFyZ3MiOlsiLXkiLCJhZ2VudGljLWxpbmtlZGluIl19fX0%3D)

   The app asks you to confirm — accept it. The server is now installed.
3. Open a chat in Cherry Studio, pick your AI model, and ask it to run the
   `login` tool. A browser window opens — **sign in to LinkedIn once**.
4. That's it. Talk normally: *"post about what I shipped this week"* — the AI
   shows you a preview list first, and nothing posts until you approve.

### Also easy: any MCP chat app

Claude Desktop, Cursor, and other MCP apps can add the server with this block
(ask the app's help or paste into its MCP settings):

```json
{
  "mcpServers": {
    "agentic-linkedin": {
      "command": "npx",
      "args": ["-y", "agentic-linkedin"]
    }
  }
}
```

Both paths need [Node.js](https://nodejs.org) installed once (download, install,
next-next-finish) — it's what runs the server behind the scenes.

## Sign in (once)

1. Start the server with your MCP client (Claude Desktop, Cursor, …).
2. Call the `login` tool. A browser window opens — sign in to LinkedIn and let it redirect to your feed.
3. The session persists to disk (`~/.agentic-linkedin/session.json`) and restores across restarts.

Identity is never stored in the repo or in failure artifacts. Cookie values are
redacted from every log, tool output, and artifact by construction.

## The workflow: plan-then-execute

Describe what you want. The agent calls `plan` with the intended writes and
gets back an ordered list with previews:

- profile changes show **field-level old → new diffs**
- posts and messages show **rendered feed-style previews** with their **AI-tell audit**
- a raw toggle always exposes the exact arguments

Nothing executes until you `approve` the plan. `reject` cancels it. `dry_run`
previews without storing anything. During execution every write still passes
the pacing engine: per-sign-in budgets, the hourly ceiling, randomized
human-like delays, and health probes — on a challenge the engine pauses until
you re-authenticate.

## Tools

- **Session**: `session_status`, `login`
- **Reads**: `get_me`, `get_profile`, `get_posts`, `get_conversations`, `get_conversation_history`, `get_connections_summary`, `get_invitations`, `get_jobs`, `get_analytics`
- **Profile**: `update_profile`, `add_skill`, `remove_skill`, `reorder_skills`, `delete_ghost_entry`
- **Posts**: `create_post`, `edit_post`, `delete_post`, `comment`, `react`
- **Messaging**: `send_message` (idempotency-keyed), `recall_message`, `react_to_message`
- **Network**: `connect`, `respond_invitation`, `follow`, `endorse_skill`, `remove_connection`
- **Planning**: `plan`, `dry_run`, `approve`, `reject`
- **Self-healing**: `show_artifact`, `update_registry`
- **Voice**: `get_voice_profile`, `set_voice_profile`, `bootstrap_voice_profile`, `audit_draft`

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `LINKEDIN_READ_ONLY` | `0` | `1`/`true` blocks every write tool outright |
| `AGENTIC_LINKEDIN_SESSION_PATH` | `~/.agentic-linkedin/session.json` | where the session persists |
| `AGENTIC_LINKEDIN_DEDUPE_PATH` | `~/.agentic-linkedin/posts.json` | persisted post-dedupe keys |
| `AGENTIC_LINKEDIN_ARTIFACTS_PATH` | `~/.agentic-linkedin/artifacts` | redacted failure artifacts |
| `AGENTIC_LINKEDIN_OVERLAY_PATH` | `~/.agentic-linkedin/overlay.json` | runtime selector-registry fixes |
| `AGENTIC_LINKEDIN_VOICE_PATH` | `~/.agentic-linkedin/voice` | per-user voice profiles |
| `AGENTIC_LINKEDIN_BUDGET_PER_SIGNIN` | `3` | browser-context writes per sign-in (the authwall threshold) |
| `AGENTIC_LINKEDIN_BUDGET_PER_HOUR` | `60` | total writes per sliding hour |
| `AGENTIC_LINKEDIN_PACING_MIN_MS` / `MAX_MS` | `1000` / `5000` | randomized delay range before writes |
| `AGENTIC_LINKEDIN_PROBE_INTERVAL_MS` | `60000` | session health-probe interval |

## Development

```
npm ci
npm run check   # typecheck + build + full test suite
```

Tests run fully offline: the transport seam is faked, Voyager/SDUI responses
are replayed from recorded fixtures, and the binary is exercised end-to-end
over stdio. Live LinkedIn actions are never automated in CI.

## License

MIT — see [LICENSE](./LICENSE).
