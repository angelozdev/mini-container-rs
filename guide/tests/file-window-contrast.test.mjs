import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { contrastRatio, layerColors, parseColor, readListedTokenUse, readThemes } from "./contrast.mjs";
import { readFileWindows } from "./file-html.mjs";
import { builtPageOf, docsFolder, guideRoot, listSectionPaths } from "./support.mjs";

const stylesFolder = join(guideRoot, "src/styles");
const tokensCss = readFileSync(join(stylesFolder, "tokens.css"), "utf8");
const notionCss = readFileSync(join(stylesFolder, "notion.css"), "utf8");
const windowCss = readFileSync(join(stylesFolder, "terminal-window.css"), "utf8");
const fileCss = readFileSync(join(stylesFolder, "file-window.css"), "utf8");
const minimumTextRatio = 4.5;
const minimumMarkRatio = 3;
const syntaxTokenNames = ["--n-s-keyword", "--n-s-function", "--n-s-string", "--n-s-type", "--n-s-comment"];
const allowedSyntaxColors = new Set(["--n-text", ...syntaxTokenNames]);
const syntaxColorUse = /--0:var\((--n-[a-z-]+)\)/g;
const allPaths = [...listSectionPaths(), ...["index.mdx", "glossary.mdx", "closing.mdx"].map((name) => join(docsFolder, name))];

const windowSelector = ".expressive-code .frame.is-file";
const barSelector = `${windowSelector} figcaption.header`;
const tabSelector = `${windowSelector} .file-tab`;
const titleSelector = `${windowSelector} .title`;
const noteSelector = `${windowSelector} .file-note`;
const codeAreaSelector = `${windowSelector} pre`;
const codeSelector = `${windowSelector} pre > code`;
const gutterSelector = `${windowSelector} pre.has-marks .ec-line .code::before`;
const addedGutterSelector = `${windowSelector} pre.has-marks .ec-line.ins .code::before`;
const removedGutterSelector = `${windowSelector} pre.has-marks .ec-line.del .code::before`;

function parseTokens(tokens, name) {
  assert.ok(tokens.get(name), `${name} is not defined`);
  return parseColor(tokens.get(name));
}

function ratioOf(tokens, foregroundName, background) {
  return contrastRatio(parseTokens(tokens, foregroundName), background);
}

function backgroundOf(tokens, ...layerNames) {
  return layerNames.map((name) => parseTokens(tokens, name)).reduceRight((under, over) => layerColors(over, under));
}

for (const [theme, tokens] of readThemes(tokensCss)) {
  const surfaces = [
    ["the code background", backgroundOf(tokens, "--n-code")],
    ["an added line", backgroundOf(tokens, "--n-ins", "--n-code")],
    ["a removed line", backgroundOf(tokens, "--n-del", "--n-code")],
  ];

  for (const name of syntaxTokenNames) {
    for (const [surface, background] of surfaces) {
      test(`${name} reaches ${minimumTextRatio}:1 on ${surface} in the ${theme} theme`, () => {
        const ratio = ratioOf(tokens, name, background);
        assert.ok(ratio >= minimumTextRatio, `${theme}: ${name} on ${surface} is ${ratio.toFixed(2)}:1`);
      });
    }
  }

  test(`the plain code text reaches ${minimumTextRatio}:1 on every surface of a file window in the ${theme} theme`, () => {
    for (const [surface, background] of surfaces) {
      const ratio = ratioOf(tokens, readListedTokenUse(windowCss, codeSelector, "color"), background);
      assert.ok(ratio >= minimumTextRatio, `${theme}: the code text on ${surface} is ${ratio.toFixed(2)}:1`);
    }
  });

  test(`the text of the tab reaches ${minimumTextRatio}:1 on the tab background in the ${theme} theme`, () => {
    const foreground = readListedTokenUse(windowCss, titleSelector, "color");
    const background = backgroundOf(tokens, readListedTokenUse(fileCss, tabSelector, "background"));
    const ratio = ratioOf(tokens, foreground, background);
    assert.ok(ratio >= minimumTextRatio, `${theme}: ${foreground} on the tab is ${ratio.toFixed(2)}:1`);
  });

  test(`the Contexto mark reaches ${minimumTextRatio}:1 on the title bar in the ${theme} theme`, () => {
    const foreground = readListedTokenUse(fileCss, noteSelector, "color");
    const background = backgroundOf(tokens, readListedTokenUse(windowCss, barSelector, "background"));
    const ratio = ratioOf(tokens, foreground, background);
    assert.ok(ratio >= minimumTextRatio, `${theme}: ${foreground} on the title bar is ${ratio.toFixed(2)}:1`);
  });

  test(`the + and − signs reach ${minimumTextRatio}:1 on their column and the marks of the column reach ${minimumMarkRatio}:1 in the ${theme} theme`, () => {
    const signColor = readListedTokenUse(fileCss, gutterSelector, "color");
    const columns = [
      ["added", backgroundOf(tokens, "--n-ins", "--n-code"), readListedTokenUse(fileCss, addedGutterSelector, "--mark-bar")],
      ["removed", backgroundOf(tokens, "--n-del", "--n-code"), readListedTokenUse(fileCss, removedGutterSelector, "--mark-bar")],
    ];
    for (const [kind, background, markName] of columns) {
      const signRatio = ratioOf(tokens, signColor, background);
      assert.ok(signRatio >= minimumTextRatio, `${theme}: the sign of an ${kind} line is ${signRatio.toFixed(2)}:1`);
      const markRatio = ratioOf(tokens, markName, background);
      assert.ok(markRatio >= minimumMarkRatio, `${theme}: the bar of an ${kind} line is ${markRatio.toFixed(2)}:1`);
    }
  });
}

test("the added and removed rows take their tint from the same tokens the contrast above measures", () => {
  assert.match(notionCss, /--ec-tm-insBg:\s*var\(--n-ins\)/);
  assert.match(notionCss, /--ec-tm-delBg:\s*var\(--n-del\)/);
});

test("the colors of the file window come only from theme variables", () => {
  assert.doesNotMatch(fileCss, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
});

test("the code area of a file window uses the same background as its tab, so the tab joins the code", () => {
  assert.equal(readListedTokenUse(windowCss, codeAreaSelector, "background-color"), readListedTokenUse(fileCss, tabSelector, "background"));
});

for (const docsPath of allPaths) {
  test(`${relative(docsFolder, docsPath)}: the syntax colors of the file windows are the five syntax tokens or the plain text color`, () => {
    const page = builtPageOf(docsPath);
    assert.ok(existsSync(page), `${relative(guideRoot, page)} is missing: run astro build`);
    for (const window of readFileWindows(readFileSync(page, "utf8"))) {
      for (const [, name] of window.preHtml.matchAll(syntaxColorUse)) {
        assert.ok(allowedSyntaxColors.has(name), `"${window.tabTitle}" colors some code with ${name}, which is not a syntax token`);
      }
    }
  });
}
