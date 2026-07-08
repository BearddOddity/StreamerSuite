#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { db } from "./db.js";

const server = new McpServer({
  name: "streamersuite-mcp-planner",
  version: "0.1.0",
});

function toolRow(name: string) {
  return db.prepare("SELECT * FROM tools WHERE name = ? OR id = ?").get(name, Number(name) || -1);
}

server.registerTool(
  "get_tool",
  {
    title: "Get tool",
    description: "Get a single StreamerSuite tool by name or id, including its recent timeline entries, decisions, and blockers.",
    inputSchema: {
      name: z.string().describe("Tool name (e.g. 'Chat Manager') or numeric id"),
    },
  },
  async ({ name }) => {
    const tool = toolRow(name) as { id: number } | undefined;
    if (!tool) {
      return { content: [{ type: "text", text: `No tool found matching "${name}".` }], isError: true };
    }
    const timeline = db.prepare("SELECT * FROM timeline WHERE tool_id = ? ORDER BY id").all(tool.id);
    const decisions = db.prepare("SELECT * FROM decisions WHERE tool_id = ? ORDER BY id").all(tool.id);
    const blockers = db.prepare("SELECT * FROM blockers WHERE tool_id = ? ORDER BY id").all(tool.id);
    return {
      content: [
        { type: "text", text: JSON.stringify({ tool, timeline, decisions, blockers }, null, 2) },
      ],
    };
  }
);

server.registerTool(
  "list_tools",
  {
    title: "List tools",
    description: "List all StreamerSuite tools, optionally filtered by status or MVP flag.",
    inputSchema: {
      status: z.string().optional().describe("Filter by status, e.g. 'planning', 'in progress', 'alpha', 'beta', 'live'"),
      is_mvp: z.boolean().optional().describe("Filter to only MVP tools (true) or only non-MVP tools (false)"),
    },
  },
  async ({ status, is_mvp }) => {
    let query = "SELECT * FROM tools WHERE 1=1";
    const params: unknown[] = [];
    if (status) {
      query += " AND status = ?";
      params.push(status);
    }
    if (is_mvp !== undefined) {
      query += " AND is_mvp = ?";
      params.push(is_mvp ? 1 : 0);
    }
    query += " ORDER BY id";
    const tools = db.prepare(query).all(...params);
    return { content: [{ type: "text", text: JSON.stringify(tools, null, 2) }] };
  }
);

server.registerTool(
  "get_platforms",
  {
    title: "Get platforms",
    description: "List all target streaming platforms (Twitch, Kick, YouTube, JoystickTV, Rumble) and their integration status.",
    inputSchema: {},
  },
  async () => {
    const platforms = db.prepare("SELECT * FROM platforms ORDER BY id").all();
    return { content: [{ type: "text", text: JSON.stringify(platforms, null, 2) }] };
  }
);

server.registerTool(
  "get_timeline",
  {
    title: "Get timeline",
    description: "Get project milestones/timeline entries, optionally filtered to a specific tool.",
    inputSchema: {
      tool_name: z.string().optional().describe("Restrict to milestones for this tool (name or id)"),
    },
  },
  async ({ tool_name }) => {
    let rows;
    if (tool_name) {
      const tool = toolRow(tool_name) as { id: number } | undefined;
      if (!tool) {
        return { content: [{ type: "text", text: `No tool found matching "${tool_name}".` }], isError: true };
      }
      rows = db.prepare("SELECT * FROM timeline WHERE tool_id = ? ORDER BY id").all(tool.id);
    } else {
      rows = db.prepare("SELECT * FROM timeline ORDER BY id").all();
    }
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

server.registerTool(
  "update_tool",
  {
    title: "Update tool",
    description: "Update fields on an existing StreamerSuite tool (description, status, is_mvp, notes). Only provided fields are changed.",
    inputSchema: {
      name: z.string().describe("Tool name or id to update"),
      description: z.string().optional(),
      status: z.string().optional(),
      is_mvp: z.boolean().optional(),
      notes: z.string().optional(),
    },
  },
  async ({ name, description, status, is_mvp, notes }) => {
    const tool = toolRow(name) as { id: number } | undefined;
    if (!tool) {
      return { content: [{ type: "text", text: `No tool found matching "${name}".` }], isError: true };
    }
    const updates: string[] = [];
    const params: unknown[] = [];
    if (description !== undefined) { updates.push("description = ?"); params.push(description); }
    if (status !== undefined) { updates.push("status = ?"); params.push(status); }
    if (is_mvp !== undefined) { updates.push("is_mvp = ?"); params.push(is_mvp ? 1 : 0); }
    if (notes !== undefined) { updates.push("notes = ?"); params.push(notes); }
    if (updates.length === 0) {
      return { content: [{ type: "text", text: "No fields provided to update." }], isError: true };
    }
    updates.push("updated_at = datetime('now')");
    params.push(tool.id);
    db.prepare(`UPDATE tools SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    const updated = db.prepare("SELECT * FROM tools WHERE id = ?").get(tool.id);
    return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
  }
);

server.registerTool(
  "add_decision",
  {
    title: "Add architecture decision",
    description: "Record a new architecture/product decision, optionally tied to a specific tool.",
    inputSchema: {
      title: z.string().describe("Short decision title"),
      description: z.string().optional().describe("What was decided"),
      rationale: z.string().optional().describe("Why it was decided"),
      tool_name: z.string().optional().describe("Tool this decision relates to (name or id)"),
    },
  },
  async ({ title, description, rationale, tool_name }) => {
    let toolId: number | null = null;
    if (tool_name) {
      const tool = toolRow(tool_name) as { id: number } | undefined;
      if (!tool) {
        return { content: [{ type: "text", text: `No tool found matching "${tool_name}".` }], isError: true };
      }
      toolId = tool.id;
    }
    const result = db
      .prepare("INSERT INTO decisions (title, description, rationale, tool_id) VALUES (?, ?, ?, ?)")
      .run(title, description ?? "", rationale ?? "", toolId);
    const created = db.prepare("SELECT * FROM decisions WHERE id = ?").get(result.lastInsertRowid);
    return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
  }
);

server.registerTool(
  "search",
  {
    title: "Search",
    description: "Full-text-ish search across tools, platforms, timeline, decisions, and blockers by keyword.",
    inputSchema: {
      query: z.string().describe("Keyword or phrase to search for"),
    },
  },
  async ({ query }) => {
    const like = `%${query}%`;
    const tools = db
      .prepare("SELECT 'tool' AS kind, id, name AS title, description AS detail FROM tools WHERE name LIKE ? OR description LIKE ? OR notes LIKE ?")
      .all(like, like, like);
    const platforms = db
      .prepare("SELECT 'platform' AS kind, id, name AS title, integration_status AS detail FROM platforms WHERE name LIKE ? OR notes LIKE ?")
      .all(like, like);
    const timeline = db
      .prepare("SELECT 'timeline' AS kind, id, milestone AS title, notes AS detail FROM timeline WHERE milestone LIKE ? OR notes LIKE ?")
      .all(like, like);
    const decisions = db
      .prepare("SELECT 'decision' AS kind, id, title, description AS detail FROM decisions WHERE title LIKE ? OR description LIKE ? OR rationale LIKE ?")
      .all(like, like, like);
    const blockers = db
      .prepare("SELECT 'blocker' AS kind, id, description AS title, status AS detail FROM blockers WHERE description LIKE ?")
      .all(like);
    const results = [...tools, ...platforms, ...timeline, ...decisions, ...blockers];
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

server.registerTool(
  "add_blocker",
  {
    title: "Add blocker",
    description: "Record a new blocker, optionally tied to a specific tool.",
    inputSchema: {
      description: z.string().describe("What is blocked and why"),
      severity: z.enum(["low", "medium", "high"]).optional(),
      tool_name: z.string().optional().describe("Tool this blocker relates to (name or id)"),
    },
  },
  async ({ description, severity, tool_name }) => {
    let toolId: number | null = null;
    if (tool_name) {
      const tool = toolRow(tool_name) as { id: number } | undefined;
      if (!tool) {
        return { content: [{ type: "text", text: `No tool found matching "${tool_name}".` }], isError: true };
      }
      toolId = tool.id;
    }
    const result = db
      .prepare("INSERT INTO blockers (description, severity, tool_id) VALUES (?, ?, ?)")
      .run(description, severity ?? "medium", toolId);
    const created = db.prepare("SELECT * FROM blockers WHERE id = ?").get(result.lastInsertRowid);
    return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
  }
);

server.registerTool(
  "resolve_blocker",
  {
    title: "Resolve blocker",
    description: "Mark a blocker as resolved.",
    inputSchema: {
      id: z.number().describe("Blocker id to resolve"),
    },
  },
  async ({ id }) => {
    db.prepare("UPDATE blockers SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?").run(id);
    const updated = db.prepare("SELECT * FROM blockers WHERE id = ?").get(id);
    if (!updated) {
      return { content: [{ type: "text", text: `No blocker found with id ${id}.` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error running streamersuite-mcp-planner:", err);
  process.exit(1);
});
