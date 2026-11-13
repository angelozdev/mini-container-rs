import { attributeOf, readElement, textOf } from "./support.mjs";

const sidebarOpening = /<nav\b[^>]*\baria-label="Primario"[^>]*>/;
const groupOpening = /<details\b[^>]*>/g;
const linkHref = /<a\b[^>]*\shref="([^"]+)"/g;
const blockOpening = /<dl\b[^>]*\bclass="[^"]*\bpage-props\b[^"]*"[^>]*>/g;
const rowPattern = /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/g;
const progressOpening = /<span\b[^>]*\bclass="[^"]*\bpage-progress\b[^"]*"[^>]*>/;
const segmentTag = /<i\b[^>]*>/g;
const filledFlag = /\sdata-filled[\s>=]/;
const titleOpening = /<h1\b[^>]*\bid="_top"[^>]*>/;
const contentOpening = /<div\b[^>]*\bclass="sl-markdown-content"[^>]*>/;

export function readSectionLinks(html) {
  const sidebar = readElement(html, html.match(sidebarOpening).index, "nav");
  const links = [...sidebar.matchAll(groupOpening)].flatMap((group) =>
    [...readElement(sidebar, group.index, "details").matchAll(linkHref)].map((link) => link[1]),
  );
  return [...new Set(links)];
}

function readProgress(valueHtml) {
  const bar = valueHtml.match(progressOpening);
  if (!bar) return null;
  const segments = readElement(valueHtml, bar.index, "span").match(segmentTag) ?? [];
  return { segments: segments.length, filled: segments.map((tag) => filledFlag.test(tag)) };
}

function readRow([, labelHtml, valueHtml]) {
  return { label: textOf(labelHtml), value: textOf(valueHtml), progress: readProgress(valueHtml) };
}

export function readHeaderBlocks(html) {
  return [...html.matchAll(blockOpening)].map((opening) => {
    const block = readElement(html, opening.index, "dl");
    return {
      index: opening.index,
      words: Number(attributeOf(opening[0], "data-words")),
      codeLines: Number(attributeOf(opening[0], "data-code-lines")),
      rows: [...block.matchAll(rowPattern)].map(readRow),
    };
  });
}

export function readPageLandmarks(html) {
  return { title: html.match(titleOpening)?.index ?? -1, content: html.match(contentOpening)?.index ?? -1 };
}
