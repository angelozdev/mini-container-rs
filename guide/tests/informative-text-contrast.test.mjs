import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { contrastRatio, layerColors, parseColor, readListedTokenUse, readThemes, readTokenUse } from "./contrast.mjs";
import { declares, readSiteCssRules } from "./css-rules.mjs";
import { guideRoot } from "./support.mjs";

const stylesFolder = join(guideRoot, "src/styles");
const readStyles = (name) => readFileSync(join(stylesFolder, name), "utf8");
const tokensCss = readStyles("tokens.css");
const guideCss = readStyles("guide.css");
const notionCss = readStyles("notion.css");
const stepperCss = readStyles("stepper.css");
const sectionMarksCss = readStyles("section-marks.css");
const minimumRatio = 4.5;
const surfaceNames = ["--n-bg", "--n-side", "--n-hover"];
const contentsNumber =
  'body:has(.page-props) :is(starlight-toc > nav, mobile-starlight-toc .dropdown) > ul > li:not(:has(> a[href="#_top"])) > a::before';
const checkedWrongOption = ".quiz-option:has(.quiz-radio:checked)";

const informativeTexts = [
  ["the note between the two sides of a diagram", () => readTokenUse(guideCss, ".diagram-note", "color")],
  ["the launch label of a child process", () => readTokenUse(guideCss, ".process-launch", "color")],
  ["the empty label of a kernel box", () => readTokenUse(guideCss, ".kernel-empty", "color")],
  ["the title of a kernel box", () => readTokenUse(guideCss, ".kernel-label", "color")],
  ["the title of a lane of a stepper", () => readTokenUse(stepperCss, ".stepper-lane-title", "color")],
  ["the title of a group of the sidebar", () => readTokenUse(notionCss, ".sidebar-content summary .large", "color")],
  ["the title of the table of contents", () => readListedTokenUse(notionCss, "starlight-toc h2", "color")],
  ["the title of the mobile table of contents", () => readListedTokenUse(notionCss, "mobile-starlight-toc .toggle", "color")],
  ["the number of an entry of the table of contents", () => readTokenUse(sectionMarksCss, contentsNumber, "color")],
];

const decorativeFaintColors = [
  ".outcomes-arrow",
  ".diagram-arrow",
  ".sidebar-content summary .caret",
  ".sidebar-content ul ul a::before",
  ".stepper-scene:has(> .kernel-box) > .stepper-lane::after",
];

const compactSelector = (selector) => selector.replace(/\s+/g, "").replace(/::/g, ":");

function surfaceOf(tokens, name) {
  return layerColors(parseColor(tokens.get(name)), parseColor(tokens.get("--n-bg")));
}

for (const [theme, tokens] of readThemes(tokensCss)) {
  for (const [text, readToken] of informativeTexts) {
    test(`${text} reaches ${minimumRatio}:1 on the page, the sidebar and a highlighted row in the ${theme} theme`, () => {
      const colorName = readToken();
      assert.ok(tokens.get(colorName), `${colorName} is not defined in the ${theme} theme`);
      for (const surfaceName of surfaceNames) {
        const ratio = contrastRatio(parseColor(tokens.get(colorName)), surfaceOf(tokens, surfaceName));
        assert.ok(ratio >= minimumRatio, `${theme}: ${colorName} on ${surfaceName} is ${ratio.toFixed(2)}:1`);
      }
    });
  }

  test(`the muted text color reaches ${minimumRatio}:1 on the page background in the ${theme} theme`, () => {
    const ratio = contrastRatio(parseColor(tokens.get("--n-muted")), surfaceOf(tokens, "--n-bg"));
    assert.ok(ratio >= minimumRatio, `${theme}: --n-muted on --n-bg is ${ratio.toFixed(2)}:1`);
  });

  test(`the No. of a wrong quiz answer reaches ${minimumRatio}:1 on the red box it appears in, in the ${theme} theme`, () => {
    const colorName = readTokenUse(guideCss, ".quiz-verdict", "color");
    const backgroundName = readTokenUse(guideCss, checkedWrongOption, "background");
    const ratio = contrastRatio(parseColor(tokens.get(colorName)), surfaceOf(tokens, backgroundName));
    assert.ok(ratio >= minimumRatio, `${theme}: ${colorName} on ${backgroundName} is ${ratio.toFixed(2)}:1`);
  });
}

test("no text color of the built stylesheet is --n-faint, except the colors of arrows, carets and bullets that are decoration", () => {
  const allowed = new Set(decorativeFaintColors.map(compactSelector));
  const strays = readSiteCssRules()
    .filter((rule) => declares(rule, "color", "var(--n-faint)"))
    .filter((rule) => !allowed.has(compactSelector(rule.selector)))
    .map((rule) => rule.selector);
  assert.deepEqual(strays, []);
});

test("every decorative use of --n-faint that the test allows is still in the built stylesheet", () => {
  const present = new Set(
    readSiteCssRules()
      .filter((rule) => declares(rule, "color", "var(--n-faint)"))
      .map((rule) => compactSelector(rule.selector)),
  );
  const missing = decorativeFaintColors.filter((selector) => !present.has(compactSelector(selector)));
  assert.deepEqual(missing, []);
});
