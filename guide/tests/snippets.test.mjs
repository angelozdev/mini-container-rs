import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { guideRoot, listFiles, readBlockTitle, readCodeBlocks } from "./support.mjs";

const docsFolder = join(guideRoot, "src/content/docs");
const checkpointsFolder = join(guideRoot, "checkpoints");

function readCheckpointId(source) {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/);
  const line = frontmatter?.[1].match(/^checkpoint:\s*(\S+)\s*$/m);
  return line ? line[1].replace(/^["']|["']$/g, "") : null;
}

function readMarkedLines(meta, name) {
  const marked = new Set();
  const match = meta.match(new RegExp(`\\b${name}=\\{([^}]*)\\}`));
  if (!match) return marked;
  for (const part of match[1].split(",")) {
    const range = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    assert.ok(range, `${name}={${match[1]}} only accepts numbers and ranges`);
    const first = Number(range[1]);
    const last = Number(range[2] ?? range[1]);
    for (let line = first; line <= last; line += 1) marked.add(line);
  }
  return marked;
}

function isCheckpointFile(title) {
  return title.startsWith("src/") || title === "Cargo.toml";
}

function readSnippets(source) {
  return readCodeBlocks(source)
    .map((block) => ({ title: readBlockTitle(block.meta), block }))
    .filter(({ title }) => title !== undefined && isCheckpointFile(title))
    .map(({ title, block }) => {
      const removed = readMarkedLines(block.meta, "del");
      const kept = block.lines.filter((_, index) => !removed.has(index + 1));
      return { title, text: kept.join("\n").trimEnd() };
    });
}

const pages = listFiles(docsFolder)
  .filter((path) => path.endsWith(".mdx"))
  .map((path) => ({ path, source: readFileSync(path, "utf8") }))
  .map(({ path, source }) => ({
    name: relative(docsFolder, path),
    checkpointId: readCheckpointId(source),
    snippets: readSnippets(source),
  }))
  .filter((page) => page.checkpointId !== null);

for (const page of pages) {
  const checkpointFolder = join(checkpointsFolder, page.checkpointId);

  test(`${page.name}: checkpoint ${page.checkpointId} exists`, () => {
    assert.ok(existsSync(checkpointFolder), `checkpoint ${page.checkpointId} does not exist`);
  });

  for (const snippet of page.snippets) {
    test(`${page.name}: ${snippet.title} appears in checkpoint ${page.checkpointId}`, () => {
      assert.ok(existsSync(checkpointFolder), `checkpoint ${page.checkpointId} does not exist`);
      const file = join(checkpointFolder, snippet.title);
      assert.ok(existsSync(file), `${snippet.title} does not exist in checkpoint ${page.checkpointId}`);
      assert.ok(
        readFileSync(file, "utf8").includes(snippet.text),
        `the chunk of ${snippet.title} does not appear as written in checkpoint ${page.checkpointId}`,
      );
    });
  }
}
