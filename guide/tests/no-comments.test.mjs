import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extname, relative } from "node:path";
import { test } from "node:test";
import { guideRoot, listFiles } from "./support.mjs";

const slash = "/";
const urlSeparator = `:${slash.repeat(2)}`;
const markersInCode = [slash.repeat(2), `${slash}*`, `<!${"-".repeat(2)}`];
const hashAfterSpace = /(^|\s)#/;
const checkedExtensions = new Set([".rs", ".sh", ".astro", ".mjs", ".css", ".ts"]);

function hasCommentInShell(text) {
  return text
    .split("\n")
    .some((line, index) => {
      if (index === 0 && line.startsWith("#!")) return false;
      return hashAfterSpace.test(line);
    });
}

function hasCommentInCode(text) {
  const withoutUrls = text.replaceAll(urlSeparator, "");
  return markersInCode.some((marker) => withoutUrls.includes(marker));
}

function hasComment(path, text) {
  return extname(path) === ".sh" ? hasCommentInShell(text) : hasCommentInCode(text);
}

test("ningún archivo de código de la guía tiene comentarios", () => {
  const offenders = listFiles(guideRoot)
    .filter((path) => checkedExtensions.has(extname(path)))
    .filter((path) => hasComment(path, readFileSync(path, "utf8")))
    .map((path) => relative(guideRoot, path));

  assert.deepEqual(offenders, [], "estos archivos tienen comentarios");
});
