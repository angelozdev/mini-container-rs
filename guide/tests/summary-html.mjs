import { readDiv, readElement, textOf } from "./support.mjs";

const headingElement = /<h2\b[^>]*>([\s\S]*?)<\/h2>/g;
const closingQuiz = /<form\b[^>]*\bdata-kind="closing"[^>]*>/g;
const headingWrapper = '<div class="sl-heading-wrapper';
const headElement = /<thead\b[^>]*>([\s\S]*?)<\/thead>/;
const bodyElement = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/;
const rowElement = /<tr\b[^>]*>([\s\S]*?)<\/tr>/g;
const cellElement = /<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/g;

const cellsOf = (row) => [...row.matchAll(cellElement)].map((cell) => textOf(cell[1]));
const rowsOf = (html) => [...html.matchAll(rowElement)].map((row) => cellsOf(row[1]));

export function readSummary(html) {
  const headings = [...html.matchAll(headingElement)].filter((heading) => textOf(heading[1]) === "Resumen");
  const quizzes = [...html.matchAll(closingQuiz)];
  const counts = { headingCount: headings.length, quizCount: quizzes.length };
  if (headings.length !== 1 || quizzes.length !== 1) return counts;

  const [heading] = headings;
  const wrapperStart = html.lastIndexOf(headingWrapper, heading.index);
  const headingEnd = wrapperStart + readDiv(html, wrapperStart).length;
  const tableStart = html.indexOf("<table", headingEnd);
  if (tableStart === -1 || tableStart > quizzes[0].index) return { ...counts, hasTable: false };

  const table = readElement(html, tableStart, "table");
  const head = table.match(headElement)?.[1] ?? "";
  const body = table.match(bodyElement)?.[1] ?? "";
  return {
    ...counts,
    hasTable: true,
    betweenHeadingAndTable: html.slice(headingEnd, tableStart).trim(),
    betweenTableAndQuiz: html.slice(tableStart + table.length, quizzes[0].index).trim(),
    headers: rowsOf(head)[0] ?? [],
    rows: rowsOf(body),
  };
}
