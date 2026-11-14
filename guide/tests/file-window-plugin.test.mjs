import assert from "node:assert/strict";
import { test } from "node:test";
import { ExpressiveCode } from "@astrojs/starlight/expressive-code";
import { toHtml } from "@astrojs/starlight/expressive-code/hast";
import { fileWindow } from "../src/lib/file-window.mjs";
import { terminalWindow } from "../src/lib/terminal-window.mjs";
import { readFileWindows } from "./file-html.mjs";

const engine = new ExpressiveCode({ plugins: [terminalWindow(), fileWindow()], defaultProps: { wrap: true } });
const terminalOnlyEngine = new ExpressiveCode({ plugins: [terminalWindow()], defaultProps: { wrap: true } });

async function renderHtml(code, language, meta = "", renderer = engine) {
  const { renderedGroupAst } = await renderer.render({ code, language, meta });
  return toHtml(renderedGroupAst);
}

async function renderFile(code, language, meta = 'title="src/main.rs"') {
  const [window] = readFileWindows(await renderHtml(code, language, meta));
  return window;
}

test("a block that is not a terminal becomes a file window with a tab, an icon, the title and three dots", async () => {
  const window = await renderFile("fn main() {}", "rust");
  assert.ok(window.classes.includes("is-file"));
  assert.ok(window.hasTab);
  assert.ok(window.hasIcon);
  assert.equal(window.tabTitle, "src/main.rs");
  assert.equal(window.dotCount, 3);
  assert.equal(window.headerText, "src/main.rs");
});

test("Rust, TOML, JSON and plain text blocks are all file windows", async () => {
  for (const [language, code] of [["rust", "fn main() {}"], ["toml", "[package]"], ["json", "{}"], ["text", "low 0"]]) {
    const window = await renderFile(code, language, `title="a.${language}"`);
    assert.ok(window, `${language} did not become a file window`);
    assert.equal(window.tabTitle, `a.${language}`);
  }
});

test("a block with no title is an error, because its tab would have nothing to show", async () => {
  await assert.rejects(renderHtml("fn main() {}", "rust"), /title/);
});

test("a line that does not wrap: even a block that asks for wrap scrolls sideways", async () => {
  const window = await renderFile("fn main() {}", "rust", 'title="src/main.rs" wrap');
  assert.ok(!/\sclass="[^"]*\bwrap\b[^"]*"/.test(window.pre));
  assert.equal(window.tabindex, "0");
  assert.equal(window.role, "region");
  assert.equal(window.ariaLabel, "Código de src/main.rs");
});

test("the context flag puts the Contexto mark in the title bar, and without it there is none", async () => {
  const marked = await renderFile("fn run() {}", "rust", 'title="src/container.rs" context');
  const plain = await renderFile("fn run() {}", "rust", 'title="src/container.rs"');
  assert.equal(marked.note, "Contexto");
  assert.equal(marked.headerText, "src/container.rsContexto");
  assert.equal(plain.note, undefined);
});

test("the context flag on a terminal block is an error", async () => {
  await assert.rejects(renderHtml("$ ls", "sh", 'title="En Linux" context'), /context/);
});

test("added and removed lines are rows with no sign in their text, and a marks column is there for the signs", async () => {
  const window = await renderFile("use a;\nuse b;\nuse c;", "rust", 'title="src/main.rs" del={2} ins={3}');
  assert.deepEqual(window.rows.map((row) => row.text), ["use a;", "use b;", "use c;"]);
  assert.deepEqual(window.rows.map((row) => row.classes.includes("del")), [false, true, false]);
  assert.deepEqual(window.rows.map((row) => row.classes.includes("ins")), [false, false, true]);
  assert.ok(window.hasMarks);
});

test("a block without added or removed lines has no marks column", async () => {
  const window = await renderFile("use a;\nuse b;", "rust");
  assert.ok(!window.hasMarks);
});

test("the copy button gives the file as it ends up, without the removed lines", async () => {
  const window = await renderFile("fn main() {\n    old();\n    new();\n}", "rust", 'title="src/main.rs" del={2} ins={3}');
  assert.deepEqual(window.copiedLines, ["fn main() {", "    new();", "}"]);
});

test("the copy button of a block with no removed line gives every line, blank ones included", async () => {
  const window = await renderFile("use a;\n\nuse b;", "rust");
  assert.deepEqual(window.copiedLines, ["use a;", "", "use b;"]);
});

test("a terminal block is drawn exactly as it is without the file window plugin", async () => {
  const code = "$ ./target/debug/mini-container run /bin/hostname\nError: boom\n\nCaused by:\n    EPERM";
  const meta = 'title="Lo que ves" stderr={2-5}';
  assert.equal(await renderHtml(code, "sh", meta), await renderHtml(code, "sh", meta, terminalOnlyEngine));
});

test("a terminal block still copies only its command lines", async () => {
  const html = await renderHtml("$ pwd\n/home\n$ uname -m\naarch64", "sh", 'title="x"');
  assert.match(html, /data-code="pwd\x7funame -m"/);
});
