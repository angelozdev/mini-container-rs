import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extname, relative } from "node:path";
import { test } from "node:test";
import {
  docsFolder,
  guideRoot,
  listFiles,
  readBlockLanguage,
  readBlockTitle,
  readCodeBlocks,
} from "./support.mjs";

const slash = "/";
const urlSeparator = `:${slash.repeat(2)}`;
const markersInCode = [slash.repeat(2), `${slash}*`, `<!${"-".repeat(2)}`];
const hashAfterSpace = /(^|\s)#/;
const checkedExtensions = new Set([".rs", ".sh", ".astro", ".mjs", ".css", ".ts"]);

const terminalOutputTitles = new Set(["Deberías ver", "Resultado esperado"]);
const promptPrefix = "$ ";
const hashLanguages = new Set(["sh", "toml"]);
const slashLanguages = new Set(["rust", "json"]);
const proseLanguages = new Set(["text"]);

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

function readCheckedLines(block) {
  const title = readBlockTitle(block.meta);
  if (!terminalOutputTitles.has(title)) return block.lines;
  return block.lines
    .filter((line) => line.startsWith(promptPrefix))
    .map((line) => line.slice(promptPrefix.length));
}

function describeCommentInBlock(block) {
  const language = readBlockLanguage(block.meta);
  if (proseLanguages.has(language)) return null;
  if (hashLanguages.has(language)) {
    return readCheckedLines(block).find((line) => hashAfterSpace.test(line)) ?? null;
  }
  if (slashLanguages.has(language)) {
    return readCheckedLines(block).find((line) => hasCommentInCode(line)) ?? null;
  }
  return `no rule for language "${language}"`;
}

export function findCommentsInPageBlocks(source) {
  return readCodeBlocks(source)
    .map((block) => ({ title: readBlockTitle(block.meta) ?? "untitled", offender: describeCommentInBlock(block) }))
    .filter(({ offender }) => offender !== null)
    .map(({ title, offender }) => `block "${title}": ${offender}`);
}

function fenced(meta, ...lines) {
  const mark = "`".repeat(3);
  return [`${mark}${meta}`, ...lines, mark].join("\n");
}

test("no code file of the guide has comments", () => {
  const offenders = listFiles(guideRoot)
    .filter((path) => checkedExtensions.has(extname(path)))
    .filter((path) => hasComment(path, readFileSync(path, "utf8")))
    .map((path) => relative(guideRoot, path));

  assert.deepEqual(offenders, [], "these files have comments");
});

test("no code block of the pages has comments", () => {
  const offenders = listFiles(docsFolder)
    .filter((path) => path.endsWith(".mdx"))
    .flatMap((path) =>
      findCommentsInPageBlocks(readFileSync(path, "utf8")).map((offender) => `${relative(docsFolder, path)}: ${offender}`),
    );

  assert.deepEqual(offenders, [], "these page blocks have comments");
});

test("a shell comment in an sh block is detected", () => {
  const source = fenced('sh title="En Linux"', "ls", "# list the files");
  assert.equal(findCommentsInPageBlocks(source).length, 1);
});

test("a Rust comment in a rust block is detected, and an attribute is not", () => {
  const withComment = fenced('rust title="src/main.rs"', "fn main() {}", `${slash.repeat(2)} nothing`);
  const withAttribute = fenced('rust title="src/main.rs"', "#[derive(Debug)]", "struct A;");
  assert.equal(findCommentsInPageBlocks(withComment).length, 1);
  assert.deepEqual(findCommentsInPageBlocks(withAttribute), []);
});

test("a TOML comment in a toml block is detected", () => {
  const source = fenced('toml title="Cargo.toml"', "[package]", "# name");
  assert.equal(findCommentsInPageBlocks(source).length, 1);
});

test("in terminal output only the lines that start with the prompt are checked", () => {
  const output = fenced('sh title="Deberías ver"', "$ cat .gitignore", "# Added by cargo", "/target");
  const commented = fenced('sh title="Deberías ver"', "$ ls # list");
  assert.deepEqual(findCommentsInPageBlocks(output), []);
  assert.equal(findCommentsInPageBlocks(commented).length, 1);
});

test("prose blocks are skipped and a language without a rule is reported", () => {
  const prose = fenced('text title="Texto para pegarle al agente"', "1. Something # with a hash");
  const unknown = fenced('python title="x"', "print(1)");
  assert.deepEqual(findCommentsInPageBlocks(prose), []);
  assert.equal(findCommentsInPageBlocks(unknown).length, 1);
});
