import { attributeOf, readDiv, textOf } from "./support.mjs";

const stepperOpening = /<div\b[^>]*\bclass="stepper not-content"[^>]*>/g;
const sceneOpening = /<div\b[^>]*\bclass="stepper-scene"[^>]*>/;
const captionOpening = /<div\b[^>]*\bclass="stepper-caption"[^>]*>/;
const navOpening = /<div\b[^>]*\bclass="stepper-nav"[^>]*>/;
const segmentsOpening = /<div\b[^>]*\bclass="stepper-segments"[^>]*>/;
const buttonElement = /<(label|span)\b[^>]*\bclass="stepper-button"[^>]*>([\s\S]*?)<\/\1>/g;
const segmentTag = /<label\b[^>]*\bclass="stepper-segment"[^>]*>/g;
const countElement = /<span\b[^>]*\bclass="stepper-count"[^>]*>([\s\S]*?)<\/span>/;
const openingTag = /^<[a-z]+\b[^>]*>/;
const flagOf = (tag, name) => new RegExp(`\\s${name}[\\s>=]`).test(tag);

function readChildren(html) {
  const children = [];
  let position = 0;
  while (position < html.length) {
    if (/\s/.test(html[position])) {
      position += 1;
      continue;
    }
    const element = html.startsWith("<div", position)
      ? readDiv(html, position)
      : html.slice(position, html.indexOf(">", position) + 1);
    const opening = element.match(openingTag)?.[0];
    if (!opening) throw new Error(`unexpected content inside a stepper: ${html.slice(position, position + 40)}`);
    children.push({ tag: opening.match(/^<([a-z]+)/)[1], opening, html: element });
    position += element.length;
  }
  return children;
}

function readStage(html) {
  const scene = html.match(sceneOpening);
  const caption = html.match(captionOpening);
  return {
    scene: scene ? textOf(readDiv(html, scene.index)) : "",
    caption: caption ? textOf(readDiv(html, caption.index)) : "",
    captionId: caption ? attributeOf(caption[0], "id") : undefined,
  };
}

function readPlayer(html) {
  const nav = html.match(navOpening);
  const segments = html.match(segmentsOpening);
  const count = html.match(countElement);
  return {
    buttons: nav
      ? [...readDiv(html, nav.index).matchAll(buttonElement)].map((button) => ({
          text: textOf(button[2]),
          target: attributeOf(button[0], "for"),
          off: flagOf(button[0], "data-off"),
        }))
      : [],
    segments: segments
      ? (readDiv(html, segments.index).match(segmentTag) ?? []).map((tag) => ({
          target: attributeOf(tag, "for"),
          filled: flagOf(tag, "data-filled"),
        }))
      : [],
    count: count ? textOf(count[1]) : "",
  };
}

function readStepper(html) {
  const opening = html.match(openingTag)[0];
  const children = readChildren(html.slice(opening.length, -"</div>".length));
  const radios = children.filter((child) => child.tag === "input").map((child) => child.opening);
  return {
    html,
    label: attributeOf(opening, "aria-label"),
    children,
    radios,
    head: textOf(children.find((child) => attributeOf(child.opening, "class") === "stepper-head")?.html ?? ""),
    stages: children.filter((child) => attributeOf(child.opening, "class") === "stepper-stage").map((child) => readStage(child.html)),
    players: children.filter((child) => attributeOf(child.opening, "class") === "stepper-player").map((child) => readPlayer(child.html)),
  };
}

export function readSteppers(html) {
  return [...html.matchAll(stepperOpening)].map((opening) => readStepper(readDiv(html, opening.index)));
}

export function attributeFlag(tag, name) {
  return flagOf(tag, name);
}
