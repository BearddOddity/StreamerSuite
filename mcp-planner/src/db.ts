import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.STREAMERSUITE_MCP_DB ?? path.join(__dirname, "..", "planning.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planning',
  is_mvp INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  integration_status TEXT NOT NULL DEFAULT 'not started',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  milestone TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned',
  tool_id INTEGER REFERENCES tools(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rationale TEXT NOT NULL DEFAULT '',
  tool_id INTEGER REFERENCES tools(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blockers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  tool_id INTEGER REFERENCES tools(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
`);
