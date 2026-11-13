import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { docsFolder, guideRoot } from "./support.mjs";
import { readSteppers } from "./stepper-html.mjs";

const astroCli = join(guideRoot, "node_modules/astro/bin/astro.mjs");
const host = "127.0.0.1";
const startupTimeout = 90000;
const sequencePages = [
  { path: "/2-namespaces/a-hostname/", source: "2-namespaces/a-hostname.mdx" },
  { path: "/2-namespaces/b-processes/", source: "2-namespaces/b-processes.mdx" },
];
const stepTag = /<Step[\s>]/g;

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
