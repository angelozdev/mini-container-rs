import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { test } from "node:test";
import { builtFolder, builtPageOf, docsFolder, guideRoot, listFiles } from "./support.mjs";

const preTag = /<pre\b[^>]*>/g;
const wrapClass = /\sclass="[^"]*\bwrap\b[^"]*"/;

test("the site is built before checking the code blocks", () => {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
});

for (const docsPath of listFiles(docsFolder).filter((path) => path.endsWith(".mdx"))) {
  const name = relative(docsFolder, docsPath);

  test(`${name}: every code block wraps its long lines`, () => {
    const page = builtPageOf(docsPath);
    assert.ok(existsSync(page), `${relative(guideRoot, page)} is missing: run astro build`);
    const blocks = readFileSync(page, "utf8").match(preTag) ?? [];
    const scrolling = blocks.filter((tag) => !wrapClass.test(tag));
    assert.equal(scrolling.length, 0, `${name}: ${scrolling.length} of ${blocks.length} code blocks scroll sideways`);
  });
}
