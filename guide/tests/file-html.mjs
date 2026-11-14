import { attributeOf, hasClass, readElement, textOf } from "./support.mjs";
import { readCodeWindows } from "./terminal-html.mjs";

const spanOpening = /<span\b[^>]*>/g;
const headerElement = /<figcaption\b[^>]*\bclass="header"[^>]*>[\s\S]*?<\/figcaption>/;
const iconElement = /<svg\b[^>]*>/;

function readSpanByClass(html, name) {
  const opening = [...html.matchAll(spanOpening)].find((candidate) => hasClass(candidate[0], name));
  return opening ? readElement(html, opening.index, "span") : undefined;
}

function readFileWindow(window) {
  const header = window.html.match(headerElement)?.[0] ?? "";
  const tab = readSpanByClass(header, "file-tab");
  const note = readSpanByClass(header, "file-note");
  const dots = readSpanByClass(header, "window-dots");
  const icon = tab?.match(iconElement)?.[0];
  return {
    ...window,
    headerText: textOf(header),
    hasTab: tab !== undefined,
    hasIcon: icon !== undefined && attributeOf(icon, "aria-hidden") === "true",
    tabTitle: tab ? textOf(readSpanByClass(tab, "title") ?? "") : undefined,
    note: note ? textOf(note) : undefined,
    dotCount: dots ? (dots.match(/<i><\/i>/g) ?? []).length : 0,
    hasMarks: (attributeOf(window.pre, "class") ?? "").split(/\s+/).includes("has-marks"),
    ariaLabel: attributeOf(window.pre, "aria-label"),
    role: attributeOf(window.pre, "role"),
    tabindex: attributeOf(window.pre, "tabindex"),
  };
}

export function readFileWindows(html) {
  return readCodeWindows(html)
    .filter((window) => window.classes.includes("is-file"))
    .map(readFileWindow);
}
