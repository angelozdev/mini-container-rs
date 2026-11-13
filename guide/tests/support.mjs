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

const fence = /^(\s*)(`{3,})(.*)$/;
const closingFence = /^\s*`{3,}\s*$/;

export function readCodeBlocks(source) {
  const blocks = [];
  let open = null;
  for (const line of source.split("\n")) {
    if (!open) {
      const start = line.match(fence);
      if (start) open = { indent: start[1], meta: start[3], lines: [] };
      continue;
    }
    if (closingFence.test(line)) {
      blocks.push(open);
      open = null;
      continue;
    }
    open.lines.push(line.startsWith(open.indent) ? line.slice(open.indent.length) : line);
  }
  return blocks;
}

export function readBlockTitle(meta) {
  return meta.match(/\btitle="([^"]*)"/)?.[1];
}

export function readBlockLanguage(meta) {
  return meta.trim().split(/\s+/)[0];
}
