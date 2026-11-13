import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { test } from "node:test";
import { readSummary } from "./summary-html.mjs";
import { builtFolder, builtPageOf, docsFolder, guideRoot, listFiles } from "./support.mjs";

const frontmatter = /^---\n([\s\S]*?)\n---/;
const checkpointField = /^checkpoint:\s*\S/m;
const expectedHeaders = ["Situación", "Qué usar"];
const minimumRows = 3;
const maximumRows = 6;

const heading = '<div class="sl-heading-wrapper level-h2"><h2 id="resumen">Resumen</h2><a class="sl-anchor-link" href="#resumen"><span class="sr-only">Sección titulada «Resumen»</span></a></div>';
const quiz = '<form class="quiz" data-kind="closing"><fieldset></fieldset></form>';
const row = (...cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
const table = (headers, rows) =>
  `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
const goodRows = [row("a", "<code>b</code>"), row("c", "d"), row("e", "f")];
const page = ({ before = "", between = "", headers = expectedHeaders, rows = goodRows, after = "" } = {}) =>
  `<p>Text</p>${before}${heading}${between}${table(headers, rows)}${after}${quiz}`;

test("a summary table written as the contract says is read in full", () => {
  const summary = readSummary(page());
  assert.equal(summary.headingCount, 1);
  assert.equal(summary.quizCount, 1);
  assert.equal(summary.betweenHeadingAndTable, "");
  assert.equal(summary.betweenTableAndQuiz, "");
  assert.deepEqual(summary.headers, expectedHeaders);
  assert.deepEqual(summary.rows, [["a", "b"], ["c", "d"], ["e", "f"]]);
});

test("a page without a Resumen heading has none to read", () => {
  assert.equal(readSummary(`<p>Text</p>${quiz}`).headingCount, 0);
});

test("a second Resumen heading is counted", () => {
  assert.equal(readSummary(page({ before: heading })).headingCount, 2);
});

test("a Resumen without a table after it is read as having none", () => {
  assert.equal(readSummary(`${heading}<p>Text</p>${quiz}`).hasTable, false);
});

test("content between the heading and the table, or between the table and the quiz, is kept", () => {
  const summary = readSummary(page({ between: "<p>Intro</p>", after: "<p>Outro</p>" }));
  assert.equal(summary.betweenHeadingAndTable, "<p>Intro</p>");
  assert.equal(summary.betweenTableAndQuiz, "<p>Outro</p>");
});

test("a table with three columns reads three headers and three cells per row", () => {
  const summary = readSummary(page({ headers: ["x", "y", "z"], rows: [row("1", "2", "3")] }));
  assert.deepEqual(summary.headers, ["x", "y", "z"]);
  assert.deepEqual(summary.rows, [["1", "2", "3"]]);
});

const pages = listFiles(docsFolder)
  .filter((path) => path.endsWith(".mdx"))
  .filter((path) => checkpointField.test(readFileSync(path, "utf8").match(frontmatter)?.[1] ?? ""));

test("the site is built before checking the summaries", () => {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
});

test("there are pages with a checkpoint to check", () => {
  assert.ok(pages.length > 0, "no page has a checkpoint in its frontmatter");
});

for (const docsPath of pages) {
  const name = relative(docsFolder, docsPath);

  const summaryOf = () => {
    const built = builtPageOf(docsPath);
    assert.ok(existsSync(built), `${relative(guideRoot, built)} is missing: run astro build`);
    return readSummary(readFileSync(built, "utf8"));
  };

  test(`${name}: has exactly one Resumen heading and one closing quiz`, () => {
    const { headingCount, quizCount } = summaryOf();
    assert.equal(headingCount, 1, `${name}: expected one "## Resumen" heading, found ${headingCount}`);
    assert.equal(quizCount, 1, `${name}: expected one closing Quiz, found ${quizCount}`);
  });

  test(`${name}: the Resumen is one table right before the closing quiz`, () => {
    const summary = summaryOf();
    assert.equal(summary.hasTable, true, `${name}: the Resumen heading is not followed by a table before the closing quiz`);
    assert.equal(summary.betweenHeadingAndTable, "", `${name}: something sits between the Resumen heading and its table`);
    assert.equal(summary.betweenTableAndQuiz, "", `${name}: something sits between the Resumen table and the closing quiz`);
  });

  test(`${name}: the Resumen table has the columns Situación and Qué usar`, () => {
    assert.deepEqual(summaryOf().headers, expectedHeaders);
  });

  test(`${name}: the Resumen table has ${minimumRows} to ${maximumRows} rows of two filled cells`, () => {
    const { rows } = summaryOf();
    assert.ok(rows.length >= minimumRows && rows.length <= maximumRows, `${name}: found ${rows.length} rows`);
    for (const cells of rows) {
      assert.equal(cells.length, 2, `${name}: a row has ${cells.length} cells`);
      assert.ok(cells.every((cell) => cell !== ""), `${name}: a row has an empty cell`);
    }
  });
}
