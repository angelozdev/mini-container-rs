import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { test } from "node:test";
import {
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
const docsFolder = join(guideRoot, "src/content/docs");

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
  return `lenguaje sin regla: «${language}»`;
}

export function findCommentsInPageBlocks(source) {
  return readCodeBlocks(source)
    .map((block) => ({ title: readBlockTitle(block.meta) ?? "sin título", offender: describeCommentInBlock(block) }))
    .filter(({ offender }) => offender !== null)
    .map(({ title, offender }) => `bloque «${title}»: ${offender}`);
}

function fenced(meta, ...lines) {
  const mark = "`".repeat(3);
  return [`${mark}${meta}`, ...lines, mark].join("\n");
}

test("ningún archivo de código de la guía tiene comentarios", () => {
  const offenders = listFiles(guideRoot)
    .filter((path) => checkedExtensions.has(extname(path)))
    .filter((path) => hasComment(path, readFileSync(path, "utf8")))
    .map((path) => relative(guideRoot, path));

  assert.deepEqual(offenders, [], "estos archivos tienen comentarios");
});

test("ningún bloque de código de las páginas tiene comentarios", () => {
  const offenders = listFiles(docsFolder)
    .filter((path) => path.endsWith(".mdx"))
    .flatMap((path) =>
      findCommentsInPageBlocks(readFileSync(path, "utf8")).map((offender) => `${relative(docsFolder, path)}: ${offender}`),
    );

  assert.deepEqual(offenders, [], "estos bloques de las páginas tienen comentarios");
});

test("un comentario de shell en un bloque sh se detecta", () => {
  const source = fenced('sh title="En Linux"', "ls", "# lista los archivos");
  assert.equal(findCommentsInPageBlocks(source).length, 1);
});

test("un comentario de Rust en un bloque rust se detecta, y un atributo no", () => {
  const withComment = fenced('rust title="src/main.rs"', "fn main() {}", `${slash.repeat(2)} nada`);
  const withAttribute = fenced('rust title="src/main.rs"', "#[derive(Debug)]", "struct A;");
  assert.equal(findCommentsInPageBlocks(withComment).length, 1);
  assert.deepEqual(findCommentsInPageBlocks(withAttribute), []);
});

test("un comentario de TOML en un bloque toml se detecta", () => {
  const source = fenced('toml title="Cargo.toml"', "[package]", "# nombre");
  assert.equal(findCommentsInPageBlocks(source).length, 1);
});

test("en la salida de la terminal solo se revisan las líneas que empiezan con el prompt", () => {
  const output = fenced('sh title="Deberías ver"', "$ cat .gitignore", "# Added by cargo", "/target");
  const commented = fenced('sh title="Deberías ver"', "$ ls # lista");
  assert.deepEqual(findCommentsInPageBlocks(output), []);
  assert.equal(findCommentsInPageBlocks(commented).length, 1);
});

test("el texto para el agente no se revisa y un lenguaje sin regla se señala", () => {
  const prose = fenced('text title="Texto para pegarle al agente"', "1. Algo # con almohadilla");
  const unknown = fenced('python title="x"', "print(1)");
  assert.deepEqual(findCommentsInPageBlocks(prose), []);
  assert.equal(findCommentsInPageBlocks(unknown).length, 1);
});
