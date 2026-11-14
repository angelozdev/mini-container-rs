import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { attributeOf, builtFolder, guideRoot, listFiles } from "./support.mjs";

const iconLink = /<link\b[^>]*\brel="(?:shortcut )?icon"[^>]*>/g;
const schemeSeparator = `:${"/".repeat(2)}`;

const pages = listFiles(builtFolder).filter((path) => path.endsWith(".html") && !path.includes(`${join(builtFolder, "pagefind")}/`));

test("there are built pages to check", () => {
  assert.ok(pages.length > 0, "guide/dist has no page: run astro build");
});

for (const page of pages) {
  test(`${relative(builtFolder, page)}: every favicon the page links exists in the built site`, () => {
    const links = [...readFileSync(page, "utf8").matchAll(iconLink)].map((match) => attributeOf(match[0], "href"));
    assert.ok(links.length > 0, `${relative(guideRoot, page)} links no favicon`);
    for (const href of links) {
      if (href.includes(schemeSeparator)) continue;
      assert.ok(existsSync(join(builtFolder, href.split(/[?#]/)[0])), `${href} is linked but missing from dist`);
    }
  });
}
