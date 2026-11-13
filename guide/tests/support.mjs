import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const guideRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const ignoredFolders = new Set(["node_modules", "dist", ".astro", "target"]);

export function listFiles(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredFolders.has(entry.name)) return [];
    const path = join(folder, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}
