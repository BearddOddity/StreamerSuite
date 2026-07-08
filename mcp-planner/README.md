# StreamerSuite MCP Planner

An MCP server that tracks StreamerSuite project-planning state — tools, target
platforms, timeline/milestones, architecture decisions, and blockers — in a
local SQLite database (`planning.db`). Intended primarily for use by Claude
across sessions, so project context doesn't need to be re-explained each time.

## Setup

```bash
npm install
npm run build
npm run seed   # populates/updates the known StreamerSuite state
```

## Running

```bash
npm start
```

Runs over stdio, so it's meant to be launched by an MCP client (Claude Code,
Claude Desktop, etc.) rather than run standalone. Example client config entry:

```json
{
  "mcpServers": {
    "streamersuite-planner": {
      "command": "node",
      "args": ["/path/to/mcp-planner/dist/index.js"]
    }
  }
}
```

## Data model

- **tools** — `name`, `description`, `status`, `is_mvp`, `notes`
- **platforms** — Twitch, Kick, YouTube, JoystickTV, Rumble; `integration_status`, `notes`
- **timeline** — milestones (e.g. Alpha, Beta), optionally tied to a tool
- **decisions** — architecture/product decisions, optionally tied to a tool
- **blockers** — open/resolved blockers, optionally tied to a tool

## MCP tools exposed

| Tool | Purpose |
| --- | --- |
| `get_tool` | Fetch one tool (by name or id) plus its timeline, decisions, blockers |
| `list_tools` | List tools, optionally filtered by `status` / `is_mvp` |
| `get_platforms` | List all platforms and integration status |
| `get_timeline` | List milestones, optionally scoped to a tool |
| `update_tool` | Patch a tool's description/status/is_mvp/notes |
| `add_decision` | Record a new architecture/product decision |
| `search` | Keyword search across tools, platforms, timeline, decisions, blockers |
| `add_blocker` | Record a new blocker |
| `resolve_blocker` | Mark a blocker resolved |

Re-running `npm run seed` is idempotent for tools/platforms (upserts by
name) and safe to run again after schema changes.
