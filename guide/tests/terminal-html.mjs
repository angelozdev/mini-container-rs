import { attributeOf, hasClass, readDiv, readElement, textOf } from "./support.mjs";

const figureOpening = /<figure\b[^>]*>/g;
const divOpening = /<div\b[^>]*>/g;
const titleElement = /<span\b[^>]*\bclass="title"[^>]*>([\s\S]*?)<\/span>/;
const keyElement = /<span\b[^>]*\bclass="stderr-key"[^>]*>([\s\S]*?)<\/span>/;
const dotsElement = /<span\b[^>]*\bclass="terminal-dots"[^>]*>[\s\S]*?<\/span>/;
const preElement = /<pre\b[^>]*>[\s\S]*?<\/pre>/;
const preOpening = /<pre\b[^>]*>/;
const copyButton = /<button\b[^>]*\bdata-code="[^"]*"[^>]*>/;
const lineBreakInCopy = "\x7f";
const namedEntities = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&amp;": "&" };

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&(?:lt|gt|quot|apos|amp);/g, (entity) => namedEntities[entity]);
}

function readRowText(rowHtml) {
  const text = decodeEntities(rowHtml.replace(/<[^>]*>/g, ""));
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

function readRows(preHtml) {
  return [...preHtml.matchAll(divOpening)]
    .filter((opening) => hasClass(opening[0], "ec-line"))
    .map((opening) => {
      const row = readDiv(preHtml, opening.index);
      return { classes: attributeOf(opening[0], "class").split(/\s+/), text: readRowText(row) };
    });
}

function readWindow(html) {
  const opening = html.match(figureOpening)[0];
  const preHtml = html.match(preElement)?.[0] ?? "";
  const copy = html.match(copyButton)?.[0];
  return {
    html,
    classes: attributeOf(opening, "class").split(/\s+/),
    title: textOf(html.match(titleElement)?.[1] ?? ""),
    key: html.match(keyElement) ? textOf(html.match(keyElement)[1]) : undefined,
    dots: html.match(dotsElement)?.[0],
    pre: preHtml.match(preOpening)?.[0] ?? "",
    language: attributeOf(preHtml.match(preOpening)?.[0] ?? "", "data-language"),
    preHtml,
    rows: readRows(preHtml),
    hasCopyButton: copy !== undefined,
    copiedLines: copy ? decodeEntities(attributeOf(copy, "data-code")).split(lineBreakInCopy) : [],
  };
}

export function readCodeWindows(html) {
  return [...html.matchAll(figureOpening)]
    .filter((opening) => hasClass(opening[0], "frame"))
    .map((opening) => readWindow(readElement(html, opening.index, "figure")));
}

export function readTerminalWindows(html) {
  return readCodeWindows(html).filter((window) => window.classes.includes("is-terminal"));
}

export function readShouldSeeBlocks(html) {
  return [...html.matchAll(divOpening)]
    .filter((opening) => hasClass(opening[0], "should-see"))
    .map((opening) => {
      const block = readDiv(html, opening.index);
      return { html: block, windows: readCodeWindows(block) };
    });
}

const promptPrefix = "$ ";

export function readLineRanges(meta, key) {
  const range = meta.match(new RegExp(`\\b${key}=\\{([^}]*)\\}`))?.[1];
  if (range === undefined) return [];
  return range.split(",").flatMap((part) => {
    const [first, last = first] = part.trim().split("-").map(Number);
    return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
  });
}

export function readExpectedRows(block) {
  const markedAsOutput = /(^|\s)output(\s|$)/.test(block.meta);
  const hasPrompt = block.lines.some((line) => line.startsWith(promptPrefix));
  const stderr = new Set(readLineRanges(block.meta, "stderr"));
  return block.lines.map((line, index) => {
    const isPrompted = line.startsWith(promptPrefix);
    const isImplied = !markedAsOutput && !hasPrompt && line.trim() !== "";
    return {
      isCommand: isPrompted || isImplied,
      isStderr: stderr.has(index + 1),
      text: isPrompted ? line.slice(promptPrefix.length) : line,
    };
  });
}
