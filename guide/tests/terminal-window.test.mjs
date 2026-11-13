import assert from "node:assert/strict";
import { test } from "node:test";
import { ExpressiveCode } from "@astrojs/starlight/expressive-code";
import { toHtml } from "@astrojs/starlight/expressive-code/hast";
import { terminalWindow } from "../src/lib/terminal-window.mjs";
import { readCodeWindows } from "./terminal-html.mjs";

const engine = new ExpressiveCode({ plugins: [terminalWindow()], defaultProps: { wrap: true } });

async function renderWindow(code, language, meta = "") {
  const { renderedGroupAst } = await engine.render({ code, language, meta });
  const [window] = readCodeWindows(toHtml(renderedGroupAst));
  return window;
}

const marks = (window, name) => window.rows.map((row) => row.classes.includes(name));

test("a line that starts with the prompt is a command, and the prompt is not in its text", async () => {
  const window = await renderWindow("$ orb list\nmini-container-dev  running", "sh");
  assert.deepEqual(window.rows.map((row) => row.text), ["orb list", "mini-container-dev  running"]);
  assert.deepEqual(marks(window, "is-command"), [true, false]);
});

test("the copy button gives the text without the prompt", async () => {
  const window = await renderWindow("$ pwd\n/home\n$ uname -m\naarch64", "sh");
  assert.deepEqual(window.copiedLines, ["pwd", "/home", "uname -m", "aarch64"]);
});

test("a block with no prompt at all is made of commands, and a blank line is not one", async () => {
  const window = await renderWindow("cd repo\n\nls", "sh");
  assert.deepEqual(marks(window, "is-command"), [true, false, true]);
});

test("a block marked as output has no commands unless a line has the prompt", async () => {
  const plain = await renderWindow("info: downloading\ninfo: done", "sh", "output");
  const prompted = await renderWindow("$ ls\nfile", "sh", "output");
  assert.deepEqual(marks(plain, "is-command"), [false, false]);
  assert.deepEqual(marks(prompted, "is-command"), [true, false]);
});

test("the lines of a stderr range are marked, and the title bar gets the stderr key", async () => {
  const window = await renderWindow("$ run\nError: boom\n\nCaused by:\n    EPERM\n1", "sh", "stderr={2-5}");
  assert.deepEqual(marks(window, "is-stderr"), [false, true, true, true, true, false]);
  assert.equal(window.key, "stderr");
});

test("a block without a stderr range has no stderr key", async () => {
  const window = await renderWindow("$ run\nok", "sh");
  assert.equal(window.key, undefined);
});

test("a stderr range outside the block is an error", async () => {
  await assert.rejects(renderWindow("$ run\nok", "sh", "stderr={3}"), /stderr/);
});

test("a stderr range on a block that is not a terminal is an error", async () => {
  await assert.rejects(renderWindow("fn main() {}", "rust", "stderr={1}"), /stderr/);
});

test("bash, shell and console blocks are terminal windows too", async () => {
  for (const language of ["bash", "shell", "console"]) {
    const window = await renderWindow("$ ls", language);
    assert.ok(window.classes.includes("is-terminal"), `${language} is not a terminal window`);
    assert.deepEqual(marks(window, "is-command"), [true]);
  }
});

test("a shell file with a shebang is not a terminal window and keeps its highlighting", async () => {
  const window = await renderWindow("#!/bin/sh\necho hi", "sh");
  assert.ok(!window.classes.includes("is-terminal"));
  assert.match(window.preHtml, /<span\b[^>]*\bstyle="--0:/);
  assert.deepEqual(marks(window, "is-command"), [false, false]);
});

test("a terminal block has no styled spans, does not wrap, and can be scrolled with the keyboard", async () => {
  const window = await renderWindow("$ ls -l /dev\ntotal 0", "sh");
  assert.doesNotMatch(window.preHtml, /<span\b[^>]*\bstyle=/);
  assert.doesNotMatch(window.pre, /\bwrap\b/);
  assert.match(window.pre, /\stabindex="0"/);
});

test("a Rust block keeps its highlighting and its wrapping", async () => {
  const window = await renderWindow("fn main() {}", "rust", 'title="src/main.rs"');
  assert.ok(!window.classes.includes("is-terminal"));
  assert.match(window.preHtml, /<span\b[^>]*\bstyle="--0:/);
  assert.match(window.pre, /\bwrap\b/);
});
