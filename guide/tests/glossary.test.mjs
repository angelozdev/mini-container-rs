import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import {
  attributeOf,
  builtFolder,
  builtPageOf,
  decodeEntities,
  docsFolder,
  glossaryFile,
  guideRoot,
  listFiles,
  readElement,
  readGlossaryEntries,
  textOf,
} from "./support.mjs";

const glossaryDocs = join(docsFolder, "glossary.mdx");
const glossaryBuilt = join(builtFolder, "glossary", "index.html");
const glossaryHref = "/glossary/";
const cardLinkText = "Ver en el glosario →";
const closeButtonText = "Cerrar";

const termTag = /<Term(?=[\s>])[^>]*>/g;
const validTermTag = /^<Term id="([a-z0-9]+(?:-[a-z0-9]+)*)">$/;
const termButton = /<button\b[^>]*\bclass="term"[^>]*>([\s\S]*?)<\/button>/g;
const cardOpening = /<span\b[^>]*\bclass="term-card(?:\s[^"]*)?"[^>]*>/g;
const cardTitle = /<strong\b[^>]*\bclass="term-card-title"[^>]*>([\s\S]*?)<\/strong>/;
const cardTitleOpening = /<strong\b[^>]*\bclass="term-card-title"[^>]*>/;
const cardDefinition = /<span\b[^>]*\bclass="term-card-definition"[^>]*>([\s\S]*?)<\/span>/;
const cardLink = /<a\b[^>]*\bclass="term-card-link"[^>]*>([\s\S]*?)<\/a>/;
const cardClose = /<button\b[^>]*\bclass="term-card-close"[^>]*>([\s\S]*?)<\/button>/;
const idAttribute = /\sid="([^"]*)"/g;
const entryOpening = /<div\b[^>]*\bclass="glossary-entry"[^>]*>/g;
const termElement = /<dt\b[^>]*>([\s\S]*?)<\/dt>/;
const definitionElement = /<span\b[^>]*\bclass="glossary-definition"[^>]*>([\s\S]*?)<\/span>/;
const seenElement = /<span\b[^>]*\bclass="glossary-seen"[^>]*>([\s\S]*?)<\/span>/;
const seenLink = /<a\b[^>]*>([\s\S]*?)<\/a>/;
const titleField = /^title:\s*(.+)$/m;
const sectionSeparator = " · ";

const entries = existsSync(glossaryFile) ? readGlossaryEntries() : [];
const entryById = new Map(entries.map((entry) => [entry.id, entry]));
const pages = listFiles(docsFolder)
  .filter((path) => path.endsWith(".mdx") && path !== glossaryDocs)
  .map((path) => ({ path, name: relative(docsFolder, path), source: readFileSync(path, "utf8") }))
  .map((page) => ({ ...page, tags: page.source.match(termTag) ?? [] }))
  .map((page) => ({ ...page, ids: page.tags.map((tag) => tag.match(validTermTag)?.[1]) }));

function plainText(definition) {
  return definition.replaceAll("`", "");
}

function hrefOf(page) {
  const slug = relative(docsFolder, page.path).replace(/\.mdx$/, "");
  return slug === "index" ? "/" : `/${slug}/`;
}

function readReadingOrder() {
  const html = readFileSync(join(builtFolder, "index.html"), "utf8");
  const start = html.indexOf('<ul class="top-level');
  const end = html.indexOf("</nav>", start);
  return [...html.slice(start, end).matchAll(/<a href="([^"]+)"/g)].map((link) => link[1]);
}

function firstPageUsing(id) {
  const order = readReadingOrder();
  const used = pages.filter((page) => page.ids.includes(id));
  return used.sort((left, right) => order.indexOf(hrefOf(left)) - order.indexOf(hrefOf(right)))[0];
}

function sectionOf(page) {
  return page.source.match(titleField)[1].trim().split(sectionSeparator)[0];
}

function readTerms(html) {
  return {
    buttons: [...html.matchAll(termButton)].map((button) => ({
      target: attributeOf(button[0], "popovertarget"),
      word: textOf(button[1]),
    })),
    cards: [...html.matchAll(cardOpening)].map((opening) => {
      const card = readElement(html, opening.index, "span");
      const link = card.match(cardLink);
      const close = card.match(cardClose);
      return {
        id: attributeOf(opening[0], "id"),
        isPopover: /\spopover[\s>=]/.test(opening[0]),
        role: attributeOf(opening[0], "role"),
        labelledBy: attributeOf(opening[0], "aria-labelledby"),
        titleId: attributeOf(card.match(cardTitleOpening)?.[0] ?? "", "id"),
        title: textOf(card.match(cardTitle)?.[1] ?? ""),
        definition: decodeEntities(textOf(card.match(cardDefinition)?.[1] ?? "")),
        linkHref: link ? attributeOf(link[0], "href") : undefined,
        linkText: link ? textOf(link[1]) : "",
        closeTarget: close ? attributeOf(close[0], "popovertarget") : undefined,
        closeAction: close ? attributeOf(close[0], "popovertargetaction") : undefined,
        closeText: close ? textOf(close[1]) : "",
      };
    }),
  };
}

function readGlossaryPage(html) {
  return [...html.matchAll(entryOpening)].map((opening) => {
    const entry = readElement(html, opening.index, "div");
    const seen = entry.match(seenElement)?.[1] ?? "";
    const link = seen.match(seenLink);
    return {
      id: attributeOf(opening[0], "id"),
      term: textOf(entry.match(termElement)?.[1] ?? ""),
      definition: decodeEntities(textOf(entry.match(definitionElement)?.[1] ?? "")),
      seenText: decodeEntities(textOf(seen)),
      seenHref: link ? attributeOf(link[0], "href") : undefined,
      seenLabel: link ? textOf(link[1]) : "",
    };
  });
}

function readBuiltPage(page) {
  const built = builtPageOf(page.path);
  assert.ok(existsSync(built), `${relative(guideRoot, built)} is missing: run astro build`);
  return readFileSync(built, "utf8");
}

function readBuiltGlossary() {
  assert.ok(existsSync(glossaryBuilt), "guide/dist/glossary/index.html is missing: run astro build");
  return readGlossaryPage(readFileSync(glossaryBuilt, "utf8"));
}

test("the site is built before checking the glossary", () => {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
});

test("the glossary data has entries with a unique kebab-case id, a term and a definition", () => {
  assert.ok(entries.length > 0, "guide/src/glossary.json is missing or empty");
  for (const entry of entries) {
    assert.match(entry.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `entry id "${entry.id}" is not kebab-case`);
    assert.ok(entry.term?.trim(), `${entry.id}: the term is empty`);
    assert.ok(entry.definition?.trim(), `${entry.id}: the definition is empty`);
    assert.equal(entry.definition.split("`").length % 2, 1, `${entry.id}: a backtick in the definition is never closed`);
  }
  assert.equal(entryById.size, entries.length, "two entries share an id");
});

test("the glossary page is written with the title Glosario", () => {
  assert.ok(existsSync(glossaryDocs), "guide/src/content/docs/glossary.mdx is missing");
  assert.equal(readFileSync(glossaryDocs, "utf8").match(titleField)?.[1].trim(), "Glosario");
});

test("every glossary entry is used by at least one page", () => {
  const used = new Set(pages.flatMap((page) => page.ids));
  const unused = entries.filter((entry) => !used.has(entry.id)).map((entry) => entry.id);
  assert.deepEqual(unused, [], "these entries are not used by any page");
});

for (const page of pages) {
  test(`${page.name}: every Term is written as <Term id="..."> with an id of the glossary`, () => {
    for (const [position, tag] of page.tags.entries()) {
      assert.match(tag, validTermTag, `${page.name}: Term ${position + 1} must be written <Term id="kebab-case">`);
      assert.ok(entryById.has(page.ids[position]), `${page.name}: the id "${page.ids[position]}" is not in the glossary data`);
    }
  });

  test(`${page.name}: every glossary entry is marked at most once`, () => {
    const repeated = page.ids.filter((id, position) => page.ids.indexOf(id) !== position);
    assert.deepEqual(repeated, [], `${page.name}: these ids are marked more than once`);
  });

  test(`${page.name}: every written Term is a button that opens a card of its own`, () => {
    const { buttons, cards } = readTerms(readBuiltPage(page));
    assert.equal(buttons.length, page.ids.length, `${page.name}: found ${buttons.length} term buttons, wrote ${page.ids.length}`);
    assert.equal(cards.length, page.ids.length, `${page.name}: found ${cards.length} term cards, wrote ${page.ids.length}`);
    for (const button of buttons) {
      assert.ok(button.word, `${page.name}: a term button has no visible word`);
      assert.equal(cards.filter((card) => card.id === button.target).length, 1, `${page.name}: "${button.word}" must target exactly one card`);
    }
    assert.equal(new Set(buttons.map((button) => button.target)).size, buttons.length, `${page.name}: two buttons target the same card`);
  });

  test(`${page.name}: every card has its term, a definition, a link to its glossary entry and a close button`, () => {
    const { cards } = readTerms(readBuiltPage(page));
    assert.deepEqual(
      cards.map((card) => card.linkHref?.replace(`${glossaryHref}#`, "")),
      page.ids,
      `${page.name}: the cards follow the order of the Terms and link to their entries`,
    );
    for (const card of cards) {
      const entry = entryById.get(card.linkHref.replace(`${glossaryHref}#`, ""));
      const where = `${page.name}: card ${card.id}`;
      assert.ok(card.isPopover, `${where}: must be a popover`);
      assert.equal(card.role, "dialog", `${where}: the role`);
      assert.ok(card.titleId, `${where}: the title has no id`);
      assert.equal(card.labelledBy, card.titleId, `${where}: aria-labelledby must point to the id of the title`);
      assert.equal(card.title, entry.term, `${where}: the title is not the term`);
      assert.notEqual(card.definition, "", `${where}: empty definition`);
      assert.equal(card.definition, plainText(entry.definition), `${where}: the definition differs from the glossary data`);
      assert.equal(card.linkText, cardLinkText, `${where}: the link text`);
      assert.equal(card.closeText, closeButtonText, `${where}: the close button text`);
      assert.equal(card.closeTarget, card.id, `${where}: the close button must target its own card`);
      assert.equal(card.closeAction, "hide", `${where}: the close button must hide the card`);
    }
  });

  test(`${page.name}: every id of the built page is unique`, () => {
    const ids = [...readBuiltPage(page).matchAll(idAttribute)].map((id) => id[1]);
    const repeated = ids.filter((id, position) => ids.indexOf(id) !== position);
    assert.deepEqual(repeated, [], `${page.name}: these ids appear more than once`);
  });
}

test("the sidebar lists the glossary after the sections", () => {
  assert.ok(existsSync(join(builtFolder, "index.html")), "guide/dist is missing: run astro build");
  const links = readReadingOrder();
  assert.equal(links.at(-1), glossaryHref, "the glossary must be the last link of the sidebar");
  assert.ok(links.length > 2, "the sidebar lost its sections");
});

const sortKey = (term) => term.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

test("the glossary page lists every entry once, in alphabetical order", () => {
  const listed = readBuiltGlossary();
  assert.deepEqual(
    listed.map((entry) => entry.id).sort(),
    entries.map((entry) => entry.id).sort(),
    "the page must list exactly the entries of the data",
  );
  for (let position = 1; position < listed.length; position += 1) {
    const [before, after] = [listed[position - 1].term, listed[position].term];
    assert.ok(sortKey(before) <= sortKey(after), `"${before}" must not come before "${after}"`);
  }
});

test("every id of the glossary page is unique", () => {
  readBuiltGlossary();
  const ids = [...readFileSync(glossaryBuilt, "utf8").matchAll(idAttribute)].map((id) => id[1]);
  const repeated = ids.filter((id, position) => ids.indexOf(id) !== position);
  assert.deepEqual(repeated, [], "these ids appear more than once in the glossary page");
});

test("each glossary entry shows its term and the definition of the data", () => {
  for (const listed of readBuiltGlossary()) {
    const entry = entryById.get(listed.id);
    assert.equal(listed.term, entry.term, `${listed.id}: the term`);
    assert.equal(listed.definition, plainText(entry.definition), `${listed.id}: the definition`);
  }
});

test("each glossary entry says where it first appears, in reading order", () => {
  for (const listed of readBuiltGlossary()) {
    const first = firstPageUsing(listed.id);
    assert.ok(first, `${listed.id}: no page uses it`);
    assert.equal(listed.seenText, `Aparece en ${sectionOf(first)}.`, `${listed.id}: the sentence`);
    assert.equal(listed.seenHref, hrefOf(first), `${listed.id}: must point to ${relative(docsFolder, first.path)}`);
    assert.equal(listed.seenLabel, sectionOf(first), `${listed.id}: the link text`);
  }
});

test("every Term card links to an entry that exists on the glossary page", () => {
  const listed = new Set(readBuiltGlossary().map((entry) => entry.id));
  for (const page of pages) {
    for (const id of page.ids) assert.ok(listed.has(id), `${page.name}: "${id}" has no entry on the glossary page`);
  }
});
