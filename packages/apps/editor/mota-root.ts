import { existsSync } from "node:fs";
import path from "node:path";

const REQUIRED_PATHS = [
  "index.html",
  "main.js",
  "project/data.js",
  "_server/table/data.comment.js",
] as const;

export function resolveMotaJsRoot(value = process.env.MOTA_JS_ROOT): string {
  const root = value
    ? path.resolve(process.cwd(), value)
    : path.resolve(import.meta.dirname, "../../external/mota-js");
  const missing = REQUIRED_PATHS.filter((name) => !existsSync(path.join(root, name)));
  if (missing.length > 0) {
    throw new Error(
      `Invalid mota-js root ${root}; missing ${missing.join(", ")}. ` +
      "Run `git submodule update --init packages/external/mota-js` or set MOTA_JS_ROOT.",
    );
  }
  return root;
}

export const MOTA_JS_ROOT = resolveMotaJsRoot();
