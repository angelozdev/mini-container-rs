import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { declares, readSiteCssRules } from "./css-rules.mjs";
import { builtPageOf, docsFolder, hasClass, listSectionPaths } from "./support.mjs";

const sectionPaths = listSectionPaths();
const otherPaths = ["index.mdx", "glossary.mdx"].map((name) => join(docsFolder, name));
const barClass = "reading-bar";
const motionCondition = "(prefers-reduced-motion:no-preference)";
const scrollTimelineCondition = "(animation-timeline:scroll())";

for (const docsPath of sectionPaths) {
  test(`${relative(docsFolder, docsPath)}: the reading bar is in the page exactly once and hidden from assistive technology`, () => {
    const html = readFileSync(builtPageOf(docsPath), "utf8");
    const bars = [...html.matchAll(/<div\b[^>]*>/g)].filter((opening) => hasClass(opening[0], barClass));
    assert.equal(bars.length, 1, `found ${bars.length} reading bars`);
    assert.match(bars[0][0], /\saria-hidden="true"/);
  });
}

for (const docsPath of otherPaths) {
  test(`${relative(docsFolder, docsPath)}: the cover and the glossary have no reading bar`, () => {
    assert.equal(readFileSync(builtPageOf(docsPath), "utf8").includes(barClass), false);
  });
}

test("the reading bar is off by default and only moves with motion allowed and scroll timelines supported", () => {
  const rules = readSiteCssRules();
  const bar = rules.filter((rule) => rule.selector.includes(`.${barClass}`));
  assert.ok(
    bar.some((rule) => rule.conditions.length === 0 && declares(rule, "display", "none")),
    "the bar must be display: none outside any condition",
  );
  const moving = rules.filter((rule) => declares(rule, "animation-timeline"));
  assert.ok(moving.length > 0, "no rule ties an animation to the scroll");
  for (const rule of moving) {
    assert.ok(rule.selector.includes(`.${barClass}`), `${rule.selector} uses a scroll timeline`);
    assert.ok(
      rule.conditions.some((condition) => condition.includes(motionCondition)),
      `${rule.selector}: the scroll animation must sit inside @media ${motionCondition}`,
    );
    assert.ok(
      rule.conditions.some((condition) => condition.includes(scrollTimelineCondition)),
      `${rule.selector}: the scroll animation must sit inside @supports ${scrollTimelineCondition}`,
    );
  }
});
