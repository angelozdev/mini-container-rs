import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { readExercisesCards } from "./card-html.mjs";
import { readHeaderBlocks, readSectionLinks } from "./header-html.mjs";
import { readSectionHeadings } from "./outline-html.mjs";
import { attributeOf, builtFolder, decodeEntities, docsFolder, readElement, textOf, withBase } from "./support.mjs";

const closingSource = join(docsFolder, "closing.mdx");
const closingBuilt = join(builtFolder, "closing", "index.html");
const coverSource = join(docsFolder, "index.mdx");
const closingHref = withBase("/closing/");
const glossaryHref = withBase("/glossary/");
const topLevelList = /<ul\b[^>]*\bclass="top-level[^"]*"[^>]*>/;
const sectionOpening = /<div\b[^>]*\bclass="sl-heading-wrapper level-h2"[^>]*>/g;
const asideOpening = /<aside\b[^>]*\baria-label="([^"]*)"[^>]*>/g;
const quizOpening = /<form\b[^>]*\bclass="quiz"[^>]*\bdata-kind="([^"]*)"[^>]*>/g;
const tableOpening = /<table\b[^>]*>/;
const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/g;
const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g;
const strongOpening = /<strong\b/;
const consultedPattern = /Consultad[ao]s? el \d{4}-\d{2}-\d{2}/;
const datePattern = /\d{4}-\d{2}-\d{2}/;
const linkPattern = /<a\b[^>]*\shref="https?:[/]{2}/;
const termCardOpening = /<span\b[^>]*\bclass="term-card[^"]*"[^>]*>/;
const interviewAnswerLabel = "Respuesta de entrevista";
const piecesInOrder = ["docker", "dockerd", "containerd", "runc", "registry"];
const missingHeadingWord = "añade";
const missingLeads = [/capas/i, /red/i, /usuarios/i, /seccomp/i, /capabilities/i];
const forbiddenHeadings = ["Ejercicios", "Comprueba tu código", "Resumen"];

const readClosing = () => {
  assert.ok(existsSync(closingBuilt), "guide/dist/closing/index.html is missing: run astro build");
  return readFileSync(closingBuilt, "utf8");
};

function readTopLevelEntries(html) {
  const list = html.match(topLevelList);
  assert.ok(list, "the sidebar has no top-level list");
  const inner = readElement(html, list.index, "ul").slice(list[0].length);
  const entries = [];
  let position = inner.indexOf("<li");
  while (position !== -1) {
    const item = readElement(inner, position, "li");
    const isGroup = /^<li\b[^>]*>\s*<details\b/.test(item);
    entries.push({ isGroup, href: isGroup ? undefined : attributeOf(item.match(/<a\b[^>]*>/)[0], "href") });
    position = inner.indexOf("<li", position + item.length);
  }
  return entries;
}

function readSection(html, headingText) {
  const heading = readSectionHeadings(html).find((candidate) => candidate.text.includes(headingText));
  assert.ok(heading, `the page has no section with "${headingText}" in its title`);
  const start = html.indexOf(`<h2 id="${heading.id}"`);
  const next = [...html.matchAll(sectionOpening)].find((opening) => opening.index > start);
  return html.slice(start, next?.index ?? html.length);
}

function readListItems(sectionHtml) {
  const list = sectionHtml.match(/<ul\b[^>]*>/);
  assert.ok(list, "the section has no list");
  const body = readElement(sectionHtml, list.index, "ul").slice(list[0].length);
  const items = [];
  let position = body.indexOf("<li");
  while (position !== -1) {
    const item = readElement(body, position, "li");
    items.push(item);
    position = body.indexOf("<li", position + item.length);
  }
  return items;
}

function withoutTermCards(html) {
  let rest = html;
  for (let card = rest.match(termCardOpening); card; card = rest.match(termCardOpening)) {
    rest = rest.slice(0, card.index) + rest.slice(card.index + readElement(rest, card.index, "span").length);
  }
  return rest;
}

function sentencesOf(html) {
  return decodeEntities(textOf(html))
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.trim() !== "");
}

test("the site is built before checking the closing page", () => {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
});

test("the closing page is written at the top of the docs folder, with a Cierre title and no checkpoint", () => {
  assert.ok(existsSync(closingSource), "guide/src/content/docs/closing.mdx is missing");
  const fields = readFileSync(closingSource, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  assert.match(fields, /^title:\s*Cierre · \S/m);
  assert.doesNotMatch(fields, /^checkpoint:/m);
});

test("the sidebar lists the closing page as a top-level link after every group and right before the glossary", () => {
  const entries = readTopLevelEntries(readFileSync(join(builtFolder, "index.html"), "utf8"));
  const closing = entries.findIndex((entry) => entry.href === closingHref);
  assert.notEqual(closing, -1, "the closing page is not a top-level link of the sidebar");
  assert.equal(
    entries.slice(closing + 1).some((entry) => entry.isGroup),
    false,
    "a group comes after the closing page",
  );
  assert.equal(entries[closing + 1]?.href, glossaryHref, "the glossary must come right after the closing page");
});

test("the closing page is not one of the section pages the sidebar lists inside its groups", () => {
  const sections = readSectionLinks(readFileSync(join(builtFolder, "index.html"), "utf8"));
  assert.equal(sections.includes(closingHref), false);
  assert.ok(sections.length >= 6, "the sidebar lost its sections");
});

test("the closing page has no properties block, no reading bar and no exercises card", () => {
  const html = readClosing();
  assert.equal(readHeaderBlocks(html).length, 0, "it has a properties block");
  assert.equal(html.includes("reading-bar"), false, "it has a reading bar");
  assert.equal(readExercisesCards(html).length, 0, "it has an exercises card");
});

test("the closing page has no Ejercicios, Comprueba tu código or Resumen section", () => {
  const titles = readSectionHeadings(readClosing()).map((heading) => heading.text);
  for (const forbidden of forbiddenHeadings) assert.equal(titles.includes(forbidden), false, `it has a "${forbidden}" section`);
  assert.ok(titles.length >= 4, "the closing page has fewer sections than expected");
});

test("the closing page ends with the sources, after every other section", () => {
  const titles = readSectionHeadings(readClosing()).map((heading) => heading.text);
  assert.equal(titles.at(-1), "Fuentes");
});

test("the closing page has exactly two closing quizzes and no prediction", () => {
  const kinds = [...readClosing().matchAll(quizOpening)].map((opening) => opening[1]);
  assert.deepEqual(kinds, ["closing", "closing"]);
});

test("the table of pieces names the client, dockerd, containerd, runc and the registry in that order, and says what your program is for each", () => {
  const html = readSection(readClosing(), "piezas");
  const table = html.match(tableOpening);
  assert.ok(table, "the pieces section has no table");
  const rows = [...readElement(html, table.index, "table").matchAll(rowPattern)].map((row) =>
    [...row[1].matchAll(cellPattern)].map((cell) => decodeEntities(textOf(withoutTermCards(cell[1])))),
  );
  const [header, ...pieces] = rows;
  assert.deepEqual(header, ["Pieza", "Qué hace, y qué hay de ella en tu programa"]);
  assert.deepEqual(
    pieces.map((cells) => cells[0]),
    piecesInOrder,
  );
  for (const [piece, description] of pieces) assert.match(description, /Tu programa:/, `the ${piece} row does not say what your program has of it`);
  const runc = pieces.find((cells) => cells[0] === "runc");
  assert.match(runc[1], /Tu programa: hace este mismo papel/, "the runc row does not say that your program plays that role");
});

test("the list of what Docker adds has the layers, the network with an IP, the user namespace, seccomp and the capabilities", () => {
  const items = readListItems(readSection(readClosing(), missingHeadingWord));
  assert.equal(items.length, missingLeads.length, `found ${items.length} items`);
  for (const [position, item] of items.entries()) {
    const strong = item.search(strongOpening);
    assert.notEqual(strong, -1, `item ${position + 1} has no bold name`);
    const lead = textOf(withoutTermCards(readElement(item, strong, "strong")));
    assert.match(lead, missingLeads[position], `item ${position + 1} does not start with its bold name`);
  }
});

test("the interview answer is one aside of 3 or 4 sentences that names the kernel and the virtual machine", () => {
  const html = readClosing();
  const openings = [...html.matchAll(asideOpening)].filter((opening) => opening[1] === interviewAnswerLabel);
  assert.equal(openings.length, 1, `found ${openings.length} asides titled "${interviewAnswerLabel}"`);
  const aside = readElement(html, openings[0].index, "aside");
  const content = aside.slice(aside.indexOf('<div class="starlight-aside__content">'));
  const sentences = sentencesOf(withoutTermCards(content));
  assert.ok(sentences.length >= 3 && sentences.length <= 4, `the answer has ${sentences.length} sentences`);
  const text = sentences.join(" ");
  assert.match(text, /kernel/);
  assert.match(text, /máquina virtual/i);
});

test("the closing page tells the reader of exercise 2c.1 that the container already has its own network, in the list and after the expected output", () => {
  const html = readSection(readClosing(), missingHeadingWord);
  const networkItem = textOf(withoutTermCards(readListItems(html)[1]));
  assert.match(networkItem, /2c\.1/, "the network item does not mention exercise 2c.1");
  const afterList = html.slice(html.indexOf("</ul>"));
  const mentions = sentencesOf(withoutTermCards(afterList)).filter((sentence) => /2c\.1/.test(sentence) && /solo/.test(sentence));
  assert.ok(mentions.length >= 1, "nothing after the list says what the reader of exercise 2c.1 sees");
});

test("every sentence of the closing page that names part 4 says that it is not written yet", () => {
  const sentences = sentencesOf(withoutTermCards(readSection(readClosing(), missingHeadingWord))).filter((sentence) => /parte 4/i.test(sentence));
  assert.ok(sentences.length >= 2, `found ${sentences.length} sentences that name part 4`);
  for (const sentence of sentences) assert.match(sentence, /todavía no está escrita/, `part 4 is described as if it existed: ${sentence}`);
});

test("the section on what Docker adds says that runc applies the seccomp profile, the capabilities and the user namespace that Docker chooses", () => {
  const text = sentencesOf(withoutTermCards(readSection(readClosing(), missingHeadingWord))).join(" ");
  assert.match(text, /Docker decide[^.]*seccomp[^.]*capabilities[^.]*namespace de usuarios[^.]*runc[^.]*aplica/);
});

test("the sentence that introduces the interview answer does not say that the reader built every part", () => {
  const html = readSection(readClosing(), "contenedor y en qué se diferencia");
  const intro = sentencesOf(withoutTermCards(html.slice(0, html.indexOf("<aside"))));
  assert.equal(
    intro.some((sentence) => /cada parte la construiste/.test(sentence)),
    false,
    "the introduction still says that the reader built every part",
  );
  assert.ok(
    intro.some((sentence) => /3a\.1/.test(sentence)),
    "the introduction does not say that the CPU cap is only in the optional exercise 3a.1",
  );
});

test("every source of the closing page has a date, and each one with a link says when it was consulted", () => {
  const items = readListItems(readSection(readClosing(), "Fuentes"));
  const linked = items.filter((item) => linkPattern.test(item));
  assert.ok(linked.length >= 12, `only ${linked.length} sources have a link`);
  for (const item of items) {
    const text = textOf(item);
    assert.match(text, datePattern, `a source has no date: ${text.slice(0, 60)}`);
    if (linkPattern.test(item)) assert.match(text, consultedPattern, `a source has no consult date: ${text.slice(0, 60)}`);
    else assert.match(text, /máquina/, `a source without a link must be a note about the machine: ${text.slice(0, 60)}`);
  }
});

test("the cover links to the closing page from its map", () => {
  assert.ok(readFileSync(coverSource, "utf8").includes(`](${closingHref})`), `the cover map must link to ${closingHref}`);
});
