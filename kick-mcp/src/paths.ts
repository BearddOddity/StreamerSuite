import path from "node:path";
import { fileURLToPath } from "node:url";

// kick-mcp/src/paths.ts (or dist/paths.js) -> kick-mcp/ -> repo root -> kick-docs/
// Resolved from this file's own location so it's correct no matter what the
// caller's working directory is (npm --prefix, a plain `node dist/index.js`
// from the repo root, tsx run from within kick-mcp/, etc.).
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_DOCS_DIR = path.join(PACKAGE_ROOT, "..", "kick-docs");
