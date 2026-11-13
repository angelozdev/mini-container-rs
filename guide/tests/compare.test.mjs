import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { test } from "node:test";
import { builtFolder, builtPageOf, docsFolder, guideRoot, listFiles, textOf } from "./support.mjs";

const compareOpening = /<div\b[^>]*\bclass="compare not-content"[^>]*>/g;
const sideOpening = /^<div\b[^>]*\bclass="compare-side"[^>]*\sdata-side="(bad|good)"[^>]*>/;
const labelBlock = /<div\b[^>]*\bclass="compare-label"[^>]*>([\s\S]*?)<\/div>/;
const compareTag = /<Compare[\s>]/g;
const divTag = /<div\b|<\/div>/g;
const expectedSides = [
  { side: "bad", label: "Así no" },
  { side: "good", label: "Así sí" },
];

function readDiv(html, start) {
  divTag.lastIndex = start;
  let depth = 0;
  for (let tag = divTag.exec(html); tag; tag = divTag.exec(html)) {
    depth += tag[0] === "</div>" ? -1 : 1;
    if (depth === 0) return html.slice(start, divTag.lastIndex);
  }
  throw new Error("a div in the built page is never closed");
}

function readChildDivs(html) {
  const children = [];
  let start = html.indexOf("<div");
  while (start !== -1) {
    const child = readDiv(html, start);
    children.push(child);
    start = html.indexOf("<div", start + child.length);
  }
  return children;
}

function describeCompares(html) {
  return [...html.matchAll(compareOpening)].map((opening) => {
    const compare = readDiv(html, opening.index);
    const inside = compare.slice(opening[0].length, -"</div>".length);
    return readChildDivs(inside).map((side) => ({
      side: side.match(sideOpening)?.[1],
      label: textOf(side.match(labelBlock)?.[1] ?? ""),
      body: textOf(side.replace(labelBlock, "")),
    }));
  });
}

const pages = listFiles(docsFolder)
  .filter((path) => path.endsWith(".mdx"))
  .map((path) => ({ path, written: (readFileSync(path, "utf8").match(compareTag) ?? []).length }))
  .filter((page) => page.written > 0);

function builtComparesOf(docsPath) {
  const page = builtPageOf(docsPath);
  assert.ok(existsSync(page), `${relative(guideRoot, page)} is missing: run astro build`);
  return describeCompares(readFileSync(page, "utf8"));
}

test("the site is built before checking the compares", () => {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
});

for (const page of pages) {
  const name = relative(docsFolder, page.path);

  test(`${name}: every written Compare appears in the built page`, () => {
    const compares = builtComparesOf(page.path);
    assert.equal(compares.length, page.written, `${name}: found ${compares.length} compares, wrote ${page.written}`);
  });

  test(`${name}: every compare shows the bad side and then the good side, each with its label and content`, () => {
    for (const sides of builtComparesOf(page.path)) {
      assert.deepEqual(
        sides.map(({ side, label }) => ({ side, label })),
        expectedSides,
        `${name}: a compare must hold exactly the bad and the good side, in that order`,
      );
      for (const { side, body } of sides) {
        assert.ok(body.length > 0, `${name}: the ${side} side of a compare is empty`);
      }
    }
  });
}
