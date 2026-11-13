import assert from "node:assert/strict";
import { test } from "node:test";
import { countCodeLines, countWords } from "./page-metrics.mjs";
import { measurePage } from "../src/lib/page-metrics.ts";

const fence = "`".repeat(3);
const mdx = (...lines) => lines.join("\n");

test("the published code counts only the exercise headings that carry the id of its own page", () => {
  const body = mdx("## Ejercicios", "", "### 2b.1 Uno", "### 2b.2 Dos", "### 2c.1 Ajeno", "### 0a.1 Otro");
  assert.equal(measurePage(body, "2b · Ser el PID 1").exercises, 2);
});

test("the published code ignores an exercise heading inside a code block", () => {
  const body = mdx("### 2b.1 Uno", `${fence}sh`, "### 2b.2 Dentro de un bloque", fence);
  assert.equal(measurePage(body, "2b · Ser el PID 1").exercises, 1);
});

test("a page whose title has no id has no exercises", () => {
  assert.equal(measurePage("### 2b.1 Uno", "Glosario").exercises, 0);
});

test("the id of the page is matched as a whole, not as a prefix of another id", () => {
  assert.equal(measurePage("### 2ab.1 Uno\n### 2a.1 Dos", "2a · Aislar el hostname").exercises, 1);
});

test("the published code does not count a list number as a word", () => {
  assert.equal(measurePage(mdx("1. Primero", "2) Segundo", "- Tercero"), "9z · Página").words, 3);
});

test("the published code keeps a tag-like text inside inline code and drops real tags", () => {
  const body = mdx('<Hint n={1}>', "Escribe `kill -9 <PID>` ahora.", "</Hint>");
  assert.equal(measurePage(body, "9z · Página").words, 5);
});

test("the published code agrees with the independent count on a mixed page", () => {
  const body = mdx(
    'import { Aside } from "@astrojs/starlight/components";',
    "",
    "## Un título",
    '<Aside type="note" title="Analogía">',
    "Una **idea** con `código <en> línea` y <Term id=\"x\">un término</Term>.",
    "</Aside>",
    "| Situación | Qué usar |",
    "|---|---|",
    `${fence}sh`,
    "ls -la",
    "",
    "echo hola",
    fence,
  );
  const measured = measurePage(body, "9z · Página");
  assert.equal(measured.words, countWords(body));
  assert.equal(measured.codeLines, countCodeLines(body));
  assert.equal(measured.minutes, 5);
});
