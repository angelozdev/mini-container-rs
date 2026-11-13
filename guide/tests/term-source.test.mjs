import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { test } from "node:test";
import { docsFolder, listFiles, readGlossaryEntries } from "./support.mjs";
import { findMisplacedTerms, findTermUseProblems, formsOf } from "./term-source.mjs";

const documentedExceptions = [
  {
    page: "0-setup/b-rust-project.mdx",
    id: "target",
    excerpt: "Instala el target de Linux",
    reason: "the use is in the bold title of step 3, before the Term that opens its text",
  },
  {
    page: "2-namespaces/b-processes.mdx",
    id: "signal",
    excerpt: "«Por qué el PID 1 ignora señales»",
    reason: "the use is the quoted title of a later section, not the concept",
  },
  {
    page: "2-namespaces/b-processes.mdx",
    id: "sigkill",
    excerpt: "SIGKILL or SIGSTOP are treated exceptionally",
    reason: "the use is inside a quotation of pid_namespaces(7) in the sources, not the concept",
  },
  {
    page: "2-namespaces/b-processes.mdx",
    id: "sigkill",
    excerpt: "«SIGKILL P1990 Term Kill signal»",
    reason: "the use is inside a quotation of the signal table of signal(7) in the sources, not the concept",
  },
  {
    page: "2-namespaces/b-processes.mdx",
    id: "sigkill",
    excerpt: "The signals SIGKILL and SIGSTOP cannot be caught",
    reason: "the use is inside a quotation of signal(7) in the sources, not the concept",
  },
  {
    page: "3-cgroups/a-memory.mdx",
    id: "process-group",
    excerpt: "limita lo que un grupo de procesos puede gastar",
    reason: "the sentence defines a cgroup with the everyday sense of a group of processes, not the group the terminal uses for Ctrl-C",
  },
];

const mdx = (...lines) => lines.join("\n");
const entry = (id, term, match) => ({ id, term, definition: "x", ...(match ? { match } : {}) });
const kernel = entry("kernel", "kernel");
const signal = entry("signal", "señal", ["señal", "señales"]);
const kernelTerm = '<Term id="kernel">kernel</Term>';
const fence = "```";

test("the forms of an entry are its term unless the entry lists its own", () => {
  assert.deepEqual(formsOf(kernel), ["kernel"]);
  assert.deepEqual(formsOf(signal), ["señal", "señales"]);
});

const zones = [
  ["frontmatter", mdx("---", `title: ${kernelTerm}`, "---", "", "Text.")],
  ["import", mdx("---", "title: A", "---", `import Kernel from "${kernelTerm}";`)],
  ["code", mdx("Text.", "", `${fence}sh`, kernelTerm, fence)],
  ["code", mdx("1. Step", "", `   ${fence}rust title="src/a.rs"`, `   ${kernelTerm}`, `   ${fence}`)],
  ["inline code", `Use \`${kernelTerm}\` here.`],
  ["inline code", `Use \`\`format!("\`{}\` ${kernelTerm}")\`\` here.`],
  ["heading", `## The ${kernelTerm}`],
  ["link", `Read [the ${kernelTerm}](/glossary/) now.`],
  ["block (Quiz)", mdx('<Quiz kind="prediction">', `<Fragment slot="question">A ${kernelTerm}?</Fragment>`, "</Quiz>")],
  ["block (QuizOption)", `<QuizOption>A ${kernelTerm}.</QuizOption>`],
  ["block (Hint)", `<Hint n={1}>A ${kernelTerm}.</Hint>`],
  ["block (Hint)", mdx("<Hint n={1}>", `A ${kernelTerm}.`, "</Hint>")],
  ["block (ShouldSee)", mdx("<ShouldSee>", `A ${kernelTerm}.`, "</ShouldSee>")],
  ["block (Stepper)", mdx('<Stepper name="a" title="A">', `A ${kernelTerm}.`, "<Step>", "</Step>", "</Stepper>")],
  ["block (Step)", mdx("<Stepper>", "<Step>", "<Lane>", `A ${kernelTerm}.`, "</Lane>", "</Step>", "</Stepper>")],
  ["block (BeforeAfter)", mdx("<BeforeAfter>", '<Fragment slot="before">', `A ${kernelTerm}.`, "</Fragment>", "</BeforeAfter>")],
  ["block (Compare)", mdx("<Compare>", '<Fragment slot="bad">', `A ${kernelTerm}.`, "</Fragment>", "</Compare>")],
];

for (const [zone, source] of zones) {
  test(`a Term in ${zone} is reported`, () => {
    const found = findMisplacedTerms(source);
    assert.equal(found.length, 1, `expected one misplaced Term, found ${JSON.stringify(found)}`);
    assert.equal(found[0].zone, zone);
  });
}

const allowed = [
  ["a paragraph", `A ${kernelTerm} here.`],
  ["a list item", mdx("1. **Step.**", "", `   A ${kernelTerm} here.`)],
  ["an Aside", mdx('<Aside type="note" title="Analogía">', `A ${kernelTerm} here.`, "</Aside>")],
  ["a paragraph after a closed Quiz", mdx("<Quiz>", "<QuizOption>A.</QuizOption>", "</Quiz>", "", `A ${kernelTerm} here.`)],
  ["a paragraph after a closed Hint", mdx("<Hint n={1}>A.</Hint>", `A ${kernelTerm} here.`)],
  ["a paragraph with code and a link before it", `Use \`ls\` and [x](/y/) and the ${kernelTerm}.`],
  ["emphasis", `*A ${kernelTerm}.*`],
];

for (const [place, source] of allowed) {
  test(`a Term in ${place} is accepted`, () => {
    assert.deepEqual(findMisplacedTerms(source), []);
  });
}

const problemsOf = (source, ...entriesOfPage) => findTermUseProblems(source, entriesOfPage);

test("a word used before its Term in the same paragraph is reported", () => {
  const { early } = problemsOf(`The kernel is big. A ${kernelTerm} is small.`, kernel);
  assert.deepEqual(early.map(({ id, line }) => [id, line]), [["kernel", 1]]);
});

test("a word used in an earlier paragraph than its Term is reported", () => {
  const { early } = problemsOf(mdx("First kernel.", "", `Second ${kernelTerm}.`), kernel);
  assert.deepEqual(early.map(({ id, line, termLine }) => [id, line, termLine]), [["kernel", 1, 3]]);
});

test("the plural of a word counts as a use of it", () => {
  const { early } = problemsOf(mdx("Las señales llegan.", "", 'Una <Term id="signal">señal</Term>.'), signal);
  assert.deepEqual(early.map(({ id }) => id), ["signal"]);
});

test("the first use is accepted when the Term marks it", () => {
  const { early, unmarked, foreign } = problemsOf(mdx(`The ${kernelTerm}.`, "", "The kernel again."), kernel);
  assert.deepEqual([early, unmarked, foreign], [[], [], []]);
});

test("uses outside the prose do not count as earlier uses", () => {
  const source = mdx(
    "---",
    "title: The kernel",
    "---",
    "import Kernel from 'kernel';",
    "## The kernel",
    "Use `kernel` and [the kernel](/kernel/).",
    "<Quiz>",
    "<QuizOption>The kernel.</QuizOption>",
    "</Quiz>",
    `${fence}sh`,
    "kernel",
    fence,
    `The ${kernelTerm}.`,
  );
  const { early, unmarked, foreign } = problemsOf(source, kernel);
  assert.deepEqual([early, unmarked, foreign], [[], [], []]);
});

test("a use of a word on a page that marks other terms, without its own Term, is reported", () => {
  const { unmarked } = problemsOf(mdx(`The ${kernelTerm}.`, "", "A señal arrives."), kernel, signal);
  assert.deepEqual(unmarked.map(({ id, line }) => [id, line]), [["signal", 3]]);
});

test("a page without any Term has nothing to report", () => {
  const { early, unmarked, foreign } = problemsOf("The kernel and the señal.", kernel, signal);
  assert.deepEqual([early, unmarked, foreign], [[], [], []]);
});

test("a Term whose word is not a form of its entry is reported", () => {
  const { foreign } = problemsOf('The <Term id="kernel">core</Term>.', kernel);
  assert.deepEqual(foreign.map(({ id, word }) => [id, word]), [["kernel", "core"]]);
});

test("a word that is only part of a longer word is not a use", () => {
  const { unmarked } = problemsOf(mdx(`The ${kernelTerm}.`, "", "The kernels and kernel-mode."), kernel);
  assert.deepEqual(unmarked, []);
});

const excuseOf = (id, excerpt) => ({ id, excerpt });

test("an excused first use does not hide a second early use of the same word", () => {
  const source = mdx("The kernel is named in a title.", "", "The kernel again, too early.", "", `The ${kernelTerm}.`);
  const { early, unusedExcuses } = findTermUseProblems(source, [kernel], [excuseOf("kernel", "The kernel is named")]);
  assert.deepEqual(early.map(({ id, line }) => [id, line]), [["kernel", 3]]);
  assert.deepEqual(unusedExcuses, []);
});

test("an excuse covers only the occurrence it quotes, not another one on the same line", () => {
  const source = mdx("A kernel and a kernel.", "", `The ${kernelTerm}.`);
  const { early } = findTermUseProblems(source, [kernel], [excuseOf("kernel", "A kernel and")]);
  assert.deepEqual(early.map(({ id, line }) => [id, line]), [["kernel", 1]]);
});

test("an excuse for one word does not excuse another word on the same line", () => {
  const source = mdx(`The ${kernelTerm}.`, "", "A señal and the kernel.");
  const { unmarked } = findTermUseProblems(source, [kernel, signal], [excuseOf("kernel", "A señal and")]);
  assert.deepEqual(unmarked.map(({ id, line }) => [id, line]), [["signal", 3]]);
});

test("a word used without its Term on a page that marks others can be excused for an ordinary sense", () => {
  const source = mdx(`The ${kernelTerm}.`, "", "Sin ninguna señal de vida.");
  const { unmarked, unusedExcuses } = findTermUseProblems(source, [kernel, signal], [excuseOf("signal", "ninguna señal de vida")]);
  assert.deepEqual([unmarked, unusedExcuses], [[], []]);
});

test("every unmarked use is reported, not only the first", () => {
  const source = mdx(`The ${kernelTerm}.`, "", "A señal arrives.", "", "Another señal arrives.");
  const { unmarked } = findTermUseProblems(source, [kernel, signal], [excuseOf("signal", "A señal arrives")]);
  assert.deepEqual(unmarked.map(({ id, line }) => [id, line]), [["signal", 5]]);
});

test("an excuse that quotes text that is no problem is reported as unused", () => {
  const source = mdx(`The ${kernelTerm}.`, "", "The kernel again.");
  const stale = excuseOf("kernel", "The kernel again");
  const missing = excuseOf("kernel", "text that is not on the page");
  const { unusedExcuses } = findTermUseProblems(source, [kernel], [stale, missing]);
  assert.deepEqual(unusedExcuses, [stale, missing]);
});

test("an excuse that quotes only a use inside inline code is reported as unused", () => {
  const source = mdx(`The ${kernelTerm}.`, "", "Use `kernel` here.");
  const { early, unmarked, unusedExcuses } = findTermUseProblems(source, [kernel], [excuseOf("kernel", "Use `kernel` here")]);
  assert.deepEqual([early, unmarked], [[], []]);
  assert.equal(unusedExcuses.length, 1);
});

const rejectedExcerpts = [
  ["an empty", ""],
  ["a blank", "   "],
  ["a missing", undefined],
];

for (const [kind, excerpt] of rejectedExcerpts) {
  test(`an excuse with ${kind} excerpt is rejected, also when the page has an early use`, () => {
    const source = mdx("The kernel first.", "", `The ${kernelTerm}.`);
    assert.throws(
      () => findTermUseProblems(source, [kernel], [excuseOf("kernel", excerpt)]),
      /the excuse for "kernel" needs an excerpt of text/,
    );
  });
}

const entries = readGlossaryEntries();
const pages = listFiles(docsFolder)
  .filter((path) => path.endsWith(".mdx"))
  .map((path) => ({ name: relative(docsFolder, path), source: readFileSync(path, "utf8") }));

test("the glossary entries list their word forms as non-empty strings", () => {
  for (const { id, match } of entries) {
    if (match === undefined) continue;
    assert.ok(Array.isArray(match) && match.length > 0, `${id}: match must be a non-empty list`);
    for (const form of match) assert.ok(typeof form === "string" && form.trim() !== "", `${id}: a form is empty`);
  }
});

for (const page of pages) {
  test(`${page.name}: no Term sits in the frontmatter, imports, code, headings, links, quizzes, hints, outputs or diagrams`, () => {
    const found = findMisplacedTerms(page.source).map(({ line, zone }) => `line ${line} in ${zone}`);
    assert.deepEqual(found, [], `${page.name}: these Terms are in a zone that is not prose`);
  });

  test(`${page.name}: every Term marks the first use of its word in the prose of the page`, () => {
    const excuses = documentedExceptions.filter(({ page: name }) => name === page.name);
    const { early, unmarked, foreign } = findTermUseProblems(page.source, entries, excuses);
    assert.deepEqual(
      early.map(({ id, line, termLine }) => `${id}: used at line ${line}, marked at line ${termLine}`),
      [],
      `${page.name}: a word is used before its Term`,
    );
    assert.deepEqual(
      unmarked.map(({ id, line }) => `${id}: used at line ${line}`),
      [],
      `${page.name}: a glossary word is used and never marked`,
    );
    assert.deepEqual(
      foreign.map(({ id, word, line }) => `${id}: "${word}" at line ${line} is not one of its forms`),
      [],
      `${page.name}: a Term word is not a form of its entry`,
    );
  });
}

test("every documented exception is still needed", () => {
  for (const exception of documentedExceptions) {
    const { page: name, id, reason } = exception;
    const page = pages.find((candidate) => candidate.name === name);
    assert.ok(page, `${name} does not exist`);
    const excuses = documentedExceptions.filter((candidate) => candidate.page === name);
    const { unusedExcuses } = findTermUseProblems(page.source, entries, excuses);
    assert.ok(!unusedExcuses.includes(exception), `${name}: the exception for ${id} (${reason}) excuses no use: remove it or fix its excerpt`);
  }
});
