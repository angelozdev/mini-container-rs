import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { captionMarker, maximumSteps, minimumSteps, stepMarker } from "../src/components/diagram/stepper-protocol.mjs";
import { attributeOf, builtFolder, builtPageOf, docsFolder, guideRoot, listFiles } from "./support.mjs";
import { attributeFlag, readSteppers } from "./stepper-html.mjs";

const sequencePages = [
  "2-namespaces/a-hostname.mdx",
  "2-namespaces/b-processes.mdx",
  "2-namespaces/c-filesystem.mdx",
  "3-cgroups/a-memory.mdx",
  "3-cgroups/b-cleanup.mdx",
];

const inputTag = /<input\b[^>]*>/g;
const idAttribute = /\sid="([^"]*)"/g;
const stepperTag = /<Stepper[\s>]/g;
const stepTag = /<Step[\s>]/g;
const stepperBlock = /<Stepper[\s>][\s\S]*?<\/Stepper>/g;
const rawClass = /\sclass=/;
const restartMark = "↺";
const backMark = "◀";
const forwardMark = "▶";

function builtSteppers(page) {
  return readSteppers(readFileSync(page, "utf8"));
}

function builtIds(page) {
  return [...readFileSync(page, "utf8").matchAll(idAttribute)].map((id) => id[1]);
}

function expectBuilt(page, written) {
  const steppers = builtSteppers(page);
  assert.equal(steppers.length, written, `${relative(guideRoot, page)}: found ${steppers.length} steppers, wrote ${written}`);
  return steppers;
}

function idsOf(stepper) {
  return stepper.radios.map((tag) => attributeOf(tag, "id"));
}

test("the site is built before checking the steppers", () => {
  assert.ok(existsSync(builtFolder), "guide/dist is missing: run astro build");
});

test("no built page leaks a step marker: every Step is inside a Stepper", () => {
  for (const path of listFiles(builtFolder).filter((file) => file.endsWith(".html"))) {
    const html = readFileSync(path, "utf8");
    assert.ok(
      !html.includes(stepMarker) && !html.includes(captionMarker),
      `${relative(guideRoot, path)}: a Step is used outside a Stepper`,
    );
  }
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

  test(`${name}: a Step is only written inside a Stepper`, () => {
    assert.ok(steppersWritten > 0 || stepsWritten === 0, `${name}: a Step is used outside a Stepper`);
  });

  test(`${name}: the steps use the diagram components, not raw class names`, () => {
    for (const block of source.match(stepperBlock) ?? []) {
      assert.ok(!rawClass.test(block), `${name}: a Stepper holds raw HTML with a class attribute: use Process, Lane or KernelBox props instead`);
    }
  });

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
        assert.notEqual(stage.scene, "", `${where}, step ${position + 1}: empty scene`);
        assert.notEqual(stage.caption, "", `${where}, step ${position + 1}: empty caption`);
      }
    }
  });

  test(`${name}: every radio is followed by its stage and then by its player`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    for (const [index, stepper] of expectBuilt(page, steppersWritten).entries()) {
      const where = `stepper ${index + 1}`;
      const [head, ...rest] = stepper.children;
      assert.equal(attributeOf(head.opening, "class"), "stepper-head", `${where}: the head comes first`);
      const expected = stepper.stages.flatMap(() => ["stepper-radio", "stepper-stage", "stepper-player"]);
      assert.deepEqual(
        rest.map((child) => attributeOf(child.opening, "class")),
        expected,
        `${where}: each step must be a radio, its stage and its player, in that order`,
      );
    }
  });

  test(`${name}: every stepper has one radio per step and only the first is checked`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    for (const [index, stepper] of expectBuilt(page, steppersWritten).entries()) {
      const where = `stepper ${index + 1}`;
      assert.equal(stepper.radios.length, stepper.stages.length, `${where}: needs one radio per step`);
      const checked = stepper.radios.flatMap((tag, position) => (attributeFlag(tag, "checked") ? [position] : []));
      assert.deepEqual(checked, [0], `${where}: exactly the first radio must be checked`);
      for (const [position, tag] of stepper.radios.entries()) {
        assert.ok(attributeOf(tag, "aria-label"), `${where}, radio ${position + 1}: needs an aria-label`);
      }
    }
  });

  test(`${name}: every radio is described by the caption of its own step`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    const ids = builtIds(page);
    for (const [index, stepper] of expectBuilt(page, steppersWritten).entries()) {
      for (const [position, tag] of stepper.radios.entries()) {
        const where = `stepper ${index + 1}, step ${position + 1}`;
        const captionId = stepper.stages[position].captionId;
        assert.ok(captionId, `${where}: the caption needs an id`);
        assert.equal(ids.filter((other) => other === captionId).length, 1, `${where}: the caption id ${captionId} is not unique in the page`);
        assert.equal(attributeOf(tag, "aria-describedby"), captionId, `${where}: the radio must be described by its caption`);
      }
    }
  });

  test(`${name}: every player shows its position as n/N`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    for (const [index, stepper] of expectBuilt(page, steppersWritten).entries()) {
      const total = stepper.stages.length;
      const expected = stepper.stages.map((_, position) => `${position + 1}/${total}`);
      assert.deepEqual(
        stepper.players.map((player) => player.count),
        expected,
        `stepper ${index + 1}: counters must read ${expected.join(", ")}`,
      );
    }
  });

  test(`${name}: the back and play buttons of each step point to the neighbouring radios`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    for (const [index, stepper] of expectBuilt(page, steppersWritten).entries()) {
      const ids = idsOf(stepper);
      for (const [position, player] of stepper.players.entries()) {
        const where = `stepper ${index + 1}, step ${position + 1}`;
        const last = position === ids.length - 1;
        const [back, forward, ...extra] = player.buttons;
        assert.equal(extra.length, 0, `${where}: needs exactly two buttons`);
        assert.equal(back?.text, backMark, `${where}: the first button is ${backMark}`);
        assert.equal(forward?.text, last ? restartMark : forwardMark, `${where}: the second button is ${last ? restartMark : forwardMark}`);
        if (position === 0) {
          assert.ok(back.off && back.target === undefined, `${where}: ${backMark} is disabled on the first step`);
        } else {
          assert.equal(back.target, ids[position - 1], `${where}: ${backMark} must point to the radio of step ${position}`);
        }
        const expected = last ? ids[0] : ids[position + 1];
        assert.equal(forward.target, expected, `${where}: ${forward.text} must point to the radio of step ${last ? 1 : position + 2}`);
      }
    }
  });

  test(`${name}: the progress segments of each step point to every radio and fill up to the step`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    for (const [index, stepper] of expectBuilt(page, steppersWritten).entries()) {
      const ids = idsOf(stepper);
      for (const [position, player] of stepper.players.entries()) {
        const where = `stepper ${index + 1}, step ${position + 1}`;
        assert.deepEqual(
          player.segments.map((segment) => segment.target),
          ids,
          `${where}: the segments must point to the radios, in order`,
        );
        assert.deepEqual(
          player.segments.map((segment) => segment.filled),
          ids.map((_, segment) => segment <= position),
          `${where}: the segments must be filled up to this step`,
        );
      }
    }
  });

  test(`${name}: every radio id is unique in the page`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    const ids = builtIds(page);
    for (const [index, stepper] of expectBuilt(page, steppersWritten).entries()) {
      for (const id of idsOf(stepper)) {
        assert.ok(id, `stepper ${index + 1}: every radio needs an id`);
        assert.equal(ids.filter((other) => other === id).length, 1, `stepper ${index + 1}: the id ${id} is not unique in the page`);
      }
    }
  });

  test(`${name}: each stepper has its own name and its own group label`, () => {
    const page = builtPageOf(docsPath);
    if (!existsSync(page)) return;
    const steppers = expectBuilt(page, steppersWritten);
    const names = steppers.map((stepper, index) => {
      const used = new Set(stepper.radios.map((tag) => attributeOf(tag, "name")));
      assert.equal(used.size, 1, `stepper ${index + 1}: its radios must share one name`);
      assert.ok([...used][0], `stepper ${index + 1}: its radios need a name`);
      for (const tag of stepper.radios) {
        assert.equal(attributeOf(tag, "form"), undefined, `stepper ${index + 1}: a form attribute moves a radio to another group`);
      }
      return [...used][0];
    });
    assert.equal(new Set(names).size, names.length, `${name}: two steppers share the name ${names.find((n, i) => names.indexOf(n) !== i)}: give each Stepper its own name`);
    const labels = steppers.map((stepper) => stepper.label);
    for (const [index, label] of labels.entries()) {
      assert.ok(label, `stepper ${index + 1}: needs a group label`);
    }
    assert.equal(new Set(labels).size, labels.length, `${name}: two steppers share the title ${labels.find((l, i) => labels.indexOf(l) !== i)}: give each Stepper its own title`);
    const outside = steppers.reduce((html, stepper) => html.replace(stepper.html, ""), readFileSync(page, "utf8"));
    for (const tag of outside.match(inputTag) ?? []) {
      assert.ok(!names.includes(attributeOf(tag, "name")), `${name}: an input outside the steppers uses a stepper radio name`);
    }
  });
}
