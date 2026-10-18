import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { copyFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { assemble, frameworks, inventory, outputPath, repository, seal, snapshot } from './artifacts.mjs';
// Outer orchestration only. Each exported project installs, builds and tests its own code.
const [destinationArg] = process.argv.slice(2);
if (!destinationArg) throw new Error('Usage: validate-local.mjs <new-evidence-directory>');
const destination = resolve(destinationArg); await mkdir(dirname(destination), { recursive: true }); await mkdir(destination, { recursive: false });
const isolated = await mkdtemp(join(tmpdir(), 'atlas-m4-isolated-'));
await writeFile(join(destination, 'isolated-directory.txt'), isolated + '\n');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
async function run(command, args, cwd, log) {
  const stream = createWriteStream(log);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(stream, { end: false }); child.stderr.pipe(stream, { end: false });
    child.on('error', error => { stream.end(); reject(error); });
    child.on('close', code => { stream.end(() => code === 0 ? resolve() : reject(new Error(`${log}: exited ${code}`))); });
  });
}
const outcomes = await Promise.allSettled(frameworks.map(async framework => {
  const app = join(isolated, framework), evidence = join(destination, framework), pack = join(destination, `tested-${framework}`);
  await mkdir(app); await mkdir(evidence);
  const prefix = `code/apps/${framework}/`;
  const tracked = execFileSync('git', ['ls-files', '-z', '--', prefix], { cwd: repository }).toString().split('\0').filter(Boolean);
  for (const name of tracked) { const target = join(app, name.slice(prefix.length)); await mkdir(dirname(target), { recursive: true }); await copyFile(join(repository, name), target); }
  const cache = process.env.ATLAS_NPM_CACHE ? ['--cache', resolve(process.env.ATLAS_NPM_CACHE)] : [];
  await run(npm, ['ci', ...cache], app, join(evidence, 'install.log'));
  await run(npm, ['run', 'diagnose'], app, join(evidence, 'diagnose.log'));
  const first = await inventory(join(app, outputPath(framework)));
  await run(npm, ['run', 'build'], app, join(evidence, 'rebuild.log'));
  const second = await inventory(join(app, outputPath(framework)));
  if (!isDeepStrictEqual(first, second)) throw new Error(`${framework}: second build bytes differ`);
  await writeFile(join(evidence, 'reproducibility.json'), JSON.stringify({ status: 'passed', scope: 'Two successive production builds from one clean install with identical inputs and toolchain; not cross-OS reproducibility', files: Object.keys(first).length }, null, 2) + '\n');
  await snapshot(framework, app, pack);
  await run(npm, ['run', 'test:e2e', '--', '--workers=1'], app, join(evidence, 'browser.log'));
  const manifest = await seal(app, pack);
  console.log(`${framework}: ${manifest.unitTests.tests} unit / ${manifest.browserTests.tests} browser passed; same bytes sealed`);
  return pack;
}));
await writeFile(join(destination, 'outcomes.json'), JSON.stringify(outcomes.map((o, i) => ({ framework: frameworks[i], status: o.status, reason: o.reason?.message })), null, 2) + '\n');
const failures = outcomes.filter(o => o.status === 'rejected');
if (failures.length) throw new AggregateError(failures.map(o => o.reason), 'Independent validation failed; retained evidence');
const candidate = join(destination, 'candidate'); await assemble(outcomes.map(o => o.value), candidate);
await run(process.execPath, [join(repository, 'tools/verify-local-candidate.mjs'), candidate, join(destination, 'hosting'), isolated], repository, join(destination, 'hosting.log'));
console.log(`Same-build local candidate verified: ${candidate}`);
