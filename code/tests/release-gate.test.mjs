import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cwd = fileURLToPath(new URL("..", import.meta.url));
const run = (mode, file) => spawnSync(process.execPath, ["scripts/release-gate.mjs", mode, file], { cwd, encoding: "utf8" });

test("preview record is traceable and passes the release gate", () => {
  const result = run("preview", "../docs/releases/PREVIEW-2026-09-11.json");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /accepted/);
});

test("production candidate passes with explicit user-authorized automated acceptance", () => {
  const result = run("production", "../docs/releases/PRODUCTION-CANDIDATE.json");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /accepted/);
});

test("production gate rejects incomplete automated acceptance evidence", async () => {
  const folder = await mkdtemp(join(tmpdir(), "iot-atlas-release-"));
  const record = JSON.parse(await readFile(new URL("../../docs/releases/PRODUCTION-CANDIDATE.json", import.meta.url), "utf8"));
  delete record.authorizationSource;
  record.previousVerifiedVersion = "";
  const fixture = join(folder, "invalid-production.json");
  await writeFile(fixture, JSON.stringify(record));
  try {
    const result = run("production", fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /automated acceptance/);
    assert.match(result.stderr, /previous verified version/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
