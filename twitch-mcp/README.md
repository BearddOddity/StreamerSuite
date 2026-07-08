# streamersuite-twitch-mcp

MCP server and CLI for browsing and searching [Twitch's developer documentation](https://dev.twitch.tv/docs).

Unlike Kick, Twitch doesn't publish its docs source in a public repo, so `pages.ts` is a
curated, manually-verified list of top-level doc pages (title/section/URL) rather than a
machine-generated index. Re-verify against https://dev.twitch.tv/docs if Twitch reorganizes.

`fetch-twitch-docs.ts` fetches each page live and does a best-effort HTML-to-text strip (Twitch's
docs are a rendered React app, not markdown). **Note:** dev.twitch.tv blocks some sandboxed/CI
networks (Cloudflare bot protection returned 403 when this was built) — run the fetch step from
an unrestricted network if pages come back skipped.

## MCP tools

- `list_twitch_docs_pages` — list all docs pages, optionally filtered by section.
- `search_twitch_docs` — search by title/section, and by page body if fetched locally.
- `get_twitch_docs_page` — fetch a single page's metadata and (if fetched) text body.

Registered in the repo's `.mcp.json` as `streamersuite-twitch-mcp`; run `npm run build` here
first so `dist/index.js` exists.

## CLI

From the repo root:

```
npm run docs:twitch          # fetch page bodies into ./twitch-docs
npm run docs:twitch:list     # list all pages
npm run docs:twitch:search -- <term>   # search titles/sections + fetched bodies
```
