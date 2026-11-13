import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { contrastRatio, parseColor, readCascadedTokenUse, readThemes, readTokenUse } from "./contrast.mjs";
import { guideRoot } from "./support.mjs";

const stylesFolder = join(guideRoot, "src/styles");
const tokensCss = readFileSync(join(stylesFolder, "tokens.css"), "utf8");
const terminalCss = readFileSync(join(stylesFolder, "terminal-window.css"), "utf8");
const minimumTextRatio = 4.5;
const minimumMarkRatio = 3;

const windowSelector = ".expressive-code .frame.is-terminal";
const barSelector = `${windowSelector} figcaption.header`;
const codeAreaSelector = `${windowSelector} pre`;
const codeSelector = `${windowSelector} pre > code`;
const promptSelector = `${windowSelector} .ec-line.is-command .code::before`;
const titleSelector = `${windowSelector} .title`;
const keySelector = `${windowSelector} .stderr-key`;
const keyBarSelector = `${windowSelector} .stderr-key::before`;
const stderrRowSelector = `${windowSelector} .ec-line.is-stderr`;

const texts = [
  ["output and command text", () => readTokenUse(terminalCss, codeSelector, "color"), () => readTokenUse(terminalCss, codeAreaSelector, "background-color")],
  ["dimmed prompt", () => readTokenUse(terminalCss, promptSelector, "color"), () => readTokenUse(terminalCss, codeAreaSelector, "background-color")],
  ["title", () => readCascadedTokenUse(terminalCss, [titleSelector, barSelector], "color"), () => readTokenUse(terminalCss, barSelector, "background")],
  ["stderr key", () => readTokenUse(terminalCss, keySelector, "color"), () => readTokenUse(terminalCss, barSelector, "background")],
  ["text of a stderr line", () => readTokenUse(terminalCss, codeSelector, "color"), () => readTokenUse(terminalCss, stderrRowSelector, "background")],
];

const marks = [
  ["red bar of a stderr line", () => readTokenUse(terminalCss, stderrRowSelector, "--stderr-mark"), () => readTokenUse(terminalCss, stderrRowSelector, "background")],
  ["red bar of the stderr key", () => readTokenUse(terminalCss, keyBarSelector, "background"), () => readTokenUse(terminalCss, barSelector, "background")],
];

function ratioOf(tokens, foregroundName, backgroundName) {
  assert.ok(tokens.get(foregroundName), `${foregroundName} is not defined`);
  assert.ok(tokens.get(backgroundName), `${backgroundName} is not defined`);
  return contrastRatio(parseColor(tokens.get(foregroundName)), parseColor(tokens.get(backgroundName)));
}

for (const [theme, tokens] of readThemes(tokensCss)) {
  for (const [name, foreground, background] of texts) {
    test(`the ${name} of a terminal window reaches ${minimumTextRatio}:1 on its background in the ${theme} theme`, () => {
      const ratio = ratioOf(tokens, foreground(), background());
      assert.ok(ratio >= minimumTextRatio, `${theme}: ${foreground()} on ${background()} is ${ratio.toFixed(2)}:1`);
    });
  }

  for (const [name, foreground, background] of marks) {
    test(`the ${name} reaches ${minimumMarkRatio}:1 on its background in the ${theme} theme`, () => {
      const ratio = ratioOf(tokens, foreground(), background());
      assert.ok(ratio >= minimumMarkRatio, `${theme}: ${foreground()} on ${background()} is ${ratio.toFixed(2)}:1`);
    });
  }
}

test("the colors of the terminal window come only from theme variables", () => {
  assert.doesNotMatch(terminalCss, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
});
