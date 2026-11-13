import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { contrastRatio, parseColor, readCascadedTokenUse, readThemes, readTokenUse } from "./contrast.mjs";
import { guideRoot } from "./support.mjs";

const stylesFolder = join(guideRoot, "src/styles");
const tokensCss = readFileSync(join(stylesFolder, "tokens.css"), "utf8");
const outcomesCss = readFileSync(join(stylesFolder, "diagram-grid.css"), "utf8");
const minimumRatio = 4.5;
const kinds = ["ok", "error"];

const boxSelector = (kind) => `.outcome[data-outcome="${kind}"]`;
const backgroundToken = (kind) => readTokenUse(outcomesCss, boxSelector(kind), "background");
const titleToken = (kind) => readCascadedTokenUse(outcomesCss, [boxSelector(kind), ".outcome"], "color");
const noteToken = () => readTokenUse(outcomesCss, ".outcome-note", "color");

const texts = [
  ["title", titleToken],
  ["note", noteToken],
];

for (const [theme, tokens] of readThemes(tokensCss)) {
  for (const kind of kinds) {
    for (const [text, textToken] of texts) {
      test(`the ${text} of the ${kind} outcome box reaches ${minimumRatio}:1 on its background in the ${theme} theme`, () => {
        const colorName = textToken(kind);
        const backgroundName = backgroundToken(kind);
        assert.ok(tokens.get(colorName), `${colorName} is not defined in the ${theme} theme`);
        const ratio = contrastRatio(parseColor(tokens.get(colorName)), parseColor(tokens.get(backgroundName)));
        assert.ok(ratio >= minimumRatio, `${theme}: ${colorName} on ${backgroundName} is ${ratio.toFixed(2)}:1`);
      });
    }
  }
}

for (const kind of kinds) {
  test(`the title of the ${kind} outcome box is in the normal text color, so green and red stay in its border and background`, () => {
    assert.equal(titleToken(kind), "--n-text");
  });
}
