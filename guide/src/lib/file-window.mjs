import { addClassName, getClassNames, h, s, select, selectAll, toText } from "@astrojs/starlight/expressive-code/hast";
import { isTerminalBlock } from "./terminal-window.mjs";

const contextFlag = "context";
const contextLabel = "Contexto";
const scrollRegionLabel = "Código de";
const dotCount = 3;
const lineBreakInCopy = "\x7f";

function hasContextFlag(codeBlock) {
  return codeBlock.metaOptions.getBoolean(contextFlag) === true;
}

function makeDots() {
  const dots = Array.from({ length: dotCount }, () => h("i"));
  return h("span", { className: ["window-dots"], "aria-hidden": "true" }, dots);
}

function makeFileIcon() {
  return s("svg", { className: ["file-icon"], viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false" }, [
    s("path", { d: "M3.8 1.8h5.4l3 3v9.4H3.8z" }),
    s("path", { d: "M9.2 1.8v3h3" }),
  ]);
}

function makeContextNote() {
  return h("span", { className: ["file-note"] }, contextLabel);
}

function makeScrollable(pre, title) {
  pre.properties.tabIndex = 0;
  pre.properties.role = "region";
  pre.properties.ariaLabel = `${scrollRegionLabel} ${title}`;
}

function copyWithoutRemovedLines(codeBlock, window) {
  const button = select("div.copy button", window);
  if (!button) return;
  const rows = selectAll("div.ec-line", select("pre", window));
  const kept = codeBlock.getLines().filter((_, index) => !getClassNames(rows[index]).includes("del"));
  button.properties.dataCode = kept.map((line) => line.text).join(lineBreakInCopy);
}

function dressWindow(codeBlock, window) {
  const header = select("figcaption.header", window);
  const title = header && select("span.title", header);
  const titleText = title ? toText(title).trim() : "";
  if (titleText === "") {
    throw new Error(`a ${codeBlock.language} block needs a title="path/to/file" for the tab of its file window`);
  }
  addClassName(window, "is-file");
  header.children = [makeDots(), h("span", { className: ["file-tab"] }, [makeFileIcon(), title])];
  if (hasContextFlag(codeBlock)) header.children.push(makeContextNote());
  const pre = select("pre", window);
  makeScrollable(pre, titleText);
  if (selectAll("div.ec-line.ins, div.ec-line.del", pre).length > 0) addClassName(pre, "has-marks");
  copyWithoutRemovedLines(codeBlock, window);
}

export function fileWindow() {
  return {
    name: "File window",
    hooks: {
      preprocessCode: ({ codeBlock }) => {
        if (!isTerminalBlock(codeBlock)) {
          codeBlock.props.wrap = false;
          return;
        }
        if (hasContextFlag(codeBlock)) {
          throw new Error(`${contextFlag} only works on blocks that are not terminals, not on ${codeBlock.language}`);
        }
      },
      postprocessRenderedBlock: ({ codeBlock, renderData }) => {
        if (!isTerminalBlock(codeBlock)) dressWindow(codeBlock, renderData.blockAst);
      },
    },
  };
}
