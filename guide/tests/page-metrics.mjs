const wordsPerMinute = 200;
const codeLinesPerMinute = 10;
const minuteStep = 5;

const frontmatter = /^---\n[\s\S]*?\n---\n/;
const fencedBlock = /^[ \t]*(`{3,})[^\n]*\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm;
const moduleLine = /^[ \t]*(?:import|export)\s.*$/gm;
const lineMarker = /^[ \t]*(?:>[ \t]*)*(?:(?:[-*+]|\d+[.)])[ \t]+)?/gm;
const inlineCode = /(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g;
const componentTag = /<\/?[A-Za-z][\w.:-]*(?:"[^"]*"|'[^']*'|\{[^}]*\}|[^>"'{}])*>/g;
const wordCharacter = /[\p{L}\p{N}]/u;

function bodyOf(source) {
  return source.replace(frontmatter, "");
}

export function countCodeLines(source) {
  let lines = 0;
  for (const block of bodyOf(source).matchAll(fencedBlock)) {
    lines += block[2].split("\n").filter((line) => line.trim() !== "").length;
  }
  return lines;
}

function withoutTags(text) {
  let result = "";
  let last = 0;
  for (const span of text.matchAll(inlineCode)) {
    result += text.slice(last, span.index).replace(componentTag, " ") + span[0];
    last = span.index + span[0].length;
  }
  return result + text.slice(last).replace(componentTag, " ");
}

export function countWords(source) {
  const prose = withoutTags(bodyOf(source).replace(fencedBlock, "\n").replace(moduleLine, "")).replace(lineMarker, "");
  return prose.split(/\s+/).filter((token) => wordCharacter.test(token)).length;
}

export function readingMinutes(source) {
  const raw = countWords(source) / wordsPerMinute + countCodeLines(source) / codeLinesPerMinute;
  return Math.max(minuteStep, minuteStep * Math.round(raw / minuteStep));
}

export function pageId(source) {
  return source.match(/^title:\s*(\d+[a-z])\s/m)?.[1];
}

export function exerciseNumbers(source) {
  const id = pageId(source);
  if (!id) return [];
  const heading = new RegExp(`^###\\s+${id}\\.(\\d+)\\s`, "gm");
  const prose = bodyOf(source).replace(fencedBlock, "\n");
  return [...prose.matchAll(heading)].map((match) => Number(match[1]));
}

export function expectedProperties(source, position, total) {
  return {
    section: `${position} de ${total}`,
    reading: `unos ${readingMinutes(source)} min`,
    exercises: String(exerciseNumbers(source).length),
    filled: Array.from({ length: total }, (_, index) => index < position),
  };
}
