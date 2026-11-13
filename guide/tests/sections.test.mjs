import assert from "node:assert/strict";
import { test } from "node:test";
import { findSectionPosition, groupsAbove, isSectionPage } from "../src/lib/sections.ts";

const link = (label, isCurrent = false) => ({ type: "link", label, isCurrent });
const group = (label, ...entries) => ({ type: "group", label, entries });

const sidebar = (current) => [
  link("Portada", current === "Portada"),
  group("0 · Preparación", link("0a", current === "0a"), link("0b", current === "0b")),
  group("1 · Proceso", link("1a", current === "1a")),
  link("Glosario", current === "Glosario"),
];

test("the section position counts the links inside the groups, in menu order", () => {
  assert.deepEqual(findSectionPosition(sidebar("0a")), { position: 1, total: 3 });
  assert.deepEqual(findSectionPosition(sidebar("0b")), { position: 2, total: 3 });
  assert.deepEqual(findSectionPosition(sidebar("1a")), { position: 3, total: 3 });
});

test("a top-level link or an unknown page has no section position", () => {
  assert.equal(findSectionPosition(sidebar("Portada")), undefined);
  assert.equal(findSectionPosition(sidebar("Glosario")), undefined);
  assert.equal(findSectionPosition(sidebar(undefined)), undefined);
});

test("only a link inside a group is a section page", () => {
  assert.equal(isSectionPage(sidebar("0a")), true);
  assert.equal(isSectionPage(sidebar("1a")), true);
  assert.equal(isSectionPage(sidebar("Portada")), false);
  assert.equal(isSectionPage(sidebar("Glosario")), false);
  assert.equal(isSectionPage(sidebar(undefined)), false);
});

test("the groups above a page are the labels of the groups that hold it", () => {
  assert.deepEqual(groupsAbove(sidebar("0b")), ["0 · Preparación"]);
  assert.deepEqual(groupsAbove(sidebar("1a")), ["1 · Proceso"]);
});

test("the groups above a nested page list every level", () => {
  const nested = [group("A", group("B", link("deep", true)))];
  assert.deepEqual(groupsAbove(nested), ["A", "B"]);
});

test("a top-level page has no groups above it and an unknown page has none to find", () => {
  assert.deepEqual(groupsAbove(sidebar("Glosario")), []);
  assert.equal(groupsAbove(sidebar(undefined)), undefined);
});
