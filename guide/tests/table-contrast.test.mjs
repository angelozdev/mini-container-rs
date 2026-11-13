import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { contrastRatio, parseColor, readTokenUse, readTokens } from "./contrast.mjs";
import { guideRoot } from "./support.mjs";

const stylesFolder = join(guideRoot, "src/styles");
const tokensCss = readFileSync(join(stylesFolder, "tokens.css"), "utf8");
const notionCss = readFileSync(join(stylesFolder, "notion.css"), "utf8");
const headerCell = ".sl-markdown-content th:not(:where(.not-content *))";
const minimumRatio = 4.5;

test("the contrast of black on white is 21", () => {
  assert.equal(contrastRatio(parseColor("#000000"), parseColor("#ffffff")).toFixed(2), "21.00");
});

test("a translucent color is mixed with its background before its contrast is measured", () => {
  assert.equal(contrastRatio(parseColor("rgba(255, 255, 255, 0.5)"), parseColor("#000000")).toFixed(2), "5.28");
});

test("the gray 777777 on white is just under the 4.5 minimum", () => {
  assert.equal(contrastRatio(parseColor("#777777"), parseColor("#ffffff")).toFixed(2), "4.48");
});

test("a rule that sets no color from a token is reported", () => {
  assert.throws(() => readTokenUse(".a {\n  color: red;\n}", ".a", "color"), /sets no color/);
});

const darkTokens = readTokens(tokensCss, ":root");
const themes = [
  ["dark", darkTokens],
  ["light", new Map([...darkTokens, ...readTokens(tokensCss, ':root[data-theme="light"]')])],
];

for (const [theme, tokens] of themes) {
  test(`the text of a table header reaches ${minimumRatio}:1 on its background in the ${theme} theme`, () => {
    const textToken = readTokenUse(notionCss, headerCell, "color");
    const backgroundToken = readTokenUse(notionCss, headerCell, "background");
    const ratio = contrastRatio(parseColor(tokens.get(textToken)), parseColor(tokens.get(backgroundToken)));
    assert.ok(ratio >= minimumRatio, `${theme}: ${textToken} on ${backgroundToken} is ${ratio.toFixed(2)}:1`);
  });
}
