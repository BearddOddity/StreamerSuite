import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { StreamerSuiteDocPage } from "./types.js";
import { DOCS_DIR, README_PATH } from "./paths.js";

const NUM_PREFIX = /^(\d{2})-(.+)$/;
const TABLE_ROW = /^\|\s*(\d{2})\s*\|\s*\[`([^`]+)`\]\([^)]+\)\s*\|\s*(.+?)\s*\|$/;

/** Windows checkouts (and Windows-authored edits) use \r\n; normalize so ^/$-anchored regexes below always see \n. */
function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

async function readFileNormalized(filePath: string): Promise<string> {
  return normalizeNewlines(await readFile(filePath, "utf8"));
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractTitle(markdown: string): string {
  const m = markdown.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim() ?? "Untitled";
}

async function readReadmeTopics(): Promise<Map<string, string>> {
  const topics = new Map<string, string>();
  try {
    const readme = await readFileNormalized(README_PATH);
    for (const line of readme.split("\n")) {
      const m = line.match(TABLE_ROW);
      if (m) topics.set(m[2]!, m[3]!);
    }
  } catch {
    // no README yet
  }
  return topics;
}

export async function listDocs(): Promise<StreamerSuiteDocPage[]> {
  const files = (await readdir(DOCS_DIR)).filter((f) => f.endsWith(".md") && f !== "README.md");
  const topics = await readReadmeTopics();
  const pages: StreamerSuiteDocPage[] = [];
  for (const file of files.sort()) {
    const slug = file.replace(/\.md$/, "");
    const numMatch = slug.match(NUM_PREFIX);
    const content = await readFileNormalized(path.join(DOCS_DIR, file));
    pages.push({
      num: numMatch?.[1] ?? "",
      slug,
      file,
      title: extractTitle(content),
      topic: topics.get(file),
    });
  }
  return pages.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function getDocBody(file: string): Promise<string> {
  return readFileNormalized(path.join(DOCS_DIR, file));
}

export async function searchDocs(query: string): Promise<StreamerSuiteDocPage[]> {
  const needle = query.toLowerCase();
  const pages = await listDocs();
  const results: StreamerSuiteDocPage[] = [];
  for (const p of pages) {
    const titleHit = p.title.toLowerCase().includes(needle) || (p.topic ?? "").toLowerCase().includes(needle);
    if (titleHit) {
      results.push(p);
      continue;
    }
    const body = await getDocBody(p.file);
    if (body.toLowerCase().includes(needle)) results.push(p);
  }
  return results;
}

async function nextDocNumber(): Promise<string> {
  const files = await readdir(DOCS_DIR);
  const nums = files.map((f) => f.match(NUM_PREFIX)?.[1]).filter((n): n is string => !!n).map(Number);
  const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
  return String(next).padStart(2, "0");
}

async function appendReadmeRow(file: string, topic: string): Promise<void> {
  let readme: string;
  try {
    readme = await readFileNormalized(README_PATH);
  } catch {
    return; // no README to update — not fatal
  }
  const num = file.match(NUM_PREFIX)?.[1] ?? "";
  const row = `| ${num} | [\`${file}\`](./${file}) | ${topic} |`;
  const lines = readme.split("\n");
  const headerIdx = lines.findIndex((l) => TABLE_ROW.test(l) || /^\|---/.test(l));
  if (headerIdx === -1) {
    // no table found — append to end of file as a fallback
    await writeFile(README_PATH, readme.trimEnd() + `\n\n${row}\n`);
    return;
  }
  let insertAt = headerIdx + 1;
  while (insertAt < lines.length && TABLE_ROW.test(lines[insertAt] ?? "")) insertAt++;
  lines.splice(insertAt, 0, row);
  await writeFile(README_PATH, lines.join("\n"));
}

export async function addDoc(title: string, topic: string, body: string): Promise<StreamerSuiteDocPage> {
  const num = await nextDocNumber();
  const slug = `${num}-${slugify(title)}`;
  const file = `${slug}.md`;
  const content = `# ${title}\n\n${body.trim()}\n`;
  await writeFile(path.join(DOCS_DIR, file), content);
  await appendReadmeRow(file, topic);
  return { num, slug, file, title, topic };
}

export async function updateDoc(slug: string, content: string, mode: "append" | "replace"): Promise<StreamerSuiteDocPage> {
  const pages = await listDocs();
  const page = pages.find((p) => p.slug === slug);
  if (!page) throw new Error(`No StreamerSuite doc with slug "${slug}".`);

  if (mode === "replace") {
    await writeFile(path.join(DOCS_DIR, page.file), content.trimEnd() + "\n");
  } else {
    const existing = await getDocBody(page.file);
    await writeFile(path.join(DOCS_DIR, page.file), existing.trimEnd() + "\n\n" + content.trim() + "\n");
  }

  const updatedContent = await getDocBody(page.file);
  return { ...page, title: extractTitle(updatedContent) };
}
