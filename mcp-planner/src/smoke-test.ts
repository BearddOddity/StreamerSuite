import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
  });
  const client = new Client({ name: "smoke-test", version: "0.1.0" });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log("Registered tools:", tools.tools.map((t) => t.name).join(", "));

  const listTools = await client.callTool({ name: "list_tools", arguments: {} });
  console.log("\nlist_tools ->", JSON.stringify(listTools.content, null, 2).slice(0, 500));

  const platforms = await client.callTool({ name: "get_platforms", arguments: {} });
  console.log("\nget_platforms ->", JSON.stringify(platforms.content, null, 2).slice(0, 500));

  const search = await client.callTool({ name: "search", arguments: { query: "Chat Manager" } });
  console.log("\nsearch(Chat Manager) ->", JSON.stringify(search.content, null, 2).slice(0, 500));

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
