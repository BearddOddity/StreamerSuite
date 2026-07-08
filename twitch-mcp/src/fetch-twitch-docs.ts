import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { TWITCH_DOC_PAGES } from "./pages.js";
import { DEFAULT_DOCS_DIR } from "./paths.js";

function parseArgs(argv: string[]): { out: string } {
  const outIdx = argv.indexOf("--out");
  const out = outIdx !== -1 ? argv[outIdx + 1] : DEFAULT_DOCS_DIR;
  if (!out) throw new Error("--out requires a directory path");
  return { out };
}

/**
 * Twitch's docs are a rendered React app, not markdown source — do a best-effort
 * HTML-to-text strip. Every page shares the same sidebar/header/footer chrome
 * (it lists every doc section), so if we don't cut that out first, full-text
 * search matches almost every page on almost every query. Prefer the <main>
 * content region if present; always drop nav/header/footer/aside regardless.
 */
function htmlToText(html: string): string {
  const withoutScripts = html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "");
  const withoutChrome = withoutScripts.replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, "");

  const mainMatch = withoutChrome.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const articleMatch = withoutChrome.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const content = mainMatch?.[1] ?? articleMatch?.[1] ?? withoutChrome;

  const withoutTags = content.replace(/<[^>]+>/g, "\n");
  return withoutTags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2));
  await mkdir(out, { recursive: true });

  const index = TWITCH_DOC_PAGES.map(({ title, slug, section, url }) => ({ title, slug, section, url, file: `${slug}.md` }));
  await writeFile(path.join(out, "index.json"), JSON.stringify(index, null, 2));

  let ok = 0;
  let failed = 0;
  for (const page of TWITCH_DOC_PAGES) {
    try {
      const res = await fetch(page.url, { headers: { "User-Agent": "Mozilla/5.0 (streamersuite-twitch-mcp)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      await writeFile(path.join(out, `${page.slug}.md`), htmlToText(html));
      ok++;
      console.log(`fetched  ${page.section} / ${page.title}`);
    } catch (err) {
      failed++;
      console.warn(`skipped  ${page.section} / ${page.title} (${(err as Error).message})`);
    }
  }

  console.log(`\nDone. ${ok} page(s) fetched to ${out}, ${failed} failed.`);
  if (failed > 0) {
    console.log(
      `Note: dev.twitch.tv may block fetches from some sandboxed/CI networks (Cloudflare bot protection). ` +
        `Run this from an unrestricted network if pages are being skipped.`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
