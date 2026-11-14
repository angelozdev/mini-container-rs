import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { declares, readSiteCssRules } from "./css-rules.mjs";
import { builtFolder, builtPageOf, docsFolder, hasClass, listFiles, listSectionPaths } from "./support.mjs";

const sectionPaths = listSectionPaths();
const otherPages = [
  ...["index.mdx", "glossary.mdx", "closing.mdx"].map((name) => ({ name, builtPath: builtPageOf(join(docsFolder, name)) })),
  { name: "404", builtPath: join(builtFolder, "404.html") },
];
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

for (const page of otherPages) {
  test(`${page.name}: the cover, the closing page, the glossary and the 404 have no reading bar`, () => {
    assert.equal(readFileSync(page.builtPath, "utf8").includes(barClass), false);
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

test("the reading bar grows from an explicit first keyframe to an explicit last one, so every engine starts it at zero", () => {
  const css = listFiles(join(builtFolder, "_astro"))
    .filter((path) => path.endsWith(".css"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  const keyframes = css.match(/@keyframes reading-bar-grow\{(.*?\})\}/)?.[1];
  assert.ok(keyframes, "the keyframes reading-bar-grow are missing from the built stylesheet");
  assert.match(keyframes, /(?:^|\})(?:from|0%)\{[^}]*transform:scaleX\(0\)/, "the first keyframe is missing");
  assert.match(keyframes, /(?:^|\})(?:to|100%)\{[^}]*transform:scaleX\(1\)/, "the last keyframe is missing");
});
