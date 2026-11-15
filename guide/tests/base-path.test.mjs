import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { attributeOf, builtFolder, listFiles } from "./support.mjs";

const slash = "/";
const expectedBase = "/mini-container-rs/";
const expectedCanonical = `https:${slash.repeat(2)}angelozdev.github.io/mini-container-rs/`;
const urlAttribute = /\s(?:href|src)="([^"]*)"/g;
const canonicalLink = /<link\b[^>]*\brel="canonical"[^>]*>/;

const pages = listFiles(builtFolder).filter((path) => path.endsWith(".html") && !path.includes(`${join(builtFolder, "pagefind")}/`));

function isRootRelative(value) {
  return value.startsWith(slash) && !value.startsWith(slash.repeat(2));
}

function readRootRelativeUrls(page) {
  return [...readFileSync(page, "utf8").matchAll(urlAttribute)].map((match) => match[1]).filter(isRootRelative);
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function builtTargetExists(url) {
  const path = url.slice(expectedBase.length).split(/[?#]/)[0];
  return isFile(join(builtFolder, path)) || isFile(join(builtFolder, path, "index.html"));
}

test("there are built pages to check", () => {
  assert.ok(pages.length > 0, "guide/dist has no page: run astro build");
});

test("every root-relative href and src in the built site starts with the base", () => {
  const outside = pages.flatMap((page) =>
    readRootRelativeUrls(page)
      .filter((url) => !url.startsWith(expectedBase))
      .map((url) => `${relative(builtFolder, page)}: ${url}`),
  );
  assert.deepEqual(outside, [], `these URLs miss the ${expectedBase} base`);
});

test("every internal link in the built site points to a file that exists", () => {
  const internal = pages.flatMap((page) =>
    readRootRelativeUrls(page)
      .filter((url) => url.startsWith(expectedBase))
      .map((url) => ({ page, url })),
  );
  assert.ok(internal.length > 0, `no URL in guide/dist starts with ${expectedBase}`);
  const broken = internal.filter(({ url }) => !builtTargetExists(url)).map(({ page, url }) => `${relative(builtFolder, page)}: ${url}`);
  assert.deepEqual(broken, [], "these internal URLs point to nothing in guide/dist");
});

test("the built pages declare the canonical URL under the site and the base", () => {
  const link = readFileSync(join(builtFolder, "index.html"), "utf8").match(canonicalLink)?.[0];
  assert.ok(link, "guide/dist/index.html has no canonical link");
  assert.equal(attributeOf(link, "href"), expectedCanonical);
});
