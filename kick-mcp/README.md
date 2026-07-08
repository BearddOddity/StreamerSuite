# streamersuite-kick-mcp

MCP server and CLI for browsing and searching [Kick's public developer documentation](https://docs.kick.com/).

The page list mirrors Kick's own docs table of contents
(https://github.com/KickEngineering/KickDevDocs/blob/main/SUMMARY.md).

## MCP tools

- `list_kick_docs_pages` — list all docs pages, optionally filtered by section.
- `search_kick_docs` — search by title/section, and by page body if fetched locally.
- `get_kick_docs_page` — fetch a single page's metadata and (if fetched) markdown body.

Registered in the repo's `.mcp.json` as `streamersuite-kick-mcp`; run `npm run build` here first so
`dist/index.js` exists.

## CLI

From the repo root:

```
npm run docs:kick          # fetch page bodies from GitHub into ./kick-docs
npm run docs:kick:list     # list all pages
npm run docs:kick:search -- <term>   # search titles/sections + fetched bodies
```
