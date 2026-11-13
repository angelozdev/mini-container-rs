import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { test } from "node:test";
import { builtFolder, builtPageOf, docsFolder, guideRoot, listFiles } from "./support.mjs";
import { readCodeWindows } from "./terminal-html.mjs";

const preTag = /<pre\b[^>]*>/g;
const wrapClass = /\sclass="[^"]*\bwrap\b[^"]*"/;

test("the site is built before checking the code blocks", () => {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
});

for (const docsPath of listFiles(docsFolder).filter((path) => path.endsWith(".mdx"))) {
  const name = relative(docsFolder, docsPath);

  test(`${name}: every code block that is not a terminal window wraps its long lines`, () => {
    const page = builtPageOf(docsPath);
    assert.ok(existsSync(page), `${relative(guideRoot, page)} is missing: run astro build`);
    const html = readFileSync(page, "utf8");
    const blocks = readCodeWindows(html);
    assert.equal(blocks.length, (html.match(preTag) ?? []).length, `${name}: a code block is not inside a frame`);
    const scrolling = blocks.filter((block) => !block.classes.includes("is-terminal") && !wrapClass.test(block.pre));
    assert.equal(scrolling.length, 0, `${name}: ${scrolling.length} of ${blocks.length} code blocks scroll sideways`);
  });
}
