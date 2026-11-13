import { readFileSync, readdirSync } from "node:fs";
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

export function readElement(html, start, tagName) {
  const tag = new RegExp(`<${tagName}\\b|</${tagName}>`, "g");
  tag.lastIndex = start;
  let depth = 0;
  for (let found = tag.exec(html); found; found = tag.exec(html)) {
    depth += found[0] === `</${tagName}>` ? -1 : 1;
    if (depth === 0) return html.slice(start, tag.lastIndex);
  }
  throw new Error(`a ${tagName} in the built page is never closed`);
}

export function readDiv(html, start) {
  return readElement(html, start, "div");
}

export const glossaryFile = join(guideRoot, "src/glossary.json");

export function readGlossaryEntries() {
  return JSON.parse(readFileSync(glossaryFile, "utf8"));
}

const entityValues = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&amp;": "&" };

export function decodeEntities(text) {
  return text.replace(/&(?:lt|gt|quot|#39|amp);/g, (entity) => entityValues[entity]);
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

export function listSectionPaths() {
  return listFiles(docsFolder)
    .filter((path) => path.endsWith(".mdx"))
    .filter((path) => relative(docsFolder, path).includes("/"))
    .sort();
}

export function pageUrlOf(docsPath) {
  return `/${relative(docsFolder, docsPath).replace(/\.mdx$/, "")}/`;
}
