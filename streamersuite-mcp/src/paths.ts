import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DOCS_DIR = path.join(PACKAGE_ROOT, "..", "Documentation");
export const README_PATH = path.join(DOCS_DIR, "README.md");
