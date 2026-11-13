import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { contrastRatio, parseColor, readCascadedTokenUse, readThemes, readTokenUse } from "./contrast.mjs";
import { guideRoot } from "./support.mjs";

const stylesFolder = join(guideRoot, "src/styles");
const tokensCss = readFileSync(join(stylesFolder, "tokens.css"), "utf8");
const cardCss = readFileSync(join(stylesFolder, "exercises-card.css"), "utf8");
const minimumRatio = 4.5;

const backgroundToken = () => readTokenUse(cardCss, ".exercises-card", "background");
const titleToken = () => readCascadedTokenUse(cardCss, [".exercises-card b", ".exercises-card"], "color");
const summaryToken = () => readTokenUse(cardCss, ".exercises-card span", "color");

const texts = [
  ["title", titleToken],
  ["line with the counts", summaryToken],
];

for (const [theme, tokens] of readThemes(tokensCss)) {
  for (const [text, textToken] of texts) {
    test(`the ${text} of the exercises card reaches ${minimumRatio}:1 on its background in the ${theme} theme`, () => {
      const colorName = textToken();
      const backgroundName = backgroundToken();
      assert.ok(tokens.get(colorName), `${colorName} is not defined in the ${theme} theme`);
      assert.ok(tokens.get(backgroundName), `${backgroundName} is not defined in the ${theme} theme`);
      const ratio = contrastRatio(parseColor(tokens.get(colorName)), parseColor(tokens.get(backgroundName)));
      assert.ok(ratio >= minimumRatio, `${theme}: ${colorName} on ${backgroundName} is ${ratio.toFixed(2)}:1`);
    });
  }
}

test("the exercises card stylesheet takes its colors from theme variables only", () => {
  assert.doesNotMatch(cardCss, /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/);
});
