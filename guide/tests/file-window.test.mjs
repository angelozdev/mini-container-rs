import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { LanguageGroups } from "@astrojs/starlight/expressive-code";
import { declares, readSiteCssRules } from "./css-rules.mjs";
import { readFileWindows } from "./file-html.mjs";
import { readCodeWindows, readExpectedRows, readLineRanges } from "./terminal-html.mjs";
import {
  builtFolder,
  builtPageOf,
  docsFolder,
  guideRoot,
  listSectionPaths,
  readBlockLanguage,
  readBlockTitle,
  readCodeBlocks,
  readDiv,
} from "./support.mjs";

const contextMark = "Contexto";
const languageLabels = ["Rust", "TOML", "JSON", "Text"];
const compareSideOpening = /<div\b[^>]*\bclass="compare-side"[^>]*>/g;
const allPaths = [...listSectionPaths(), ...["index.mdx", "glossary.mdx"].map((name) => join(docsFolder, name))];

const isTerminalFence = (block) => LanguageGroups.terminal.includes(readBlockLanguage(block.meta));
const hasContextFlag = (meta) => /(^|\s)context(\s|$)/.test(meta);

function readFileFences(source) {
  return readCodeBlocks(source)
    .filter((block) => !isTerminalFence(block))
    .map((block) => ({
      title: readBlockTitle(block.meta),
      meta: block.meta,
      lines: block.lines,
      inserted: new Set(readLineRanges(block.meta, "ins")),
      removed: new Set(readLineRanges(block.meta, "del")),
      hasContext: hasContextFlag(block.meta),
    }));
}

function readPage(docsPath) {
  const page = builtPageOf(docsPath);
  assert.ok(existsSync(page), `${relative(guideRoot, page)} is missing: run astro build`);
  return readFileSync(page, "utf8");
}

function readPageWindows(docsPath, fences) {
  const windows = readFileWindows(readPage(docsPath));
  assert.equal(windows.length, fences.length, "the page and the built site disagree on how many file blocks there are");
  return windows;
}

const compact = (selector) => selector.replaceAll(" ", "");

function findSignRule(rules, rowClass) {
  return rules.find(
    (rule) =>
      compact(rule.selector).includes(".is-file") &&
      compact(rule.selector).includes(`.ec-line.${rowClass}`) &&
      /::?before/.test(rule.selector) &&
      /content:/.test(rule.body),
  );
}

test("the site is built before checking the file windows", () => {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
});

for (const docsPath of allPaths) {
  const name = relative(docsFolder, docsPath);
  const source = readFileSync(docsPath, "utf8");
  const fences = readFileFences(source);

  test(`${name}: every code block that is not a terminal is a file window with a tab that shows its title`, () => {
    const html = readPage(docsPath);
    const strays = readCodeWindows(html).filter((window) => !window.classes.includes("is-terminal") && !window.classes.includes("is-file"));
    assert.equal(strays.length, 0, `${strays.length} code blocks are neither a terminal window nor a file window`);
    readPageWindows(docsPath, fences).forEach((window, index) => {
      const title = fences[index].title;
      assert.ok(title, `block ${index + 1} of the page has no title, so it has nothing to show in its tab`);
      assert.ok(window.hasTab, `"${title}" has no tab`);
      assert.ok(window.hasIcon, `"${title}" has no decorative file icon in its tab`);
      assert.equal(window.tabTitle, title, `the tab of "${title}" shows another text`);
    });
  });

  test(`${name}: a file window has the three decorative dots of the terminal and no loose language label`, () => {
    for (const window of readPageWindows(docsPath, fences)) {
      assert.equal(window.dotCount, 3, `"${window.tabTitle}" does not have three dots`);
      assert.equal(window.headerText, `${window.tabTitle}${window.note ?? ""}`, `"${window.tabTitle}": the title bar shows text besides the tab and the mark`);
      for (const label of languageLabels) {
        assert.ok(!window.headerText.includes(label) || window.tabTitle.includes(label), `"${window.tabTitle}" shows the label ${label}`);
      }
    }
  });

  test(`${name}: the rows are the lines of the page with no sign inside, and the added and removed rows are the marked ones`, () => {
    readPageWindows(docsPath, fences).forEach((window, index) => {
      const fence = fences[index];
      assert.deepEqual(
        window.rows.map((row) => row.text),
        fence.lines,
        `"${window.tabTitle}": the text of the rows is not the text of the page`,
      );
      window.rows.forEach((row, line) => {
        assert.equal(row.classes.includes("ins"), fence.inserted.has(line + 1), `"${window.tabTitle}", line ${line + 1}: added mark`);
        assert.equal(row.classes.includes("del"), fence.removed.has(line + 1), `"${window.tabTitle}", line ${line + 1}: removed mark`);
      });
      assert.equal(window.hasMarks, fence.inserted.size + fence.removed.size > 0, `"${window.tabTitle}": the marks column`);
    });
  });

  test(`${name}: the copy button gives the file as it ends up, without the removed lines`, () => {
    readPageWindows(docsPath, fences).forEach((window, index) => {
      const fence = fences[index];
      assert.ok(window.hasCopyButton, `"${window.tabTitle}" has no copy button`);
      const kept = fence.lines.filter((_, line) => !fence.removed.has(line + 1));
      assert.deepEqual(window.copiedLines, kept, `"${window.tabTitle}" copies something other than the lines that stay`);
    });
  });

  test(`${name}: the Contexto mark is on the blocks where the page puts the context flag, and nowhere else`, () => {
    readPageWindows(docsPath, fences).forEach((window, index) => {
      assert.equal(window.note, fences[index].hasContext ? contextMark : undefined, `"${window.tabTitle}": the Contexto mark`);
    });
  });

  test(`${name}: a file window scrolls sideways, so its lines never wrap, and the keyboard can scroll it`, () => {
    for (const window of readPageWindows(docsPath, fences)) {
      assert.ok(!/\sclass="[^"]*\bwrap\b[^"]*"/.test(window.pre), `"${window.tabTitle}" wraps its lines`);
      assert.equal(window.tabindex, "0", `"${window.tabTitle}" cannot be scrolled with the keyboard`);
      assert.equal(window.role, "region", `"${window.tabTitle}" has no region role`);
      assert.equal(window.ariaLabel, `Código de ${window.tabTitle}`, `"${window.tabTitle}": the label of the scrolling region`);
    }
  });

  test(`${name}: every block of a Compare shows only a piece of code, so it carries the Contexto mark`, () => {
    const html = readPage(docsPath);
    for (const side of html.matchAll(compareSideOpening)) {
      for (const window of readFileWindows(readDiv(html, side.index))) {
        assert.equal(window.note, contextMark, `the Compare block "${window.tabTitle}" has no Contexto mark`);
      }
    }
  });

  test(`${name}: the terminal windows are not file windows and still copy only their command lines`, () => {
    const terminalFences = readCodeBlocks(source).filter(isTerminalFence);
    const terminals = readCodeWindows(readPage(docsPath)).filter((window) => window.classes.includes("is-terminal"));
    assert.equal(terminals.length, terminalFences.length);
    terminals.forEach((window, index) => {
      assert.ok(!window.classes.includes("is-file"), `the terminal "${window.title}" is also a file window`);
      assert.ok(!/class="[^"]*\bfile-(tab|note|icon)\b/.test(window.html), `the terminal "${window.title}" has file window parts`);
      const commands = readExpectedRows(terminalFences[index]).filter((row) => row.isCommand).map((row) => row.text);
      assert.equal(window.hasCopyButton, commands.length > 0, `the terminal "${window.title}": copy button`);
      if (commands.length > 0) assert.deepEqual(window.copiedLines, commands, `the terminal "${window.title}" copies something other than its commands`);
    });
  });
}

test("the built stylesheet draws a + on the added rows and a − on the removed ones, as generated content", () => {
  const rules = readSiteCssRules();
  const added = findSignRule(rules, "ins");
  const removed = findSignRule(rules, "del");
  assert.ok(added, "no rule draws the sign of an added row");
  assert.ok(removed, "no rule draws the sign of a removed row");
  assert.match(added.body, /content:"\+"/);
  assert.match(removed.body, /content:"−"/);
});

test("the sign column is not selectable, so a selection never takes a sign with it, and it stays in place while the code scrolls sideways", () => {
  const gutter = readSiteCssRules().find(
    (rule) =>
      compact(rule.selector).includes(".is-file") &&
      compact(rule.selector).includes(".has-marks") &&
      /::?before/.test(rule.selector) &&
      declares(rule, "position", "sticky"),
  );
  assert.ok(gutter, "no rule makes the sign column sticky");
  assert.ok(declares(gutter, "left", "0"), "the sticky sign column is not pinned to the left edge");
  assert.ok(declares(gutter, "user-select", "none"), "the sign column can be selected");
});

test("no rule of the built stylesheet writes a language label in a title bar", () => {
  const labels = readSiteCssRules().filter(
    (rule) => /\.header(::?after|::?before)/.test(compact(rule.selector)) && /content:"(Rust|TOML|JSON|Text)"/.test(rule.body),
  );
  assert.equal(labels.length, 0, `${labels.length} rules still draw a language label`);
});
