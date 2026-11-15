import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { readHeaderBlocks, readPageLandmarks, readSectionLinks } from "./header-html.mjs";
import { countCodeLines, countWords, exerciseNumbers, pageId, readingMinutes, usesTildeFence } from "./page-metrics.mjs";
import { builtFolder, builtPageOf, docsFolder, guideRoot, listFiles, listSectionPaths, withoutBase } from "./support.mjs";

const expectedLabels = ["Sección", "Lectura", "Ejercicios"];
const fence = "`".repeat(3);
const mdx = (...lines) => lines.join("\n");
const repeatWords = (count) => Array.from({ length: count }, () => "word").join(" ");

test("the words of the prose count, and nothing that is markup or code does", () => {
  const source = mdx(
    "---",
    "title: 9z · Una página",
    "---",
    "",
    'import { Aside } from "@astrojs/starlight/components";',
    "",
    "## Un título",
    "",
    '<Aside type="note" title="Analogía">',
    "Una **idea** con `código en línea` y <Term id=\"x\">un término</Term>.",
    "</Aside>",
    "",
    "1. Primero",
    "- Segundo ... → ·",
    "",
    "| Situación | Qué usar |",
    "|---|---|",
    "",
    `${fence}sh title="En Linux"`,
    "ls -la",
    "",
    "echo hola",
    fence,
  );
  assert.equal(countWords(source), 16);
  assert.equal(countCodeLines(source), 2);
});

test("a tag-like text inside inline code is a word of the prose, not a tag", () => {
  assert.equal(countWords("Escribe `kill -9 <PID>` ahora."), 5);
});

test("a tag that spans several lines is not prose", () => {
  assert.equal(countWords(mdx("<Step", '  call="unshare(CloneFlags::CLONE_NEWUTS)"', ">", "Hola", "</Step>")), 1);
});

test("code inside a list item is counted, with its blank lines left out", () => {
  const source = mdx("1. Paso", "", `   ${fence}rust title="src/a.rs"`, "   fn main() {}", "", "   fn other() {}", `   ${fence}`);
  assert.equal(countCodeLines(source), 2);
  assert.equal(countWords(source), 1);
});

test("the reading minutes are 5 times the nearest 5 minutes, with a floor of 5", () => {
  assert.equal(readingMinutes(repeatWords(10)), 5);
  assert.equal(readingMinutes(repeatWords(1499)), 5);
  assert.equal(readingMinutes(repeatWords(1500)), 10);
  assert.equal(readingMinutes(repeatWords(2499)), 10);
  assert.equal(readingMinutes(repeatWords(2500)), 15);
});

test("the code lines weigh one minute for each 10 lines", () => {
  const lines = Array.from({ length: 75 }, (_, index) => `let a${index} = 1;`);
  assert.equal(readingMinutes(mdx(`${fence}rust`, ...lines, fence)), 10);
});

test("the exercises of a page are the headings that carry its own id", () => {
  const source = mdx(
    "---",
    "title: 2b · Algo",
    "---",
    "",
    "## Ejercicios",
    "",
    "### 2b.1 Uno",
    "### 2b.2 Dos",
    "### 2c.1 Ajeno",
    `${fence}sh`,
    "### 2b.3 Dentro de un bloque",
    fence,
  );
  assert.deepEqual(exerciseNumbers(source), [1, 2]);
  assert.equal(pageId(source), "2b");
});

const sectionPaths = listSectionPaths();

function sourceOf(docsPath) {
  return readFileSync(docsPath, "utf8");
}

function readBuilt(docsPath) {
  return readFileSync(builtPageOf(docsPath), "utf8");
}

function menuOrder() {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
  const hrefs = readSectionLinks(readFileSync(join(builtFolder, "index.html"), "utf8"));
  return hrefs.map((href) => join(docsFolder, `${withoutBase(href).replace(/^\/|\/$/g, "")}.mdx`));
}

function readOnlyBlock(docsPath) {
  const blocks = readHeaderBlocks(readBuilt(docsPath));
  assert.equal(blocks.length, 1, `${relative(docsFolder, docsPath)}: expected exactly one properties block, found ${blocks.length}`);
  return blocks[0];
}

test("a ~~~ fence is detected, with or without indentation", () => {
  assert.equal(usesTildeFence(mdx("Texto", "~~~sh", "ls", "~~~")), true);
  assert.equal(usesTildeFence(mdx("1. Paso", "", "   ~~~sh", "   ls", "   ~~~")), true);
  assert.equal(usesTildeFence(mdx("Texto", `${fence}sh`, "ls", fence, "Una tilde ~ suelta y ~~ dos")), false);
});

test("no section page uses a ~~~ fence, because the reading formula only recognises backtick fences", () => {
  const offenders = sectionPaths.filter((path) => usesTildeFence(sourceOf(path))).map((path) => relative(docsFolder, path));
  assert.deepEqual(offenders, [], "these pages use ~~~ fences: their code lines would count as prose");
});

test("the section pages are the ones the sidebar lists inside its groups", () => {
  assert.deepEqual([...menuOrder()].sort(), sectionPaths);
  assert.ok(sectionPaths.length >= 6, "the guide has at least the section pages 0a to 2c");
});

for (const docsPath of sectionPaths) {
  const name = relative(docsFolder, docsPath);

  test(`${name}: the properties block has the rows Sección, Lectura and Ejercicios, in that order`, () => {
    assert.deepEqual(readOnlyBlock(docsPath).rows.map((row) => row.label), expectedLabels);
  });

  test(`${name}: the properties block sits below the title and above the content`, () => {
    const { title, content } = readPageLandmarks(readBuilt(docsPath));
    const block = readOnlyBlock(docsPath);
    assert.ok(title >= 0 && content >= 0, "the page has no title or no content");
    assert.ok(title < block.index && block.index < content, "the block is not between the title and the content");
  });

  test(`${name}: Sección reads "n de N" with the position in the menu order`, () => {
    const order = menuOrder();
    const [section] = readOnlyBlock(docsPath).rows;
    assert.equal(section.value, `${order.indexOf(docsPath) + 1} de ${order.length}`);
  });

  test(`${name}: the bar has one segment per section and fills the first n`, () => {
    const order = menuOrder();
    const position = order.indexOf(docsPath) + 1;
    const { progress } = readOnlyBlock(docsPath).rows[0];
    assert.ok(progress, "the Sección row has no bar");
    assert.equal(progress.segments, order.length);
    assert.deepEqual(
      progress.filled,
      order.map((_, index) => index < position),
    );
  });

  test(`${name}: Ejercicios is the number of exercise headings of the page`, () => {
    const source = sourceOf(docsPath);
    const numbers = exerciseNumbers(source);
    assert.ok(numbers.length > 0, `${name} has no exercise headings with its own id`);
    assert.deepEqual(numbers, numbers.map((_, index) => index + 1), "the exercises are not numbered 1, 2, 3…");
    assert.equal(readOnlyBlock(docsPath).rows[2].value, String(numbers.length));
  });

  test(`${name}: the block states the words and the code lines the formula counted`, () => {
    const source = sourceOf(docsPath);
    const block = readOnlyBlock(docsPath);
    assert.equal(block.words, countWords(source));
    assert.equal(block.codeLines, countCodeLines(source));
  });

  test(`${name}: Lectura is "unos M min", with M from the formula, a multiple of 5 and at least 5`, () => {
    const source = sourceOf(docsPath);
    const minutes = readingMinutes(source);
    assert.ok(minutes >= 5 && minutes % 5 === 0, `the formula gave ${minutes}`);
    assert.equal(
      readOnlyBlock(docsPath).rows[1].value,
      `unos ${minutes} min`,
      `${countWords(source)} words and ${countCodeLines(source)} code lines`,
    );
  });
}

test("the cover, the closing page, the glossary and the 404 page have no properties block", () => {
  const pages = listFiles(builtFolder).filter((path) => path.endsWith(".html"));
  const outside = pages.filter((path) => !sectionPaths.some((docsPath) => builtPageOf(docsPath) === path));
  assert.ok(outside.length >= 2, "expected at least the cover and the glossary outside the sections");
  for (const path of outside) {
    assert.equal(readHeaderBlocks(readFileSync(path, "utf8")).length, 0, `${relative(builtFolder, path)} has a properties block`);
  }
});

test("the header stylesheet takes its colors from theme variables only", () => {
  const css = readFileSync(join(guideRoot, "src/styles/page-props.css"), "utf8");
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/);
});
