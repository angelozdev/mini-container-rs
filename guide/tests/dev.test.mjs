import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, relative } from "node:path";
import { after, before, test } from "node:test";
import { readExercisesCards } from "./card-html.mjs";
import { readHeaderBlocks, readSectionLinks } from "./header-html.mjs";
import { readSectionHeadings } from "./outline-html.mjs";
import { expectedCardLine, expectedProperties } from "./page-metrics.mjs";
import { docsFolder, guideRoot, listSectionPaths, pageUrlOf } from "./support.mjs";
import { readSteppers } from "./stepper-html.mjs";

const astroCli = join(guideRoot, "node_modules/astro/bin/astro.mjs");
const host = "127.0.0.1";
const startupTimeout = 90000;
const sequencePages = [
  { path: "/2-namespaces/a-hostname/", source: "2-namespaces/a-hostname.mdx" },
  { path: "/2-namespaces/b-processes/", source: "2-namespaces/b-processes.mdx" },
  { path: "/2-namespaces/c-filesystem/", source: "2-namespaces/c-filesystem.mdx" },
  { path: "/3-cgroups/a-memory/", source: "3-cgroups/a-memory.mdx" },
  { path: "/3-cgroups/b-cleanup/", source: "3-cgroups/b-cleanup.mdx" },
];
const stepTag = /<Step[\s>]/g;
const sectionPaths = listSectionPaths();

let server;
let baseUrl;
let output = "";

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, host, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitUntilServing(url) {
  const deadline = Date.now() + startupTimeout;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`astro dev exited early:\n${output}`);
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`astro dev did not answer in ${startupTimeout} ms:\n${output}`);
}

before(async () => {
  const port = await freePort();
  baseUrl = `http://${host}:${port}`;
  server = spawn(process.execPath, [astroCli, "dev", "--port", String(port), "--host", host, "--ignore-lock"], {
    cwd: guideRoot,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", ASTRO_DISABLE_UPDATE_CHECK: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => (output += chunk));
  server.stderr.on("data", (chunk) => (output += chunk));
  await waitUntilServing(baseUrl);
}, { timeout: startupTimeout + 5000 });

after(async () => {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once("exit", resolve));
  server.kill("SIGTERM");
  await exited;
});

for (const page of sequencePages) {
  test(`${page.source}: the steppers render under astro dev, where elements carry source annotations`, async () => {
    const response = await fetch(baseUrl + page.path);
    const html = await response.text();
    assert.equal(response.status, 200, `${page.path} answered ${response.status}`);
    assert.ok(html.includes("data-astro-source-file"), "astro dev should annotate the elements with their source file");
    const written = (readFileSync(join(docsFolder, page.source), "utf8").match(stepTag) ?? []).length;
    const [stepper] = readSteppers(html);
    assert.ok(stepper, `${page.path}: no stepper in the page served by astro dev`);
    assert.equal(stepper.stages.length, written, `${page.path}: found ${stepper.stages.length} steps, wrote ${written}`);
    assert.equal(stepper.radios.length, written, `${page.path}: needs one radio per step`);
    assert.equal(stepper.players.length, written, `${page.path}: needs one player per step`);
  });
}

for (const docsPath of sectionPaths) {
  test(`${relative(docsFolder, docsPath)}: the properties block renders under astro dev`, async () => {
    const response = await fetch(baseUrl + pageUrlOf(docsPath));
    const html = await response.text();
    assert.equal(response.status, 200, `${pageUrlOf(docsPath)} answered ${response.status}`);
    assert.ok(html.includes("data-astro-source-file"), "astro dev should annotate the elements with their source file");
    const order = readSectionLinks(html);
    const position = order.indexOf(pageUrlOf(docsPath)) + 1;
    assert.ok(position > 0, `${pageUrlOf(docsPath)} is not among the sidebar sections ${order.join(", ")}`);
    const blocks = readHeaderBlocks(html);
    assert.equal(blocks.length, 1, `expected exactly one properties block, found ${blocks.length}`);
    const [section, reading, exercises] = blocks[0].rows;
    const expected = expectedProperties(readFileSync(docsPath, "utf8"), position, order.length);
    assert.deepEqual([section.label, reading.label, exercises.label], ["Sección", "Lectura", "Ejercicios"]);
    assert.equal(section.value, expected.section);
    assert.deepEqual(section.progress.filled, expected.filled);
    assert.equal(reading.value, expected.reading);
    assert.equal(exercises.value, expected.exercises);
  });
}

for (const docsPath of sectionPaths) {
  test(`${relative(docsFolder, docsPath)}: the exercises card renders under astro dev, linked to the Ejercicios heading`, async () => {
    const response = await fetch(baseUrl + pageUrlOf(docsPath));
    const html = await response.text();
    assert.equal(response.status, 200, `${pageUrlOf(docsPath)} answered ${response.status}`);
    assert.ok(html.includes("data-astro-source-file"), "astro dev should annotate the elements with their source file");
    const cards = readExercisesCards(html);
    assert.equal(cards.length, 1, `expected exactly one card, found ${cards.length}`);
    const heading = readSectionHeadings(html).find((candidate) => candidate.text === "Ejercicios");
    assert.ok(heading, "the page has no Ejercicios heading");
    assert.equal(cards[0].href, `#${heading.id}`);
    assert.equal(cards[0].title, "Ir a los ejercicios");
    assert.equal(cards[0].summary, expectedCardLine(readFileSync(docsPath, "utf8")));
  });
}

test("the cover and the glossary have no exercises card under astro dev", async () => {
  for (const path of ["/", "/glossary/"]) {
    const html = await (await fetch(baseUrl + path)).text();
    assert.equal(readExercisesCards(html).length, 0, `${path} has an exercises card`);
  }
});

test("the cover and the glossary have no properties block under astro dev", async () => {
  for (const path of ["/", "/glossary/"]) {
    const html = await (await fetch(baseUrl + path)).text();
    assert.equal(readHeaderBlocks(html).length, 0, `${path} has a properties block`);
  }
});
