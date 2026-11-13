import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const guideRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const docsFolder = join(guideRoot, "src/content/docs");
export const builtFolder = join(guideRoot, "dist");

export function builtPageOf(docsPath) {
  const slug = relative(docsFolder, docsPath).replace(/\.mdx$/, "");
  return slug === "index" ? join(builtFolder, "index.html") : join(builtFolder, slug, "index.html");
}

export function textOf(html) {
  return html.replace(/<[^>]*>/g, "").trim();
}

export function attributeOf(tag, name) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

const divTag = /<div\b|<\/div>/g;

export function readDiv(html, start) {
  divTag.lastIndex = start;
  let depth = 0;
  for (let tag = divTag.exec(html); tag; tag = divTag.exec(html)) {
    depth += tag[0] === "</div>" ? -1 : 1;
    if (depth === 0) return html.slice(start, divTag.lastIndex);
  }
  throw new Error("a div in the built page is never closed");
}

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
