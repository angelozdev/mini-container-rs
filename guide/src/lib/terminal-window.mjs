import { LanguageGroups, isInlineStyleAnnotation } from "@astrojs/starlight/expressive-code";
import { addClassName, h, select } from "@astrojs/starlight/expressive-code/hast";

const promptPrefix = "$ ";
const stderrKeyText = "stderr";
const scrollRegionLabel = "Salida del terminal";
const dotCount = 3;
const lineBreakInCopy = "\x7f";

const commandLines = new WeakSet();
const stderrLines = new WeakSet();

function isTerminalBlock({ props, language }) {
  const frame = props.frame ?? "auto";
  return frame === "terminal" || (frame === "auto" && LanguageGroups.terminal.includes(language));
}

function readLineNumbers(range) {
  return range.split(",").flatMap((part) => {
    const [first, last = first] = part.trim().split("-").map(Number);
    if (!Number.isInteger(first) || !Number.isInteger(last) || last < first) {
      throw new Error(`stderr={${range}} is not a list of lines or ranges of lines`);
    }
    return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
  });
}

function markStderrLines(codeBlock) {
  const range = codeBlock.metaOptions.getRange("stderr");
  if (range === undefined) return;
  if (!isTerminalBlock(codeBlock)) throw new Error(`stderr={${range}} only works on terminal blocks, not on ${codeBlock.language}`);
  const lines = codeBlock.getLines();
  for (const number of readLineNumbers(range)) {
    const line = lines[number - 1];
    if (!line) throw new Error(`stderr={${range}} points to line ${number}, but the block has ${lines.length} lines`);
    stderrLines.add(line);
  }
}

function findCommandLines(codeBlock) {
  const lines = codeBlock.getLines();
  const prompted = lines.filter((line) => line.text.startsWith(promptPrefix));
  if (prompted.length > 0 || codeBlock.metaOptions.getBoolean("output")) return prompted;
  return lines.filter((line) => line.text.trim() !== "");
}

function markCommandLines(codeBlock) {
  for (const line of findCommandLines(codeBlock)) {
    if (line.text.startsWith(promptPrefix)) line.editText(0, promptPrefix.length, "");
    commandLines.add(line);
  }
}

function removeSyntaxColors(codeBlock) {
  for (const line of codeBlock.getLines()) {
    line.getAnnotations().filter(isInlineStyleAnnotation).forEach((annotation) => line.deleteAnnotation(annotation));
  }
}

function makeDots() {
  const dots = Array.from({ length: dotCount }, () => h("i"));
  return h("span", { className: ["terminal-dots"], "aria-hidden": "true" }, dots);
}

function makeStderrKey() {
  return h("span", { className: ["stderr-key"] }, stderrKeyText);
}

function makeScrollable(pre) {
  pre.properties.tabIndex = 0;
  pre.properties.role = "region";
  pre.properties.ariaLabel = scrollRegionLabel;
}

function copyOnlyCommands(codeBlock, window) {
  const copy = select("div.copy", window);
  if (!copy) return;
  const commands = codeBlock.getLines().filter((line) => commandLines.has(line)).map((line) => line.text);
  if (commands.length === 0) {
    window.children = window.children.filter((child) => child !== copy);
    return;
  }
  select("button", copy).properties.dataCode = commands.join(lineBreakInCopy);
}

function dressWindow(codeBlock, window) {
  const header = select("figcaption.header", window);
  header.children.unshift(makeDots());
  if (codeBlock.getLines().some((line) => stderrLines.has(line))) header.children.push(makeStderrKey());
  makeScrollable(select("pre", window));
  copyOnlyCommands(codeBlock, window);
}

export function terminalWindow() {
  return {
    name: "Terminal window",
    hooks: {
      preprocessCode: ({ codeBlock }) => {
        markStderrLines(codeBlock);
        if (!isTerminalBlock(codeBlock)) return;
        codeBlock.props.wrap = false;
        markCommandLines(codeBlock);
      },
      postprocessAnalyzedCode: ({ codeBlock }) => {
        if (isTerminalBlock(codeBlock)) removeSyntaxColors(codeBlock);
      },
      postprocessRenderedLine: ({ line, renderData }) => {
        if (commandLines.has(line)) addClassName(renderData.lineAst, "is-command");
        if (stderrLines.has(line)) addClassName(renderData.lineAst, "is-stderr");
      },
      postprocessRenderedBlock: ({ codeBlock, renderData }) => {
        if (isTerminalBlock(codeBlock)) dressWindow(codeBlock, renderData.blockAst);
      },
    },
  };
}
