import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { readCodeWindows, readExpectedRows, readLineRanges, readShouldSeeBlocks, readTerminalWindows } from "./terminal-html.mjs";
import {
  builtPageOf,
  docsFolder,
  guideRoot,
  listSectionPaths,
  readBlockLanguage,
  readBlockTitle,
  readCodeBlocks,
} from "./support.mjs";

const terminalLanguages = new Set(["sh", "bash", "shell", "zsh", "console"]);
const highlightedLanguages = new Set(["rust", "toml", "json"]);
const syntaxSpan = /<span\b[^>]*\bstyle="--0:/;
const anyStyledSpan = /<span\b[^>]*\bstyle=/;
const errorLine = /^(Error: |Caused by:)/;
const shouldSeeTitle = "Deberías ver";
const stderrKey = "stderr";
const prompt = "$ ";

const allPaths = [...listSectionPaths(), ...["index.mdx", "glossary.mdx"].map((name) => join(docsFolder, name))];

const readFences = (source, languages) => readCodeBlocks(source).filter((block) => languages.has(readBlockLanguage(block.meta)));

for (const docsPath of allPaths) {
  const name = relative(docsFolder, docsPath);
  const source = readFileSync(docsPath, "utf8");
  const terminalFences = readFences(source, terminalLanguages);
  const highlightedFences = readFences(source, highlightedLanguages);
  const readPage = () => {
    const page = builtPageOf(docsPath);
    assert.ok(existsSync(page), `${relative(guideRoot, page)} is missing: run astro build`);
    return readFileSync(page, "utf8");
  };

  test(`${name}: every sh block is drawn as a terminal window with the title the page gave it`, () => {
    const titles = readTerminalWindows(readPage()).map((window) => window.title);
    assert.deepEqual(titles, terminalFences.map((fence) => readBlockTitle(fence.meta) ?? ""));
  });

  test(`${name}: every terminal window has a title bar with three decorative dots`, () => {
    for (const window of readTerminalWindows(readPage())) {
      assert.ok(window.dots, `the window "${window.title}" has no dots`);
      assert.match(window.dots, /aria-hidden="true"/);
      assert.equal(window.dots.match(/<i><\/i>/g)?.length, 3, `the window "${window.title}" does not have three dots`);
    }
  });

  test(`${name}: every ShouldSee is one terminal window titled ${shouldSeeTitle}, with no eyes emoji and no label`, () => {
    const blocks = readShouldSeeBlocks(readPage());
    assert.equal(blocks.length, source.match(/<ShouldSee>/g)?.length ?? 0);
    for (const block of blocks) {
      assert.equal(block.windows.length, 1, "a ShouldSee does not hold exactly one code block");
      assert.ok(block.windows[0].classes.includes("is-terminal"), "the block of a ShouldSee is not a terminal window");
      assert.equal(block.windows[0].title, shouldSeeTitle);
      assert.ok(!block.html.includes("👀"), "a ShouldSee still shows the eyes emoji");
      assert.ok(!block.html.includes("should-see-label"), "a ShouldSee still has its own label");
    }
  });

  test(`${name}: no terminal window has syntax color spans`, () => {
    for (const window of readTerminalWindows(readPage())) {
      assert.ok(!anyStyledSpan.test(window.preHtml), `the window "${window.title}" has a styled span`);
    }
  });

  test(`${name}: the Rust, TOML and JSON blocks keep their syntax highlighting`, () => {
    const highlighted = readCodeWindows(readPage()).filter((window) => highlightedLanguages.has(window.language));
    assert.equal(highlighted.length, highlightedFences.length);
    for (const window of highlighted) {
      assert.ok(syntaxSpan.test(window.preHtml), `a ${window.language} block "${window.title}" lost its highlighting`);
    }
  });

  test(`${name}: the prompt is drawn by CSS, so no row and no copied line carries it`, () => {
    const windows = readTerminalWindows(readPage());
    terminalFences.forEach((fence, index) => {
      const expected = readExpectedRows(fence);
      const rows = windows[index].rows;
      assert.equal(rows.length, expected.length, `"${windows[index].title}" has a different number of rows`);
      expected.forEach((row, line) => {
        assert.equal(rows[line].text, row.text, `"${windows[index].title}", line ${line + 1}: the text differs`);
        assert.equal(rows[line].classes.includes("is-command"), row.isCommand, `"${windows[index].title}", line ${line + 1}: command mark`);
        assert.ok(!rows[line].text.startsWith(prompt));
      });
      assert.ok(windows[index].copiedLines.length > 0, `"${windows[index].title}" copies nothing`);
      for (const line of windows[index].copiedLines) assert.ok(!line.startsWith(prompt), `"${windows[index].title}" copies a prompt`);
    });
  });

  test(`${name}: the stderr lines are exactly the ones the page marked, and the title bar shows the stderr key`, () => {
    const windows = readTerminalWindows(readPage());
    terminalFences.forEach((fence, index) => {
      const expected = readExpectedRows(fence);
      windows[index].rows.forEach((row, line) => {
        assert.equal(row.classes.includes("is-stderr"), expected[line].isStderr, `"${windows[index].title}", line ${line + 1}: stderr mark`);
      });
      const hasStderr = expected.some((row) => row.isStderr);
      assert.equal(windows[index].key, hasStderr ? stderrKey : undefined, `"${windows[index].title}": stderr key`);
    });
  });

  test(`${name}: every Error: and Caused by: line of a terminal block is marked as stderr`, () => {
    for (const window of readTerminalWindows(readPage())) {
      for (const row of window.rows.filter((candidate) => errorLine.test(candidate.text))) {
        assert.ok(row.classes.includes("is-stderr"), `"${window.title}": "${row.text}" is not marked as stderr`);
      }
    }
  });

  test(`${name}: a terminal window scrolls sideways, so its lines never wrap`, () => {
    for (const window of readTerminalWindows(readPage())) {
      assert.ok(!/\sclass="[^"]*\bwrap\b[^"]*"/.test(window.pre), `the window "${window.title}" wraps its lines`);
      assert.match(window.pre, /\stabindex="0"/, `the window "${window.title}" cannot be scrolled with the keyboard`);
    }
  });
}

test("a stderr range lists lines and spans", () => {
  assert.deepEqual(readLineRanges('sh title="x" stderr={2-4,7}', "stderr"), [2, 3, 4, 7]);
  assert.deepEqual(readLineRanges('sh title="x"', "stderr"), []);
});
