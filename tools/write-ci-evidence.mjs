import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const app = process.env.ATLAS_APP;
const checks = ['diagnose', 'browser', 'candidate', 'v2'];
if (!['react', 'vue', 'angular'].includes(app)) throw new Error('ATLAS_APP must name one framework');
if (!/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA ?? '')) throw new Error('Missing Git commit SHA');
for (const check of checks) {
  if (process.env[`ATLAS_${check.toUpperCase()}`] !== 'success') throw new Error(`${check} did not succeed`);
}
if (!['success', 'skipped'].includes(process.env.ATLAS_VISUAL ?? '')) throw new Error('Visual acceptance failed or has unknown status');

const root = resolve(process.cwd());
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function filesUnder(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}
async function hashedFiles(dir) {
  const paths = (await filesUnder(join(root, dir))).sort();
  if (!paths.length) throw new Error(`${dir} is empty`);
  return Object.fromEntries(await Promise.all(paths.map(async (path) => [relative(root, path), digest(await readFile(path))])));
}
function testSummary(xml, label) {
  const rootTag = xml.match(/<testsuites\b[^>]*>/)?.[0];
  if (!rootTag) throw new Error(`${label} has no testsuites root`);
  const field = (name) => Number(rootTag.match(new RegExp(`\\b${name}="(\\d+)"`))?.[1] ?? (name === 'skipped' ? 0 : NaN));
  const result = Object.fromEntries(['tests', 'failures', 'errors', 'skipped'].map((key) => [key, field(key)]));
  if (!Number.isInteger(result.tests) || result.tests < 1 || Object.entries(result).some(([key, value]) => key !== 'tests' && (!Number.isInteger(value) || value < 0))) throw new Error(`${label} has invalid counts`);
  if (result.failures || result.errors || result.skipped) throw new Error(`${label} contains failures or skipped tests`);
  return result;
}

function listedBrowserTests() {
  const listed = spawnSync(process.execPath, [join(root, 'node_modules/playwright/cli.js'), 'test', '--list', '--reporter=json'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (listed.status !== 0) throw new Error(`Cannot enumerate browser tests: ${listed.stderr || listed.error || listed.status}`);
  const suites = JSON.parse(listed.stdout).suites;
  if (!Array.isArray(suites)) throw new Error('Invalid browser test list');
  const count = (suite) => (suite.specs ?? []).reduce((total, spec) => total + spec.tests.length, 0)
    + (suite.suites ?? []).reduce((total, child) => total + count(child), 0);
  return suites.reduce((total, suite) => total + count(suite), 0);
}

const unitXml = await readFile(join(root, 'reports/unit.xml'), 'utf8');
const browserXml = await readFile(join(root, 'reports/e2e.xml'), 'utf8');
const unitTests = testSummary(unitXml, 'unit');
const browserTests = testSummary(browserXml, 'browser');
const expectedBrowserTests = listedBrowserTests();
if (browserTests.tests !== expectedBrowserTests) throw new Error(`Browser report has ${browserTests.tests} tests; current suite has ${expectedBrowserTests}`);
const manifestText = await readFile(join(root, 'reports/v2-candidates/manifest.json'), 'utf8');
const manifest = JSON.parse(manifestText);
if (manifest.framework !== app || manifest.status !== 'candidate-unreviewed' || !Array.isArray(manifest.captures) || manifest.captures.length < 18) throw new Error('Invalid V2 candidate manifest');
for (const capture of manifest.captures) {
  if (!/^[0-9a-f]{64}$/.test(capture.sha256) || !/^(desktop|mobile)\/[\w-]+\.png$/.test(capture.candidate)) throw new Error('Invalid V2 candidate entry');
  const path = join(root, 'reports/v2-candidates', capture.candidate);
  if (digest(await readFile(path)) !== capture.sha256) throw new Error(`V2 candidate hash mismatch: ${capture.candidate}`);
}
const dist = await hashedFiles('dist');
const evidence = {
  schema: 'iot-atlas-ci-diagnostic-v1',
  framework: app,
  commit: process.env.GITHUB_SHA,
  runUrl: process.env.ATLAS_RUN_URL ?? '',
  generatedAt: new Date().toISOString(),
  checks: Object.fromEntries(checks.map((check) => [check, 'success'])),
  visualAcceptance: process.env.ATLAS_VISUAL === 'success' ? 'passed' : 'pending-review',
  tests: { unit: unitTests, browser: browserTests },
  candidateCount: manifest.captures.length,
  hashes: { dist, unitReport: digest(unitXml), browserReport: digest(browserXml), v2Manifest: digest(manifestText) },
  scope: 'diagnostic evidence only; no design, review, deployment, rollback, or final acceptance approval',
};
await writeFile(join(root, 'reports/ci-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`${app}: CI diagnostic evidence for ${evidence.commit}, ${evidence.tests.browser.tests} browser tests, ${evidence.candidateCount} V2 candidates`);
