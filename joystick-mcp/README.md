# streamersuite-joystick-mcp

MCP server and CLI for browsing and searching [Joystick.tv's developer/chatbot documentation](https://support.joystick.tv/developer_support).

Joystick.tv doesn't run a multi-page docs site like Kick or Twitch — its whole chatbot/API
guide lives on one page. The page list here mirrors that page's headings (sourced from
https://github.com/joysticktv/joysticktv.github.io), each sliced out into its own chunk.

## MCP tools

- `list_joystick_docs_pages` — list all doc sections, optionally filtered by section.
- `search_joystick_docs` — search by title/section, and by page body if fetched locally.
- `get_joystick_docs_page` — fetch a single section's metadata and (if fetched) markdown body.

Registered in the repo's `.mcp.json` as `streamersuite-joystick-mcp`; run `npm run build` here
first so `dist/index.js` exists.

## CLI

From the repo root:

```
npm run docs:joystick          # fetch page bodies from GitHub into ./joystick-docs
npm run docs:joystick:list     # list all sections
npm run docs:joystick:search -- <term>   # search titles/sections + fetched bodies
```
