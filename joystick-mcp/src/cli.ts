import { readFile } from "node:fs/promises";
import path from "node:path";
import { JOYSTICK_DOC_PAGES } from "./pages.js";
import { DEFAULT_DOCS_DIR } from "./paths.js";

function printPage(p: (typeof JOYSTICK_DOC_PAGES)[number]) {
  console.log(`${p.section.padEnd(22)} ${p.title.padEnd(32)} ${p.url}`);
}

async function list() {
  console.log(`Joystick.tv developer docs — ${JOYSTICK_DOC_PAGES.length} pages\n`);
  let lastSection = "";
  for (const p of JOYSTICK_DOC_PAGES) {
    if (p.section !== lastSection) {
      console.log(`\n${p.section}`);
      lastSection = p.section;
    }
    console.log(`  - ${p.title.padEnd(32)} ${p.url}`);
  }
}

async function search(term: string, docsDir = DEFAULT_DOCS_DIR) {
  if (!term) {
    console.error("Usage: cli.ts search <term> [--dir <path>]");
    process.exitCode = 1;
    return;
  }
  const needle = term.toLowerCase();
  const titleMatches = JOYSTICK_DOC_PAGES.filter(
    (p) => p.title.toLowerCase().includes(needle) || p.section.toLowerCase().includes(needle)
  );

  const contentMatches: typeof JOYSTICK_DOC_PAGES = [];
  for (const p of JOYSTICK_DOC_PAGES) {
    try {
      const body = await readFile(path.join(docsDir, `${p.slug}.md`), "utf8");
      if (body.toLowerCase().includes(needle)) contentMatches.push(p);
    } catch {
      // page not fetched locally yet — skip content search for it
    }
  }

  const seen = new Set<string>();
  const results = [...titleMatches, ...contentMatches].filter((p) => {
    if (seen.has(p.slug)) return false;
    seen.add(p.slug);
    return true;
  });

  if (results.length === 0) {
    console.log(`No Joystick.tv docs pages matched "${term}".`);
    console.log(`Tip: run "npm run docs:joystick" first to fetch page bodies for full-text search.`);
    return;
  }

  console.log(`${results.length} page(s) matched "${term}":\n`);
  for (const p of results) printPage(p);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const dirIdx = rest.indexOf("--dir");
  const dir = dirIdx !== -1 ? rest[dirIdx + 1] : DEFAULT_DOCS_DIR;
  const term = dirIdx !== -1 ? rest.filter((_, i) => i !== dirIdx && i !== dirIdx + 1).join(" ") : rest.join(" ");

  switch (cmd) {
    case "list":
      await list();
      break;
    case "search":
      await search(term, dir);
      break;
    default:
      console.log("Usage: cli.ts <list|search> [term] [--dir <path>]");
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
