import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { declares, readSiteCssRules } from "./css-rules.mjs";
import { readDiagrams, readOutcomeBlocks } from "./outcomes-html.mjs";
import { builtPageOf, docsFolder, listSectionPaths, textOf } from "./support.mjs";

const allPaths = [...listSectionPaths(), ...["index.mdx", "glossary.mdx"].map((name) => join(docsFolder, name))];
const readPage = (docsPath) => readFileSync(builtPageOf(docsPath), "utf8");
const nameOf = (docsPath) => relative(docsFolder, docsPath);

const expectedOutcomes = [
  {
    page: "1-process/a-launch-a-shell.mdx",
    call: ".status()",
    ok: { label: "Ok(ExitStatus)", note: "el programa corrió y terminó" },
    error: { label: "Err(error)", note: "no se pudo lanzar: sale con 1" },
  },
  {
    page: "2-namespaces/a-hostname.mdx",
    call: "unshare(CloneFlags::CLONE_NEWUTS)",
    ok: { label: "Ok(())", note: "tu programa sigue con su copia" },
    error: { label: "Err(EPERM)", note: "falta sudo: sale con 1" },
  },
  {
    page: "2-namespaces/b-processes.mdx",
    call: ".exec()",
    ok: { label: "No vuelve", note: "este proceso ya es otro programa" },
    error: { label: "Vuelve con el error", note: "el programa no se pudo ejecutar" },
  },
];

test("every diagram of every page carries the dot grid class", () => {
  const kinds = new Set();
  for (const docsPath of allPaths) {
    for (const diagram of readDiagrams(readPage(docsPath))) {
      kinds.add(diagram.kind);
      assert.ok(diagram.hasGrid, `${nameOf(docsPath)}: a ${diagram.kind} has no diagram-grid class`);
    }
  }
  assert.deepEqual([...kinds].sort(), ["diagram", "outcomes", "stepper-surface"]);
});

test("the dot grid paints the theme dot colour, defined in both themes", () => {
  const rules = readSiteCssRules();
  const grid = rules.find((rule) => rule.selector === ".diagram-grid");
  assert.ok(grid, "no .diagram-grid rule");
  assert.match(grid.body, /background-image:radial-gradient\(var\(--n-dot\)/);
  const definitions = rules.filter((rule) => declares(rule, "--n-dot")).map((rule) => rule.selector).sort();
  assert.deepEqual(definitions, [":root", ":root[data-theme=light]"]);
});

for (const expected of expectedOutcomes) {
  test(`${expected.page}: the outcome diagram shows the call and its two outcomes as text`, () => {
    const block = readOutcomeBlocks(readPage(join(docsFolder, expected.page))).find((candidate) => candidate.call === expected.call);
    assert.ok(block, `no outcome diagram for ${expected.call}`);
    assert.deepEqual(
      block.outcomes.map((outcome) => outcome.kind),
      ["ok", "error"],
    );
    const [ok, error] = block.outcomes;
    assert.deepEqual({ label: ok.label, note: ok.note }, expected.ok);
    assert.deepEqual({ label: error.label, note: error.note }, expected.error);
  });
}

test("every outcome diagram has a call, hides its arrow and marks one ok and one error outcome", () => {
  let found = 0;
  for (const docsPath of allPaths) {
    for (const block of readOutcomeBlocks(readPage(docsPath))) {
      found += 1;
      assert.notEqual(block.call, "", `${nameOf(docsPath)}: an outcome diagram has no call`);
      assert.ok(block.arrowHidden, `${nameOf(docsPath)}: the arrow of ${block.call} is not aria-hidden`);
      assert.deepEqual(
        block.outcomes.map((outcome) => outcome.kind),
        ["ok", "error"],
        `${nameOf(docsPath)}: ${block.call}`,
      );
      for (const outcome of block.outcomes) {
        assert.notEqual(outcome.label, "", `${nameOf(docsPath)}: an outcome of ${block.call} has no text`);
        assert.notEqual(outcome.note, "", `${nameOf(docsPath)}: an outcome of ${block.call} has no note`);
      }
    }
  }
  assert.ok(found >= expectedOutcomes.length, `found ${found} outcome diagrams`);
});

function readParagraphBefore(html, end) {
  const head = html.slice(0, end).trimEnd();
  if (!head.endsWith("</p>")) return undefined;
  return textOf(head.slice([...head.matchAll(/<p\b[^>]*>/g)].at(-1).index));
}

test("every outcome diagram follows the paragraph that introduces it, which ends with a colon", () => {
  for (const docsPath of allPaths) {
    const html = readPage(docsPath);
    for (const block of readOutcomeBlocks(html)) {
      const introduction = readParagraphBefore(html, html.indexOf(block.html));
      assert.ok(introduction?.endsWith(":"), `${nameOf(docsPath)}: ${block.call} is not right after a paragraph ending with a colon`);
    }
  }
});

test("1-process/a-launch-a-shell.mdx: the .status() outcome diagram comes after the last sentence about the error output", () => {
  const html = readPage(join(docsFolder, "1-process/a-launch-a-shell.mdx"));
  const block = readOutcomeBlocks(html).find((candidate) => candidate.call === ".status()");
  assert.ok(block, "no outcome diagram for .status()");
  const sentence = html.indexOf("<p>El mensaje no dice qué programa falló. Lo arreglas en el ejercicio.</p>");
  assert.notEqual(sentence, -1, "the sentence about the error message is not in the page");
  assert.ok(sentence < html.indexOf(block.html), "the diagram splits the explanation of the error output");
});
