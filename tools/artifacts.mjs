import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
export const repository = fileURLToPath(new URL('../', import.meta.url));
export const frameworks = ['react', 'vue', 'angular'];
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const outputPath = app => app === 'angular' ? 'dist/diagnostics/browser' : 'dist';
const excluded = new Set(['node_modules', 'dist', 'reports', '.angular', 'coverage', '.git']);
export async function inventory(root, source = false, prefix = '') {
  const result = {};
  for (const item of (await readdir(join(root, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const name = prefix ? `${prefix}/${item.name}` : item.name;
    if (source && (excluded.has(item.name) || name === 'public/source')) continue;
    if (item.isDirectory()) Object.assign(result, await inventory(root, source, name));
    else if (item.isFile()) { const bytes = await readFile(join(root, name)); result[name] = { sha256: sha256(bytes), bytes: bytes.length }; }
    else throw new Error(`Unsupported symlink or special file: ${name}`);
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, 'en')));
}
const same = (actual, expected, label) => { if (!isDeepStrictEqual(actual, expected)) throw new Error(`${label} changed or does not match`); };
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function origin(repo) {
  const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const status = git(['status', '--porcelain', '--untracked-files=normal']);
  return { commit: git(['rev-parse', 'HEAD']), dirty: !!status, statusSha256: sha256(status) };
}
export function junitSummary(xml) {
  const tag = xml.match(/<testsuites\b[^>]*>/)?.[0];
  const count = key => { const value = tag?.match(new RegExp(`\\b${key}="(\\d+)"`))?.[1]; return key === 'skipped' && value === undefined ? 0 : Number(value); };
  const result = Object.fromEntries(['tests', 'failures', 'errors', 'skipped'].map(key => [key, count(key)]));
  if (!tag || Object.values(result).some(n => !Number.isInteger(n) || n < 0) || !result.tests || result.failures || result.errors || result.skipped || /<(failure|error|skipped)\b/.test(xml) || (xml.match(/<testcase\b/g) ?? []).length !== result.tests || !xml.includes('</testsuites>')) throw new Error('JUnit must contain complete, nonempty, passing tests without skips');
  return result;
}
function listedTests(appRoot) {
  const data = JSON.parse(execFileSync(process.execPath, [join(appRoot, 'node_modules/playwright/cli.js'), 'test', '--list', '--reporter=json'], { cwd: appRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  const count = suite => (suite.specs ?? []).reduce((n, spec) => n + spec.tests.length, 0) + (suite.suites ?? []).reduce((n, child) => n + count(child), 0);
  const total = data.suites.reduce((n, suite) => n + count(suite), 0);
  if (!Number.isInteger(total) || total < 1) throw new Error('Empty browser test list');
  return total;
}
async function copyInventory(from, to, files) {
  for (const name of Object.keys(files)) {
    if (name.startsWith('/') || name.split('/').some(part => part === '..' || part === '') || name.includes('\\')) throw new Error('Unsafe artifact path');
    const target = join(to, name); await mkdir(dirname(target), { recursive: true }); await copyFile(join(from, name), target);
  }
}
async function freshDirectory(destination) { await mkdir(dirname(destination), { recursive: true }); await mkdir(destination); }
export async function snapshot(framework, appRoot, destination, repo = repository) {
  if (!frameworks.includes(framework)) throw new Error('Unknown framework');
  appRoot = resolve(appRoot); destination = resolve(destination);
  const inputs = await inventory(appRoot, true);
  same(inputs, await inventory(join(repo, 'code/apps', framework), true), 'Isolated app source');
  const files = await inventory(join(appRoot, outputPath(framework)));
  if (!files['index.html'] || !inputs['package-lock.json']) throw new Error('Missing build entry or lockfile');
  const unit = await readFile(join(appRoot, 'reports/unit.xml'), 'utf8');
  let previousBrowserHash = null;
  try { previousBrowserHash = sha256(await readFile(join(appRoot, 'reports/e2e.xml'))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const manifest = { schema: 'iot-atlas-tested-app-v2', phase: 'built-unverified', framework, origin: origin(repo),
    createdAt: new Date().toISOString(), runId: randomUUID(), toolchain: { node: process.versions.node, npm: execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], { encoding: 'utf8' }).trim(), platform: process.platform, arch: process.arch },
    sourceSha256: sha256(JSON.stringify(inputs)), lockSha256: inputs['package-lock.json'].sha256,
    files, distSha256: sha256(JSON.stringify(files)), expectedBrowserTests: listedTests(appRoot), unitTests: junitSummary(unit), unitReportSha256: sha256(unit), previousBrowserHash };
  await freshDirectory(destination); await writeFile(join(destination, 'snapshot.json'), json(manifest));
  return manifest;
}
export async function seal(appRoot, destination, repo = repository) {
  const before = await readJson(join(destination, 'snapshot.json'));
  if (before.phase !== 'built-unverified' || !frameworks.includes(before.framework)) throw new Error('Invalid snapshot');
  same(origin(repo), before.origin, 'Source Git state');
  same(sha256(JSON.stringify(await inventory(appRoot, true))), before.sourceSha256, 'Source inputs');
  same(await inventory(join(appRoot, outputPath(before.framework))), before.files, 'Tested build');
  const unit = await readFile(join(appRoot, 'reports/unit.xml')); same(sha256(unit), before.unitReportSha256, 'Unit evidence');
  const report = join(appRoot, 'reports/e2e.xml'); const browser = await readFile(report, 'utf8');
  if ((await stat(report)).mtimeMs < Date.parse(before.createdAt) || sha256(browser) === before.previousBrowserHash) throw new Error('Stale browser evidence');
  const browserTests = junitSummary(browser);
  if (browserTests.tests !== before.expectedBrowserTests) throw new Error('Partial browser suite');
  const manifest = { ...before, phase: 'browser-tested', testedAt: new Date().toISOString(), browserTests, evidence: {} };
  await mkdir(join(destination, 'site'));
  await copyInventory(join(appRoot, outputPath(before.framework)), join(destination, 'site'), before.files);
  for (const name of ['unit.xml', 'e2e.xml', 'contract-parity.json']) {
    const bytes = await readFile(join(appRoot, 'reports', name)); manifest.evidence[name] = sha256(bytes);
    await mkdir(join(destination, 'evidence'), { recursive: true }); await writeFile(join(destination, 'evidence', name), bytes);
  }
  await writeFile(join(destination, 'manifest.json'), json(manifest));
  await verifyPackage(destination); return manifest;
}
function validateApp(manifest) {
  if (manifest.schema !== 'iot-atlas-tested-app-v2' || manifest.phase !== 'browser-tested' || !frameworks.includes(manifest.framework) || !/^[a-f0-9]{40}$/.test(manifest.origin?.commit) || typeof manifest.origin.dirty !== 'boolean' || !validHash(manifest.origin.statusSha256) || !validHash(manifest.lockSha256) || !validHash(manifest.sourceSha256)) throw new Error('Invalid tested-app manifest');
  if (!Number.isInteger(manifest.expectedBrowserTests) || manifest.expectedBrowserTests < 1 || !validHash(manifest.distSha256) || !manifest.toolchain?.node || !manifest.toolchain?.npm) throw new Error('Invalid build provenance');
}
export async function verifyPackage(directory) {
  const manifest = await readJson(join(directory, 'manifest.json')); validateApp(manifest);
  const files = await inventory(join(directory, 'site'));
  if (!files['index.html']) throw new Error('Missing index');
  same(files, manifest.files, 'Packaged build'); same(sha256(JSON.stringify(files)), manifest.distSha256, 'Build digest');
  const names = ['contract-parity.json', 'e2e.xml', 'unit.xml'];
  same(Object.keys(manifest.evidence).sort(), names, 'Evidence list');
  for (const name of names) same(sha256(await readFile(join(directory, 'evidence', name))), manifest.evidence[name], name);
  const summary = junitSummary(await readFile(join(directory, 'evidence/e2e.xml'), 'utf8'));
  same(summary, manifest.browserTests, 'Browser counts');
  if (summary.tests !== manifest.expectedBrowserTests) throw new Error('Partial browser suite');
  same(junitSummary(await readFile(join(directory, 'evidence/unit.xml'), 'utf8')), manifest.unitTests, 'Unit counts');
  return manifest;
}
export async function assemble(packages, destination) {
  const manifests = await Promise.all(packages.map(verifyPackage));
  same(manifests.map(m => m.framework).sort(), [...frameworks].sort(), 'Three independent packages');
  for (const m of manifests) { same(m.origin, manifests[0].origin, 'Candidate source'); same(m.toolchain, manifests[0].toolchain, 'Candidate toolchain'); }
  const contracts = await Promise.all(packages.map(p => readJson(join(p, 'evidence/contract-parity.json'))));
  for (const contract of contracts) same(contract, contracts[0], 'Domain parity');
  await freshDirectory(destination);
  const manifest = { schema: 'iot-atlas-tested-candidate-v2', origin: manifests[0].origin, createdAt: new Date().toISOString(), apps: {}, contractSha256: sha256(JSON.stringify(contracts[0])), scope: 'Same browser-tested bytes; no visual approval, external deployment or release acceptance' };
  for (let i = 0; i < packages.length; i++) {
    const m = manifests[i]; manifest.apps[m.framework] = m;
    await copyInventory(join(packages[i], 'site'), join(destination, 'apps', m.framework), m.files);
    await copyInventory(join(packages[i], 'evidence'), join(destination, 'evidence', m.framework), await inventory(join(packages[i], 'evidence')));
  }
  await writeFile(join(destination, 'manifest.json'), json(manifest)); await verifyCandidate(destination); return manifest;
}
export async function verifyCandidate(directory) {
  const manifest = await readJson(join(directory, 'manifest.json'));
  if (manifest.schema !== 'iot-atlas-tested-candidate-v2') throw new Error('Not a tested candidate');
  same(Object.keys(manifest.apps).sort(), [...frameworks].sort(), 'Candidate applications');
  for (const framework of frameworks) {
    const app = manifest.apps[framework]; validateApp(app);
    if (app.phase !== 'browser-tested' || app.framework !== framework) throw new Error('Untested app');
    same(app.origin, manifest.origin, 'Candidate origin');
    same(app.toolchain, manifest.apps.react.toolchain, 'Candidate toolchain');
    const files = await inventory(join(directory, 'apps', framework));
    if (!files['index.html']) throw new Error('Missing entry');
    same(files, app.files, `${framework} files`); same(sha256(JSON.stringify(files)), app.distSha256, `${framework} digest`);
    for (const name of ['unit.xml', 'e2e.xml', 'contract-parity.json']) same(sha256(await readFile(join(directory, 'evidence', framework, name))), app.evidence[name], `${framework} evidence`);
    same(junitSummary(await readFile(join(directory, 'evidence', framework, 'e2e.xml'), 'utf8')), app.browserTests, 'Browser summary');
    if (app.browserTests.tests !== app.expectedBrowserTests) throw new Error('Partial suite');
    same(junitSummary(await readFile(join(directory, 'evidence', framework, 'unit.xml'), 'utf8')), app.unitTests, 'Unit summary');
    const contract = await readJson(join(directory, 'evidence', framework, 'contract-parity.json'));
    same(sha256(JSON.stringify(contract)), manifest.contractSha256, 'Contract parity');
  }
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, ...args] = process.argv.slice(2);
  if (action === 'snapshot' && args.length === 3) await snapshot(...args);
  else if (action === 'seal' && args.length === 2) await seal(...args);
  else if (action === 'assemble' && args.length === 4) await assemble(args.slice(1), args[0]);
  else if (action === 'verify' && args.length === 1) await verifyCandidate(args[0]);
  else throw new Error('Usage: artifacts.mjs snapshot <framework> <app-root> <new-package-dir> | seal <app-root> <package-dir> | assemble <new-candidate-dir> <react-package> <vue-package> <angular-package> | verify <candidate-dir>');
  console.log(`Artifacts ${action}: passed`);
}
