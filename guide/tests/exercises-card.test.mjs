import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { countHintsInPage, readExercisesCards, readRightColumn, readSmallScreenContents } from "./card-html.mjs";
import { readHeaderBlocks } from "./header-html.mjs";
import { readSectionHeadings } from "./outline-html.mjs";
import { exerciseNumbers, expectedCardLine, hintCount } from "./page-metrics.mjs";
import { builtFolder, builtPageOf, docsFolder, listFiles, listSectionPaths } from "./support.mjs";
import { summarizeExercises } from "../src/lib/exercises-card.ts";

const sectionPaths = listSectionPaths();
const otherPages = [
  ...listFiles(docsFolder)
    .filter((path) => path.endsWith(".mdx") && !sectionPaths.includes(path))
    .map((path) => ({ name: relative(docsFolder, path), builtPath: builtPageOf(path) })),
  { name: "404", builtPath: join(builtFolder, "404.html") },
];
const exercisesHeading = "Ejercicios";
const cardTitle = "Ir a los ejercicios";

const readBuilt = (docsPath) => readFileSync(builtPageOf(docsPath), "utf8");
const nameOf = (docsPath) => relative(docsFolder, docsPath);

function readOnlyCard(docsPath) {
  const cards = readExercisesCards(readBuilt(docsPath));
  assert.equal(cards.length, 1, `${nameOf(docsPath)}: expected exactly one card, found ${cards.length}`);
  return cards[0];
}

test("the site is built before checking the exercises card", () => {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
});

test("there are section pages and other pages to check", () => {
  assert.ok(sectionPaths.length >= 6, "the guide has at least the section pages 0a to 2c");
  assert.ok(otherPages.length >= 3, "expected at least the cover, the glossary and the 404");
});

for (const docsPath of sectionPaths) {
  const name = nameOf(docsPath);

  test(`${name}: the page has exactly one exercises card, titled "${cardTitle}"`, () => {
    assert.equal(readOnlyCard(docsPath).title, cardTitle);
  });

  test(`${name}: the card is in the right column after the contents, and the small-screen contents has none`, () => {
    const html = readBuilt(docsPath);
    const card = readOnlyCard(docsPath);
    const column = readRightColumn(html);
    assert.ok(column, "the page has no right column");
    assert.ok(column.index < card.index && card.index < column.index + column.html.length, "the card is outside the right column");
    assert.ok(card.index > html.indexOf("</starlight-toc>"), "the card is not below the contents");
    assert.equal(readExercisesCards(readSmallScreenContents(html)).length, 0, "the small-screen contents has a card");
  });

  test(`${name}: the card links to the "${exercisesHeading}" heading of the page`, () => {
    const html = readBuilt(docsPath);
    const headings = readSectionHeadings(html).filter((heading) => heading.text === exercisesHeading);
    assert.equal(headings.length, 1, `expected one "${exercisesHeading}" heading, found ${headings.length}`);
    assert.equal(readOnlyCard(docsPath).href, `#${headings[0].id}`);
    assert.equal(html.split(`id="${headings[0].id}"`).length - 1, 1, "the heading id is not unique in the page");
  });

  test(`${name}: the card line counts the exercises and the hints the page has`, () => {
    const source = readFileSync(docsPath, "utf8");
    assert.ok(exerciseNumbers(source).length > 0, `${name} has no exercise headings with its own id`);
    assert.ok(hintCount(source) > 0, `${name} has no hints`);
    assert.equal(readOnlyCard(docsPath).summary, expectedCardLine(source));
  });

  test(`${name}: the hints in the card line are the hints drawn in the page`, () => {
    const drawn = countHintsInPage(readBuilt(docsPath));
    assert.match(readOnlyCard(docsPath).summary, new RegExp(`· ${drawn} pistas?$`));
  });

  test(`${name}: the card repeats the Ejercicios row of the properties block`, () => {
    const [block] = readHeaderBlocks(readBuilt(docsPath));
    const exercises = block.rows.find((row) => row.label === exercisesHeading).value;
    assert.match(readOnlyCard(docsPath).summary, new RegExp(`^${exercises} ejercicios?\\b`));
  });
}

for (const page of otherPages) {
  test(`${page.name}: the cover, the closing page, the glossary and the 404 have no exercises card`, () => {
    assert.equal(readExercisesCards(readFileSync(page.builtPath, "utf8")).length, 0);
  });
}

test("one exercise and one hint are written in the singular", () => {
  assert.equal(summarizeExercises(1, 1), "1 ejercicio · 1 pista");
});

test("one exercise with several hints keeps the exercise in the singular and the hints in the plural", () => {
  assert.equal(summarizeExercises(1, 3), "1 ejercicio · 3 pistas");
});

test("several exercises with one hint keep the exercises in the plural and the hint in the singular", () => {
  assert.equal(summarizeExercises(2, 1), "2 ejercicios · 1 pista");
});

test("zero is written in the plural", () => {
  assert.equal(summarizeExercises(0, 0), "0 ejercicios · 0 pistas");
});
