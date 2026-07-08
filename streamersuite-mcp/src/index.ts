#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listDocs, searchDocs, getDocBody, addDoc, updateDoc } from "./docs.js";

const server = new McpServer({
  name: "streamersuite-mcp",
  version: "0.1.0",
});

server.registerTool(
  "list_streamersuite_docs",
  {
    title: "List StreamerSuite internal docs",
    description: "List all of StreamerSuite's own internal documentation pages (Documentation/*.md) with their titles and topics.",
    inputSchema: {},
  },
  async () => {
    const pages = await listDocs();
    return { content: [{ type: "text", text: JSON.stringify(pages, null, 2) }] };
  }
);

server.registerTool(
  "search_streamersuite_docs",
  {
    title: "Search StreamerSuite internal docs",
    description: "Search StreamerSuite's internal documentation by title, topic, and full page body.",
    inputSchema: {
      query: z.string().describe("Search term, e.g. 'tauri', 'oauth', 'overlay'"),
    },
  },
  async ({ query }) => {
    const results = await searchDocs(query);
    if (results.length === 0) {
      return { content: [{ type: "text", text: `No StreamerSuite docs matched "${query}".` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

server.registerTool(
  "get_streamersuite_doc",
  {
    title: "Get a StreamerSuite internal doc",
    description: "Fetch the full markdown body of one StreamerSuite internal documentation page.",
    inputSchema: {
      slug: z.string().describe("Doc slug from list_streamersuite_docs, e.g. '01-tauri-v2-architecture'"),
    },
  },
  async ({ slug }) => {
    const pages = await listDocs();
    const page = pages.find((p) => p.slug === slug);
    if (!page) {
      return { content: [{ type: "text", text: `No StreamerSuite doc with slug "${slug}".` }], isError: true };
    }
    const body = await getDocBody(page.file);
    return { content: [{ type: "text", text: JSON.stringify({ ...page, body }, null, 2) }] };
  }
);

server.registerTool(
  "add_streamersuite_doc",
  {
    title: "Add a new StreamerSuite internal doc",
    description:
      "Create a new numbered page under Documentation/ (e.g. '09-my-topic.md') with the given title and markdown body, and add it to Documentation/README.md's index table.",
    inputSchema: {
      title: z.string().describe("Page title, e.g. 'Discord Rich Presence Integration'"),
      topic: z.string().optional().describe("One-line summary for the README index table"),
      body: z.string().describe("Markdown content for the page (the '# Title' heading is added automatically)"),
    },
  },
  async ({ title, topic, body }) => {
    const page = await addDoc(title, topic ?? "", body);
    return { content: [{ type: "text", text: `Created ${page.file}\n\n${JSON.stringify(page, null, 2)}` }] };
  }
);

server.registerTool(
  "update_streamersuite_doc",
  {
    title: "Update a StreamerSuite internal doc",
    description: "Append to (default) or fully replace the content of an existing StreamerSuite internal documentation page.",
    inputSchema: {
      slug: z.string().describe("Doc slug from list_streamersuite_docs, e.g. '05-websocket-chat-integration'"),
      content: z.string().describe("Markdown content to append or to replace the file with"),
      mode: z.enum(["append", "replace"]).default("append").describe("'append' adds to the end of the page; 'replace' overwrites the whole file"),
    },
  },
  async ({ slug, content, mode }) => {
    try {
      const page = await updateDoc(slug, content, mode);
      return { content: [{ type: "text", text: `Updated ${page.file} (${mode})` }] };
    } catch (err) {
      return { content: [{ type: "text", text: (err as Error).message }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
