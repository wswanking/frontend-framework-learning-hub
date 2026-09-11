import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cwd = fileURLToPath(new URL("..", import.meta.url));
const run = (mode, file) => spawnSync(process.execPath, ["scripts/release-gate.mjs", mode, file], { cwd, encoding: "utf8" });

test("preview record is traceable and passes the release gate", () => {
  const result = run("preview", "../docs/releases/PREVIEW-2026-09-11.json");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /accepted/);
});

test("production candidate is rejected without human approval and rollback baseline", () => {
  const result = run("production", "../docs/releases/PRODUCTION-CANDIDATE.json");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /REVIEW-005/);
  assert.match(result.stderr, /release owner/);
  assert.match(result.stderr, /previous verified version/);
});
