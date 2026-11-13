const wordsPerMinute = 200;
const codeLinesPerMinute = 10;
const minuteStep = 5;
const minimumMinutes = 5;

const fenceOpening = /^\s*(`{3,})/;
const moduleLine = /^\s*(?:import|export)\s/;
const inlineCodeOrTag = /(`+)(?!`)[\s\S]*?[^`]\1(?!`)|<\/?[A-Za-z][\w.:-]*(?:"[^"]*"|'[^']*'|\{[^}]*\}|[^>"'{}])*>/g;
const leadingMarkers = /^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)?/;
const wordCharacter = /[\p{L}\p{N}]/u;
const exerciseHeading = /^###\s+\d+[a-z]\.\d+\s/;

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
}

export function measurePage(body: string): PageMetrics {
  const { proseLines, codeLines } = splitCode(body);
  const words = countWords(proseLines);
  return {
    words,
    codeLines,
    minutes: readingMinutes(words, codeLines),
    exercises: proseLines.filter((line) => exerciseHeading.test(line)).length,
  };
}
