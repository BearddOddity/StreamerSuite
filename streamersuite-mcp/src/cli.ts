import { listDocs, searchDocs, getDocBody, addDoc } from "./docs.js";

function printPage(p: Awaited<ReturnType<typeof listDocs>>[number]) {
  const num = p.num ? `${p.num} ` : "";
  console.log(`${num}${p.title.padEnd(45)} ${p.topic ?? ""}`);
}

async function list() {
  const pages = await listDocs();
  console.log(`StreamerSuite internal docs — ${pages.length} pages\n`);
  for (const p of pages) printPage(p);
}

async function search(term: string) {
  if (!term) {
    console.error("Usage: cli.ts search <term>");
    process.exitCode = 1;
    return;
  }
  const results = await searchDocs(term);
  if (results.length === 0) {
    console.log(`No StreamerSuite docs matched "${term}".`);
    return;
  }
  console.log(`${results.length} page(s) matched "${term}":\n`);
  for (const p of results) printPage(p);
}

async function get(slug: string) {
  const pages = await listDocs();
  const page = pages.find((p) => p.slug === slug);
  if (!page) {
    console.error(`No StreamerSuite doc with slug "${slug}".`);
    process.exitCode = 1;
    return;
  }
  console.log(await getDocBody(page.file));
}

async function add(title: string, topic: string) {
  if (!title) {
    console.error("Usage: cli.ts add <title> [-- <topic>]  (body is read from stdin)");
    process.exitCode = 1;
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString("utf8");
  const page = await addDoc(title, topic, body);
  console.log(`Created ${page.file}`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "list":
      await list();
      break;
    case "search":
      await search(rest.join(" "));
      break;
    case "get":
      await get(rest[0] ?? "");
      break;
    case "add": {
      const dashIdx = rest.indexOf("--");
      const title = (dashIdx !== -1 ? rest.slice(0, dashIdx) : rest).join(" ");
      const topic = dashIdx !== -1 ? rest.slice(dashIdx + 1).join(" ") : "";
      await add(title, topic);
      break;
    }
    default:
      console.log("Usage: cli.ts <list|search|get|add> [args]");
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
