import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { test } from "node:test";
import { declares, readSiteCssRules } from "./css-rules.mjs";
import { readContentsLinks, readSectionIds } from "./outline-html.mjs";
import { builtFolder, builtPageOf, docsFolder, listSectionPaths } from "./support.mjs";

const sectionPaths = listSectionPaths();
const decimalCounter = /counter\(([a-z-]+),\s*decimal-leading-zero\)/;
const compact = (selector) => selector.replaceAll(" ", "");

function expectNumbering(rules, selectorPart) {
  const shown = rules.find(
    (rule) => compact(rule.selector).includes(selectorPart) && /::?before/.test(rule.selector) && decimalCounter.test(rule.body),
  );
  assert.ok(shown, `no rule shows a two-digit number on ${selectorPart}`);
  const counter = shown.body.match(decimalCounter)[1];
  assert.ok(
    rules.some((rule) => declares(rule, "counter-reset", counter)),
    `nothing resets the counter ${counter} used on ${selectorPart}`,
  );
  assert.ok(
    rules.some((rule) => compact(rule.selector).includes(selectorPart) && declares(rule, "counter-increment", counter)),
    `nothing on ${selectorPart} increments the counter ${counter}`,
  );
}

test("the site is built before checking the section marks", () => {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
});

test("there are section pages to check", () => {
  assert.ok(sectionPaths.length > 0, "no section page found");
});

for (const docsPath of sectionPaths) {
  test(`${relative(docsFolder, docsPath)}: the contents lists the ## sections in the same order, so chip n and contents number n are the same section`, () => {
    const html = readFileSync(builtPageOf(docsPath), "utf8");
    const sections = readSectionIds(html).map((id) => `#${id}`);
    assert.ok(sections.length > 0, "the page has no ## section");
    assert.ok(sections.length <= 99, "a two-digit chip cannot number more than 99 sections");
    assert.deepEqual(readContentsLinks(html, "starlight-toc"), sections, "the contents on the right");
    assert.deepEqual(readContentsLinks(html, "mobile-starlight-toc"), sections, "the contents on small screens");
  });
}

test("the section chips and both contents lists count with two digits", () => {
  const rules = readSiteCssRules();
  expectNumbering(rules, "level-h2");
  expectNumbering(rules, "starlight-toc>nav");
  expectNumbering(rules, "mobile-starlight-toc");
});

test("the number of a contents entry does not shrink, so a title on two lines never splits it", () => {
  const rules = readSiteCssRules();
  for (const part of ["starlight-toc>nav", "mobile-starlight-toc"]) {
    const number = rules.find(
      (rule) => compact(rule.selector).includes(part) && /::?before/.test(rule.selector) && decimalCounter.test(rule.body),
    );
    assert.ok(number, `no rule shows the number on ${part}`);
    assert.ok(
      declares(number, "flex", "none") || declares(number, "flex-shrink", "0"),
      `the number on ${part} can shrink: its rule must declare flex: none`,
    );
  }
});
