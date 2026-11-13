import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { guideRoot, listFiles } from "./support.mjs";

const docsFolder = join(guideRoot, "src/content/docs");
const builtFolder = join(guideRoot, "dist");
const quizSection = /<section\b[^>]*\bclass="quiz"[^>]*>[\s\S]*?<\/section>/g;
const quizOption = /<details\b[^>]*\bclass="quiz-option"[^>]*>[\s\S]*?<\/details>/g;
const correctMark = /^<details\b[^>]*\sdata-correct[\s>=]/;
const feedback = /<div\b[^>]*\bclass="quiz-feedback"[^>]*>([\s\S]*?)<\/div>/;
const quizTag = /<Quiz[\s>]/g;

function builtPageOf(docsPath) {
  const slug = relative(docsFolder, docsPath).replace(/\.mdx$/, "");
  return slug === "index" ? join(builtFolder, "index.html") : join(builtFolder, slug, "index.html");
}

function textOf(html) {
  return html.replace(/<[^>]*>/g, "").trim();
}

function describeQuizzes(page) {
  const html = readFileSync(page, "utf8");
  return (html.match(quizSection) ?? []).map((section) => ({
    options: (section.match(quizOption) ?? []).map((option) => ({
      isCorrect: correctMark.test(option),
      feedback: textOf(option.match(feedback)?.[1] ?? ""),
    })),
  }));
}

test("the site is built before checking the quizzes", () => {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
});

for (const docsPath of listFiles(docsFolder).filter((path) => path.endsWith(".mdx"))) {
  const name = relative(docsFolder, docsPath);
  const quizzesWritten = (readFileSync(docsPath, "utf8").match(quizTag) ?? []).length;

  test(`${name}: every written Quiz appears in the built page`, () => {
    const page = builtPageOf(docsPath);
    assert.ok(existsSync(page), `${relative(guideRoot, page)} is missing: run astro build`);
    assert.equal(describeQuizzes(page).length, quizzesWritten);
  });

  test(`${name}: every quiz has exactly one correct option`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    for (const [index, quiz] of describeQuizzes(page).entries()) {
      const correct = quiz.options.filter((option) => option.isCorrect).length;
      assert.ok(quiz.options.length >= 2, `quiz ${index + 1}: needs at least two options`);
      assert.equal(correct, 1, `quiz ${index + 1}: has ${correct} correct options`);
    }
  });

  test(`${name}: every quiz option has feedback`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    for (const [index, quiz] of describeQuizzes(page).entries()) {
      for (const [position, option] of quiz.options.entries()) {
        assert.notEqual(option.feedback, "", `quiz ${index + 1}, option ${position + 1}: empty feedback`);
      }
    }
  });
}
