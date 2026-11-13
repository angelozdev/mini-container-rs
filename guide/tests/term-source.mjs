const blockNames = "Quiz|QuizOption|Hint|ShouldSee|Stepper|Step|BeforeAfter|Compare";
const blockTag = new RegExp(`<(${blockNames})\\b[^>]*?(?<!/)>|</(${blockNames})>`, "g");
const fenceLine = /^\s*`{3,}/;
const headingLine = /^\s*#{1,6}\s/;
const importLine = /^\s*import\s/;
const termMarkup = /<Term id="([^"]+)">([^<]*)<\/Term>/g;
const termOpening = /<Term(?=[\s>])/g;
const linkMarkup = /\[[^\]]*\]\([^)]*\)/g;
const wordEdge = "[\\p{L}\\p{N}_-]";

export function formsOf(entry) {
  return entry.match ?? [entry.term];
}

function readZones(source) {
  const lines = source.split("\n");
  const frontmatterEnd = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  const stack = [];
  let inFence = false;
  return lines.map((text, index) => {
    const number = index + 1;
    if (index <= frontmatterEnd) return { number, text, zone: "frontmatter" };
    if (fenceLine.test(text)) {
      inFence = !inFence;
      return { number, text, zone: "code" };
    }
    if (inFence) return { number, text, zone: "code" };
    const insideBefore = stack.length > 0;
    let innermost = stack.at(-1);
    for (const tag of text.matchAll(blockTag)) {
      if (tag[1]) {
        stack.push(tag[1]);
        innermost = tag[1];
      } else {
        stack.pop();
      }
    }
    if (insideBefore || innermost) return { number, text, zone: `block (${innermost})` };
    if (importLine.test(text)) return { number, text, zone: "import" };
    if (headingLine.test(text)) return { number, text, zone: "heading" };
    return { number, text, zone: "prose" };
  });
}

function inlineCodeRanges(text) {
  const runs = [...text.matchAll(/`+/g)];
  const ranges = [];
  for (let index = 0; index < runs.length; index += 1) {
    const closing = runs.findIndex((run, position) => position > index && run[0].length === runs[index][0].length);
    if (closing === -1) continue;
    ranges.push([runs[index].index, runs[closing].index + runs[closing][0].length]);
    index = closing;
  }
  return ranges;
}

function linkRanges(text) {
  return [...text.matchAll(linkMarkup)].map((link) => [link.index, link.index + link[0].length]);
}

function maskedRanges(text) {
  return [...inlineCodeRanges(text), ...linkRanges(text)];
}

function mask(text, ranges) {
  return ranges.reduce(
    (masked, [start, end]) => masked.slice(0, start) + " ".repeat(end - start) + masked.slice(end),
    text,
  );
}

function proseZoneOf(text, index) {
  const within = ([start, end]) => index >= start && index < end;
  if (inlineCodeRanges(text).some(within)) return "inline code";
  if (linkRanges(text).some(within)) return "link";
  return null;
}

export function findMisplacedTerms(source) {
  return readZones(source).flatMap(({ number, text, zone }) =>
    [...text.matchAll(termOpening)].flatMap((opening) => {
      const where = zone === "prose" ? proseZoneOf(text, opening.index) : zone;
      return where ? [{ line: number, zone: where }] : [];
    }),
  );
}

function stripTerms(text) {
  const terms = [];
  let clean = "";
  let last = 0;
  for (const markup of text.matchAll(termMarkup)) {
    clean += text.slice(last, markup.index);
    terms.push({ id: markup[1], word: markup[2], start: clean.length });
    clean += markup[2];
    last = markup.index + markup[0].length;
  }
  return { clean: clean + text.slice(last), terms };
}

function readProse(source) {
  return readZones(source)
    .filter(({ zone }) => zone === "prose")
    .map(({ number, text }) => {
      const { clean, terms } = stripTerms(text);
      return { number, text: mask(clean, maskedRanges(clean)), terms };
    });
}

function formsPattern(entry) {
  const forms = [...formsOf(entry)].sort((left, right) => right.length - left.length);
  const alternatives = forms.map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`(?<!${wordEdge})(?:${alternatives})(?!${wordEdge})`, "iu");
}

export function findTermUseProblems(source, entries) {
  const prose = readProse(source);
  const marked = new Map();
  for (const line of prose) {
    for (const term of line.terms) if (!marked.has(term.id)) marked.set(term.id, { ...term, line: line.number });
  }
  const early = [];
  const unmarked = [];
  const foreign = [];
  for (const entry of entries) {
    const pattern = formsPattern(entry);
    const mark = marked.get(entry.id);
    if (mark && !pattern.test(mark.word)) foreign.push({ id: entry.id, word: mark.word, line: mark.line });
    for (const line of prose) {
      const use = line.text.match(pattern);
      if (!use) continue;
      if (!mark && marked.size > 0) unmarked.push({ id: entry.id, line: line.number });
      else if (mark && (line.number !== mark.line || use.index !== mark.start)) {
        early.push({ id: entry.id, line: line.number, termLine: mark.line });
      }
      break;
    }
  }
  return { early, unmarked, foreign };
}
