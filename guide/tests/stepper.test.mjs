import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { attributeOf, builtFolder, builtPageOf, docsFolder, guideRoot, listFiles, readDiv, textOf } from "./support.mjs";

const sequencePages = ["2-namespaces/a-hostname.mdx", "2-namespaces/b-processes.mdx"];
const minimumSteps = 2;
const maximumSteps = 8;

const stepperOpening = /<div\b[^>]*\bclass="stepper not-content"[^>]*>/g;
const stageOpening = /<div\b[^>]*\bclass="stepper-stage"[^>]*>/g;
const sceneOpening = /<div\b[^>]*\bclass="stepper-scene"[^>]*>/g;
const captionOpening = /<div\b[^>]*\bclass="stepper-caption"[^>]*>/g;
const segmentsOpening = /<div\b[^>]*\bclass="stepper-segments"[^>]*>/g;
const countElement = /<span\b[^>]*\bclass="stepper-count"[^>]*>([\s\S]*?)<\/span>/g;
const labelTag = /<label\b[^>]*>/g;
const inputTag = /<input\b[^>]*>/g;
const idAttribute = /\sid="([^"]*)"/g;
const checkedMark = /\schecked[\s>=]/;
const stepperTag = /<Stepper[\s>]/g;
const stepTag = /<Step[\s>]/g;

function divsOf(html, opening) {
  return [...html.matchAll(opening)].map((match) => readDiv(html, match.index));
}

function readStepper(html) {
  const [segments = ""] = divsOf(html, segmentsOpening);
  return {
    html,
    radios: (html.match(inputTag) ?? []).filter((tag) => attributeOf(tag, "type") === "radio"),
    stages: divsOf(html, stageOpening).map((stage) => ({
      opening: stage.match(/<div\b[^>]*>/)[0],
      scene: textOf(divsOf(stage, sceneOpening)[0] ?? ""),
      caption: textOf(divsOf(stage, captionOpening)[0] ?? ""),
    })),
    counts: [...html.matchAll(countElement)].map((count) => textOf(count[1])),
    segmentTargets: (segments.match(labelTag) ?? []).map((tag) => attributeOf(tag, "for")),
    labelTargets: (html.match(labelTag) ?? []).map((tag) => attributeOf(tag, "for")),
  };
}

function builtSteppers(page) {
  const html = readFileSync(page, "utf8");
  return divsOf(html, stepperOpening).map(readStepper);
}

function builtIds(page) {
  return [...readFileSync(page, "utf8").matchAll(idAttribute)].map((id) => id[1]);
}

function expectBuilt(page, written) {
  const steppers = builtSteppers(page);
  assert.equal(steppers.length, written, `${relative(guideRoot, page)}: found ${steppers.length} steppers, wrote ${written}`);
  return steppers;
}

test("the site is built before checking the steppers", () => {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
});

for (const sequencePage of sequencePages) {
  test(`${sequencePage}: a diagram that tells a sequence is a Stepper`, () => {
    const source = readFileSync(join(docsFolder, sequencePage), "utf8");
    const written = (source.match(stepperTag) ?? []).length;
    assert.ok(written > 0, `${sequencePage}: replace its diagram with a Stepper`);
  });
}

for (const docsPath of listFiles(docsFolder).filter((path) => path.endsWith(".mdx"))) {
  const name = relative(docsFolder, docsPath);
  const source = readFileSync(docsPath, "utf8");
  const steppersWritten = (source.match(stepperTag) ?? []).length;
  const stepsWritten = (source.match(stepTag) ?? []).length;

  test(`${name}: every written Stepper and Step appears in the built page`, () => {
    const page = builtPageOf(docsPath);
    assert.ok(existsSync(page), `${relative(guideRoot, page)} is missing: run astro build`);
    const steppers = expectBuilt(page, steppersWritten);
    const stages = steppers.reduce((total, stepper) => total + stepper.stages.length, 0);
    assert.equal(stages, stepsWritten, `${name}: found ${stages} steps, wrote ${stepsWritten}`);
  });

  test(`${name}: every stepper has ${minimumSteps} to ${maximumSteps} steps, each with a scene and a caption`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    for (const [index, stepper] of expectBuilt(page, steppersWritten).entries()) {
      const where = `stepper ${index + 1}`;
      assert.ok(stepper.stages.length >= minimumSteps, `${where}: needs at least ${minimumSteps} steps`);
      assert.ok(stepper.stages.length <= maximumSteps, `${where}: has more than ${maximumSteps} steps`);
      for (const [position, stage] of stepper.stages.entries()) {
        assert.equal(attributeOf(stage.opening, "data-step"), String(position + 1), `${where}: step ${position + 1} is out of order`);
        assert.notEqual(stage.scene, "", `${where}, step ${position + 1}: empty scene`);
        assert.notEqual(stage.caption, "", `${where}, step ${position + 1}: empty caption`);
      }
    }
  });

  test(`${name}: every stepper has one radio per step and only the first is checked`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    for (const [index, stepper] of expectBuilt(page, steppersWritten).entries()) {
      const where = `stepper ${index + 1}`;
      assert.equal(stepper.radios.length, stepper.stages.length, `${where}: needs one radio per step`);
      const checked = stepper.radios.flatMap((tag, position) => (checkedMark.test(tag) ? [position] : []));
      assert.deepEqual(checked, [0], `${where}: exactly the first radio must be checked`);
      for (const [position, tag] of stepper.radios.entries()) {
        assert.ok(attributeOf(tag, "aria-label"), `${where}, radio ${position + 1}: needs an aria-label`);
      }
    }
  });

  test(`${name}: every stepper shows its position as n/N, once per step, in order`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    for (const [index, stepper] of expectBuilt(page, steppersWritten).entries()) {
      const total = stepper.stages.length;
      const expected = stepper.stages.map((_, position) => `${position + 1}/${total}`);
      assert.deepEqual(stepper.counts, expected, `stepper ${index + 1}: counters must read ${expected.join(", ")}`);
    }
  });

  test(`${name}: every label points to an id that exists, and the ids are unique in the page`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    const ids = builtIds(page);
    for (const [index, stepper] of expectBuilt(page, steppersWritten).entries()) {
      const where = `stepper ${index + 1}`;
      const radioIds = stepper.radios.map((tag) => attributeOf(tag, "id"));
      for (const id of radioIds) {
        assert.ok(id, `${where}: every radio needs an id`);
        assert.equal(ids.filter((other) => other === id).length, 1, `${where}: the id ${id} is not unique in the page`);
      }
      assert.ok(stepper.labelTargets.length > 0, `${where}: needs labels`);
      for (const target of stepper.labelTargets) {
        assert.ok(radioIds.includes(target), `${where}: a label points to ${target}, which is not one of its radios`);
      }
      assert.deepEqual(stepper.segmentTargets, radioIds, `${where}: the progress segments must point to the radios, in order`);
    }
  });

  test(`${name}: the radios of one stepper form one group, apart from the other steppers and the quizzes`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    const steppers = expectBuilt(page, steppersWritten);
    const groups = [];
    for (const [index, stepper] of steppers.entries()) {
      const names = new Set(stepper.radios.map((tag) => attributeOf(tag, "name")));
      assert.equal(names.size, 1, `stepper ${index + 1}: its radios must share one name`);
      assert.ok([...names][0], `stepper ${index + 1}: its radios need a name`);
      for (const tag of stepper.radios) {
        assert.equal(attributeOf(tag, "form"), undefined, `stepper ${index + 1}: a form attribute moves a radio to another group`);
      }
      groups.push([...names][0]);
    }
    assert.equal(new Set(groups).size, groups.length, `${name}: two steppers share a radio name`);
    const outside = steppers.reduce((html, stepper) => html.replace(stepper.html, ""), readFileSync(page, "utf8"));
    for (const tag of outside.match(inputTag) ?? []) {
      assert.ok(!groups.includes(attributeOf(tag, "name")), `${name}: an input outside the steppers uses a stepper radio name`);
    }
  });
}
