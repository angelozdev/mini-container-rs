import { attributeOf, hasClass, readDiv, textOf } from "./support.mjs";

const divOpening = /<div\b[^>]*>/g;
const callElement = /<code\b[^>]*\bclass="outcomes-call"[^>]*>([\s\S]*?)<\/code>/;
const arrowOpening = /<span\b[^>]*\bclass="outcomes-arrow"[^>]*>/;
const noteElement = /<span\b[^>]*\bclass="outcome-note"[^>]*>([\s\S]*?)<\/span>/;

function readOutcome(html) {
  const opening = html.match(divOpening)[0];
  return {
    kind: attributeOf(opening, "data-outcome"),
    label: textOf(html.replace(noteElement, "")),
    note: textOf(html.match(noteElement)?.[1] ?? ""),
  };
}

function readBlock(html) {
  const arrow = html.match(arrowOpening)?.[0];
  const outcomes = [...html.matchAll(divOpening)]
    .filter((opening) => hasClass(opening[0], "outcome"))
    .map((opening) => readOutcome(readDiv(html, opening.index)));
  return {
    html,
    call: textOf(html.match(callElement)?.[1] ?? ""),
    arrowHidden: arrow !== undefined && attributeOf(arrow, "aria-hidden") === "true",
    outcomes,
  };
}

export function readOutcomeBlocks(html) {
  return [...html.matchAll(divOpening)]
    .filter((opening) => hasClass(opening[0], "outcomes"))
    .map((opening) => readBlock(readDiv(html, opening.index)));
}

const diagramClasses = ["diagram", "stepper-surface", "outcomes"];

export function readDiagrams(html) {
  return [...html.matchAll(divOpening)]
    .map((opening) => ({ opening: opening[0], kind: diagramClasses.find((name) => hasClass(opening[0], name)) }))
    .filter((diagram) => diagram.kind !== undefined)
    .map((diagram) => ({ kind: diagram.kind, hasGrid: hasClass(diagram.opening, "diagram-grid") }));
}
