import { attributeOf, readDiv, readElement } from "./support.mjs";

const contentOpening = /<div\b[^>]*\bclass="sl-markdown-content"[^>]*>/;
const sectionHeading = /<div\b[^>]*\bclass="sl-heading-wrapper level-h2"[^>]*><h2\b[^>]*\sid="([^"]*)"/g;
const listOpening = /<ul\b[^>]*>/;
const linkOpening = /<a\b[^>]*>/;
const overviewHref = "#_top";

export function readSectionIds(html) {
  const content = html.match(contentOpening);
  if (!content) return [];
  const body = readDiv(html, content.index);
  return [...body.matchAll(sectionHeading)].map((heading) => heading[1]);
}

function readTopLevelItems(list) {
  const inner = list.slice(list.match(listOpening)[0].length);
  const items = [];
  let position = inner.indexOf("<li");
  while (position !== -1) {
    const item = readElement(inner, position, "li");
    items.push(item);
    position = inner.indexOf("<li", position + item.length);
  }
  return items;
}

export function readContentsLinks(html, tagName) {
  const start = html.indexOf(`<${tagName}`);
  if (start === -1) return [];
  const contents = readElement(html, start, tagName);
  const list = readElement(contents, contents.search(listOpening), "ul");
  return readTopLevelItems(list)
    .map((item) => attributeOf(item.match(linkOpening)[0], "href"))
    .filter((href) => href !== overviewHref);
}
