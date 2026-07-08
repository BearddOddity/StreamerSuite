import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_DOCS_DIR = path.join(PACKAGE_ROOT, "..", "joystick-docs");
