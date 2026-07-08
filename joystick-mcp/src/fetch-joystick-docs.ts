import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { JOYSTICK_DOC_PAGES } from "./pages.js";
import { DEFAULT_DOCS_DIR } from "./paths.js";

const RAW_BASE = "https://raw.githubusercontent.com/joysticktv/joysticktv.github.io/main/";
const DEV_SUPPORT_SOURCE = "developer_support.md";
const CHANGELOG_SOURCE = "changelog.md";

function parseArgs(argv: string[]): { out: string } {
  const outIdx = argv.indexOf("--out");
  const out = outIdx !== -1 ? argv[outIdx + 1] : DEFAULT_DOCS_DIR;
  if (!out) throw new Error("--out requires a directory path");
  return { out };
}

/** Splits the single developer_support.md page into one chunk per ## / ### heading. */
function splitByHeading(markdown: string): Map<string, string> {
  const lines = markdown.split("\n");
  const headingLineIdx: { text: string; idx: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]?.match(/^(#{2,3})\s+(.+)$/);
    if (m) headingLineIdx.push({ text: m[2]!.trim(), idx: i });
  }
  const chunks = new Map<string, string>();
  for (let i = 0; i < headingLineIdx.length; i++) {
    const cur = headingLineIdx[i]!;
    const nextIdx = headingLineIdx[i + 1]?.idx ?? lines.length;
    chunks.set(cur.text, lines.slice(cur.idx, nextIdx).join("\n").trim());
  }
  return chunks;
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2));
  await mkdir(out, { recursive: true });

  const index = JOYSTICK_DOC_PAGES.map(({ title, slug, section, url }) => ({ title, slug, section, url, file: `${slug}.md` }));
  await writeFile(path.join(out, "index.json"), JSON.stringify(index, null, 2));

  let ok = 0;
  let failed = 0;

  try {
    const res = await fetch(RAW_BASE + DEV_SUPPORT_SOURCE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    const chunks = splitByHeading(body);
    for (const page of JOYSTICK_DOC_PAGES) {
      if (!page.heading) continue;
      const chunk = chunks.get(page.heading);
      if (!chunk) {
        failed++;
        console.warn(`skipped  ${page.section} / ${page.title} (heading not found in source)`);
        continue;
      }
      await writeFile(path.join(out, `${page.slug}.md`), chunk);
      ok++;
      console.log(`fetched  ${page.section} / ${page.title}`);
    }
  } catch (err) {
    failed += JOYSTICK_DOC_PAGES.filter((p) => p.heading).length;
    console.warn(`skipped  developer_support.md (${(err as Error).message})`);
  }

  try {
    const res = await fetch(RAW_BASE + CHANGELOG_SOURCE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await writeFile(path.join(out, "changelog.md"), await res.text());
    ok++;
    console.log(`fetched  Overview / Changelog`);
  } catch (err) {
    failed++;
    console.warn(`skipped  Overview / Changelog (${(err as Error).message})`);
  }

  console.log(`\nDone. ${ok} page(s) fetched to ${out}, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
