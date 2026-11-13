const wordsPerMinute = 200;
const codeLinesPerMinute = 10;
const minuteStep = 5;
const minimumMinutes = 5;

const fenceOpening = /^\s*(`{3,})/;
const moduleLine = /^\s*(?:import|export)\s/;
const inlineCodePattern = /(`+)(?!`)[\s\S]*?[^`]\1(?!`)/;
const componentTagPattern = /<\/?[A-Za-z][\w.:-]*(?:"[^"]*"|'[^']*'|\{[^}]*\}|[^>"'{}])*>/;
const inlineCodeOrTag = new RegExp(`${inlineCodePattern.source}|${componentTagPattern.source}`, "g");
const inlineCode = new RegExp(inlineCodePattern.source, "g");
const hintTag = /<Hint[\s/>]/g;
const leadingMarkers = /^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)?/;
const wordCharacter = /[\p{L}\p{N}]/u;
const pageIdPattern = /^(\d+[a-z])\s/;

interface SplitPage {
  proseLines: string[];
  codeLines: number;
}

function splitCode(body: string): SplitPage {
  const proseLines: string[] = [];
  let codeLines = 0;
  let closing: RegExp | null = null;
  for (const line of body.split("\n")) {
    if (closing) {
      if (closing.test(line)) closing = null;
      else if (line.trim() !== "") codeLines += 1;
      continue;
    }
    const opening = line.match(fenceOpening);
    if (opening) closing = new RegExp(`^\\s*\`{${opening[1].length},}\\s*$`);
    else proseLines.push(line);
  }
  return { proseLines, codeLines };
}

function ownExerciseHeading(title: string): (line: string) => boolean {
  const id = title.match(pageIdPattern)?.[1];
  if (!id) return () => false;
  const heading = new RegExp(`^###\\s+${id}\\.\\d+\\s`);
  return (line) => heading.test(line);
}

function countHints(proseLines: string[]): number {
  return (proseLines.join("\n").replace(inlineCode, " ").match(hintTag) ?? []).length;
}

function countWords(proseLines: string[]): number {
  const text = proseLines
    .filter((line) => !moduleLine.test(line))
    .join("\n")
    .replace(inlineCodeOrTag, (found) => (found.startsWith("`") ? found : " "));
  return text
    .split("\n")
    .map((line) => line.replace(leadingMarkers, ""))
    .join(" ")
    .split(/\s+/)
    .filter((token) => wordCharacter.test(token)).length;
}

function readingMinutes(words: number, codeLines: number): number {
  const raw = words / wordsPerMinute + codeLines / codeLinesPerMinute;
  return Math.max(minimumMinutes, minuteStep * Math.round(raw / minuteStep));
}

export interface PageMetrics {
  words: number;
  codeLines: number;
  minutes: number;
  exercises: number;
  hints: number;
}

export function measurePage(body: string, title: string): PageMetrics {
  const { proseLines, codeLines } = splitCode(body);
  const words = countWords(proseLines);
  return {
    words,
    codeLines,
    minutes: readingMinutes(words, codeLines),
    exercises: proseLines.filter(ownExerciseHeading(title)).length,
    hints: countHints(proseLines),
  };
}
