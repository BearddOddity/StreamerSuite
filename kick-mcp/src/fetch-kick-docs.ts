import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { KICK_DOC_PAGES } from "./pages.js";

const RAW_BASE = "https://raw.githubusercontent.com/KickEngineering/KickDevDocs/main/";

function parseArgs(argv: string[]): { out: string } {
  const outIdx = argv.indexOf("--out");
  const out = outIdx !== -1 ? argv[outIdx + 1] : "./kick-docs";
  if (!out) throw new Error("--out requires a directory path");
  return { out };
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2));
  await mkdir(out, { recursive: true });

  const index = KICK_DOC_PAGES.map(({ title, slug, section, path: srcPath, url }) => ({
    title,
    slug,
    section,
    url,
    file: `${slug}.md`,
    source: srcPath,
  }));
  await writeFile(path.join(out, "index.json"), JSON.stringify(index, null, 2));

  let ok = 0;
  let failed = 0;
  for (const page of KICK_DOC_PAGES) {
    const src = RAW_BASE + page.path;
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      await writeFile(path.join(out, `${page.slug}.md`), body);
      ok++;
      console.log(`fetched  ${page.section} / ${page.title}`);
    } catch (err) {
      failed++;
      console.warn(`skipped  ${page.section} / ${page.title} (${(err as Error).message})`);
    }
  }

  console.log(`\nDone. ${ok} page(s) fetched to ${out}, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
