import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { LanguageGroups } from "@astrojs/starlight/expressive-code";
import { docsFolder, guideRoot, listFiles, listSectionPaths, readBlockLanguage, readBlockTitle, readCodeBlocks } from "./support.mjs";
import { readLineRanges } from "./terminal-html.mjs";

const checkpointsFolder = join(guideRoot, "checkpoints");
const testModuleStart = "#[cfg(test)]";
const hasContextFlag = (meta) => /(^|\s)context(\s|$)/.test(meta);
const isTerminalFence = (block) => LanguageGroups.terminal.includes(readBlockLanguage(block.meta));

function normalize(lines) {
  const trimmed = lines.map((line) => line.replace(/\s+$/, ""));
  while (trimmed.length > 0 && trimmed[0] === "") trimmed.shift();
  while (trimmed.length > 0 && trimmed.at(-1) === "") trimmed.pop();
  return trimmed.join("\n");
}

function readCheckpointFile(checkpoint, path) {
  const file = join(checkpointsFolder, checkpoint, path);
  if (!existsSync(file)) return undefined;
  const lines = readFileSync(file, "utf8").split("\n");
  const testModule = lines.findIndex((line) => line.trim() === testModuleStart);
  return normalize(testModule === -1 ? lines : lines.slice(0, testModule));
}

function listCheckpointPaths() {
  const paths = new Set();
  for (const entry of readdirSync(checkpointsFolder, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = join(checkpointsFolder, entry.name);
    for (const file of listFiles(folder)) paths.add(relative(folder, file));
  }
  return paths;
}

function readFileBlocks(source) {
  return readCodeBlocks(source)
    .filter((block) => !isTerminalFence(block))
    .map((block) => {
      const inserted = new Set(readLineRanges(block.meta, "ins"));
      const removed = new Set(readLineRanges(block.meta, "del"));
      return {
        title: readBlockTitle(block.meta),
        hasContext: hasContextFlag(block.meta),
        startsAs: normalize(block.lines.filter((_, index) => !inserted.has(index + 1))),
        endsAs: normalize(block.lines.filter((_, index) => !removed.has(index + 1))),
      };
    });
}

function findContextProblems() {
  const checkpointPaths = listCheckpointPaths();
  const wholeAfterBlock = new Map();
  const shownBefore = new Set();
  const problems = [];
  let checked = 0;
  let previousCheckpoint;
  for (const docsPath of listSectionPaths()) {
    const source = readFileSync(docsPath, "utf8");
    const checkpoint = source.match(/^checkpoint:\s*(\S+)/m)?.[1];
    if (previousCheckpoint) {
      for (const path of checkpointPaths) {
        const text = readCheckpointFile(previousCheckpoint, path);
        if (text !== undefined) wholeAfterBlock.set(path, text);
      }
    }
    readFileBlocks(source).forEach((block, index) => {
      if (!checkpointPaths.has(block.title)) return;
      const finalFile = checkpoint ? readCheckpointFile(checkpoint, block.title) : undefined;
      const createsTheFile = !shownBefore.has(block.title);
      const extendsTheFile = wholeAfterBlock.get(block.title) === block.startsAs;
      const endsTheFile = finalFile !== undefined && block.endsAs === finalFile;
      const showsWholeFile = createsTheFile || extendsTheFile || endsTheFile;
      shownBefore.add(block.title);
      if (showsWholeFile) wholeAfterBlock.set(block.title, block.endsAs);
      else wholeAfterBlock.delete(block.title);
      if (finalFile === undefined) return;
      checked += 1;
      if (block.hasContext === showsWholeFile) {
        const page = relative(docsFolder, docsPath);
        problems.push(
          showsWholeFile
            ? `${page}, block ${index + 1} "${block.title}" shows the whole file and has a context mark`
            : `${page}, block ${index + 1} "${block.title}" shows only a part of the file and has no context mark`,
        );
      }
    });
    if (checkpoint) previousCheckpoint = checkpoint;
  }
  return { checked, problems };
}

test("a block that shows a file of its checkpoint carries context exactly when it shows only a part of that file", () => {
  assert.deepEqual(findContextProblems().problems, []);
});

test("the context check reads the blocks of every section that has a checkpoint", () => {
  const { checked } = findContextProblems();
  assert.ok(checked >= 60, `only ${checked} blocks were checked`);
});
