# streamersuite-mcp

MCP server and CLI over StreamerSuite's own internal documentation (`Documentation/*.md`
in the repo root). Unlike `kick-mcp`/`twitch-mcp`/`joystick-mcp`, which mirror read-only
external platform docs, this one is read **and write** — it's meant for the team to record
and look up information about StreamerSuite itself.

## MCP tools

- `list_streamersuite_docs` — list all internal doc pages with titles/topics.
- `search_streamersuite_docs` — search by title, topic, and full page body.
- `get_streamersuite_doc` — fetch one page's full markdown body.
- `add_streamersuite_doc` — create a new numbered page (e.g. `09-my-topic.md`) and add it
  to `Documentation/README.md`'s index table.
- `update_streamersuite_doc` — append to (default) or replace an existing page's content.

Registered in the repo's `.mcp.json` as `streamersuite-mcp`; run `npm run build` here first
so `dist/index.js` exists.

## CLI

From the repo root:

```
npm run docs:list                 # list all internal doc pages
npm run docs:search -- <term>     # search titles/topics + full body
```

The `add`/`get` subcommands are also available directly (`npm --prefix streamersuite-mcp run cli -- add "Title" -- "topic"`,
reading the body from stdin), but are primarily meant to be called as MCP tools.
