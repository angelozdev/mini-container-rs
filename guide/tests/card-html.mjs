import { attributeOf, hasClass, readDiv, readElement, textOf } from "./support.mjs";

const anchorOpening = /<a\b[^>]*>/g;
const titlePattern = /<b\b[^>]*>([\s\S]*?)<\/b>/;
const summaryPattern = /<span\b[^>]*>([\s\S]*?)<\/span>/;
const rightColumnOpening = /<div\b[^>]*\bclass="[^"]*\bright-sidebar-panel\b[^"]*"[^>]*>/;
const hintOpening = /<details\b[^>]*\bclass="[^"]*\bhint\b[^"]*"[^>]*>/g;
const cardClass = "exercises-card";

export function readExercisesCards(html) {
  return [...html.matchAll(anchorOpening)]
    .filter((opening) => hasClass(opening[0], cardClass))
    .map((opening) => {
      const card = readElement(html, opening.index, "a");
      return {
        index: opening.index,
        href: attributeOf(opening[0], "href"),
        title: textOf(card.match(titlePattern)?.[1] ?? ""),
        summary: textOf(card.match(summaryPattern)?.[1] ?? ""),
      };
    });
}

export function readRightColumn(html) {
  const opening = html.match(rightColumnOpening);
  if (!opening) return null;
  return { index: opening.index, html: readDiv(html, opening.index) };
}

export function readSmallScreenContents(html) {
  const start = html.indexOf("<mobile-starlight-toc");
  return start === -1 ? "" : readElement(html, start, "mobile-starlight-toc");
}

export function countHintsInPage(html) {
  return (html.match(hintOpening) ?? []).length;
}
