import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { guideRoot, listFiles } from "./support.mjs";

const docsFolder = join(guideRoot, "src/content/docs");
const builtFolder = join(guideRoot, "dist");
const quizForm = /<form\b[^>]*\bclass="quiz"[^>]*>[\s\S]*?<\/form>/g;
const optionStart = /(?=<div\b[^>]*\bclass="quiz-option")/;
const correctMark = /^<div\b[^>]*\sdata-correct[\s>=]/;
const feedback = /<div\b[^>]*\bclass="quiz-feedback"[^>]*>([\s\S]*?)<\/div>/;
const inputTag = /<input\b[^>]*>/g;
const formTag = /<form\b/g;
const quizTag = /<Quiz[\s>]/g;
const frontmatter = /^---\n([\s\S]*?)\n---/;
const checkpointField = /^checkpoint:\s*\S/m;
const iconField = /^icon:\s*\p{Extended_Pictographic}/mu;
const iconValue = /^icon:\s*(\S+)/m;
const renderedIcon = /<div\b[^>]*\bclass="page-icon"[^>]*>([^<]*)<\/div>/;

function builtPageOf(docsPath) {
  const slug = relative(docsFolder, docsPath).replace(/\.mdx$/, "");
  return slug === "index" ? join(builtFolder, "index.html") : join(builtFolder, slug, "index.html");
}

function textOf(html) {
  return html.replace(/<[^>]*>/g, "").trim();
}

function frontmatterOf(source) {
  return source.match(frontmatter)?.[1] ?? "";
}

function attributeOf(tag, name) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

function describeQuizzes(page) {
  const html = readFileSync(page, "utf8");
  return (html.match(quizForm) ?? []).map((form) => ({
    forms: (form.match(formTag) ?? []).length,
    inputs: form.match(inputTag) ?? [],
    options: form
      .split(optionStart)
      .slice(1)
      .map((option) => ({
        isCorrect: correctMark.test(option),
        inputs: option.match(inputTag) ?? [],
        feedback: textOf(option.match(feedback)?.[1] ?? ""),
      })),
  }));
}

function builtQuizzes(page, written) {
  const quizzes = describeQuizzes(page);
  assert.equal(quizzes.length, written, `${relative(guideRoot, page)}: found ${quizzes.length} quiz forms, wrote ${written}`);
  return quizzes;
}

function radiosOf(page) {
  const html = readFileSync(page, "utf8");
  return (html.match(inputTag) ?? []).filter((tag) => attributeOf(tag, "type") === "radio");
}

test("the site is built before checking the quizzes", () => {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
});

for (const docsPath of listFiles(docsFolder).filter((path) => path.endsWith(".mdx"))) {
  const name = relative(docsFolder, docsPath);
  const source = readFileSync(docsPath, "utf8");
  const quizzesWritten = (source.match(quizTag) ?? []).length;

  test(`${name}: a page with a checkpoint has an icon`, () => {
    const fields = frontmatterOf(source);
    if (!checkpointField.test(fields)) return;
    assert.match(fields, iconField, `${name}: add icon: <emoji> to the frontmatter`);
  });

  test(`${name}: the icon of the frontmatter is shown above the title`, () => {
    const icon = frontmatterOf(source).match(iconValue)?.[1];
    if (!icon) return;
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    assert.equal(readFileSync(page, "utf8").match(renderedIcon)?.[1].trim(), icon);
  });

  test(`${name}: every written Quiz appears in the built page`, () => {
    const page = builtPageOf(docsPath);
    assert.ok(existsSync(page), `${relative(guideRoot, page)} is missing: run astro build`);
    builtQuizzes(page, quizzesWritten);
  });

  test(`${name}: every quiz has exactly one correct option`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    for (const [index, quiz] of builtQuizzes(page, quizzesWritten).entries()) {
      const correct = quiz.options.filter((option) => option.isCorrect).length;
      assert.ok(quiz.options.length >= 2, `quiz ${index + 1}: needs at least two options`);
      assert.equal(correct, 1, `quiz ${index + 1}: has ${correct} correct options`);
    }
  });

  test(`${name}: every quiz option has a radio input and feedback`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    for (const [index, quiz] of builtQuizzes(page, quizzesWritten).entries()) {
      for (const [position, option] of quiz.options.entries()) {
        const where = `quiz ${index + 1}, option ${position + 1}`;
        assert.equal(option.inputs.length, 1, `${where}: needs exactly one input`);
        assert.equal(attributeOf(option.inputs[0], "type"), "radio", `${where}: the input is not a radio`);
        assert.notEqual(option.feedback, "", `${where}: empty feedback`);
      }
    }
  });

  test(`${name}: the radios of one quiz form one group, apart from the other quizzes`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    const quizzes = builtQuizzes(page, quizzesWritten);
    for (const [index, quiz] of quizzes.entries()) {
      const where = `quiz ${index + 1}`;
      const names = new Set(quiz.inputs.map((tag) => attributeOf(tag, "name")));
      assert.equal(quiz.forms, 1, `${where}: must be one form, not nested in another`);
      assert.equal(quiz.inputs.length, quiz.options.length, `${where}: every input belongs to an option`);
      assert.equal(names.size, 1, `${where}: its radios must share one name`);
      assert.ok([...names][0], `${where}: its radios need a name`);
      for (const tag of quiz.inputs) {
        assert.equal(attributeOf(tag, "form"), undefined, `${where}: a form attribute moves a radio to another group`);
      }
    }
    const inQuizzes = quizzes.reduce((total, quiz) => total + quiz.inputs.length, 0);
    assert.equal(radiosOf(page).length, inQuizzes, "every radio of the page belongs to a quiz form");
  });
}
