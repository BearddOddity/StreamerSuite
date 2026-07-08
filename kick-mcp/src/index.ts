#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { KICK_DOC_PAGES } from "./pages.js";
import { DEFAULT_DOCS_DIR } from "./paths.js";

const server = new McpServer({
  name: "streamersuite-kick-mcp",
  version: "0.1.0",
});

server.registerTool(
  "list_kick_docs_pages",
  {
    title: "List Kick developer docs pages",
    description:
      "List every page in Kick's public developer documentation (docs.kick.com), grouped by section, with each page's title and URL.",
    inputSchema: {
      section: z.string().optional().describe("Only return pages in this section, e.g. 'APIs', 'Events', 'Getting Started'"),
    },
  },
  async ({ section }) => {
    const pages = section
      ? KICK_DOC_PAGES.filter((p) => p.section.toLowerCase() === section.toLowerCase())
      : KICK_DOC_PAGES;
    if (pages.length === 0) {
      return { content: [{ type: "text", text: `No Kick docs pages found for section "${section}".` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(pages, null, 2) }] };
  }
);

server.registerTool(
  "search_kick_docs",
  {
    title: "Search Kick developer docs",
    description:
      "Search Kick's developer documentation by title/section, and by page body if pages have been fetched locally via the fetch-docs script.",
    inputSchema: {
      query: z.string().describe("Search term, e.g. 'webhook', 'chat', 'oauth'"),
      docsDir: z.string().optional().describe("Directory of fetched doc bodies (defaults to the repo's kick-docs/ folder)"),
    },
  },
  async ({ query, docsDir }) => {
    const needle = query.toLowerCase();
    const dir = docsDir ?? DEFAULT_DOCS_DIR;
    const titleMatches = KICK_DOC_PAGES.filter(
      (p) => p.title.toLowerCase().includes(needle) || p.section.toLowerCase().includes(needle)
    );

    const contentMatches: typeof KICK_DOC_PAGES = [];
    for (const p of KICK_DOC_PAGES) {
      try {
        const body = await readFile(path.join(dir, `${p.slug}.md`), "utf8");
        if (body.toLowerCase().includes(needle)) contentMatches.push(p);
      } catch {
        // page not fetched locally — title/section match only
      }
    }

    const seen = new Set<string>();
    const results = [...titleMatches, ...contentMatches].filter((p) => {
      if (seen.has(p.slug)) return false;
      seen.add(p.slug);
      return true;
    });

    if (results.length === 0) {
      return {
        content: [{ type: "text", text: `No Kick docs pages matched "${query}".` }],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

server.registerTool(
  "get_kick_docs_page",
  {
    title: "Get a Kick docs page",
    description: "Fetch a single Kick developer docs page's title, section, URL, and (if fetched locally) its markdown body.",
    inputSchema: {
      slug: z.string().describe("Page slug from list_kick_docs_pages, e.g. 'chat', 'webhook-security'"),
      docsDir: z.string().optional().describe("Directory of fetched doc bodies (defaults to the repo's kick-docs/ folder)"),
    },
  },
  async ({ slug, docsDir }) => {
    const page = KICK_DOC_PAGES.find((p) => p.slug === slug);
    if (!page) {
      return { content: [{ type: "text", text: `No Kick docs page with slug "${slug}".` }], isError: true };
    }
    const dir = docsDir ?? DEFAULT_DOCS_DIR;
    let body: string | undefined;
    try {
      body = await readFile(path.join(dir, `${page.slug}.md`), "utf8");
    } catch {
      body = undefined;
    }
    return { content: [{ type: "text", text: JSON.stringify({ ...page, body }, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
