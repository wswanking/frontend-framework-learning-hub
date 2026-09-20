import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputs = { react: 'code/apps/react/dist', vue: 'code/apps/vue/dist', angular: 'code/apps/angular/dist/diagnostics/browser' };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Build output contains an unsupported entry: ${path}`);
  }
  return files.sort();
}

async function collect() {
  const reportRoot = join(root, 'reports');
  await mkdir(reportRoot, { recursive: true });
  const destination = await mkdtemp(join(reportRoot, 'build-candidate-'));
  const apps = {};
  for (const [framework, source] of Object.entries(outputs)) {
    const from = join(root, source);
    const paths = await filesUnder(from);
    if (!paths.some(path => relative(from, path) === 'index.html') || !paths.length) throw new Error(`${framework} has no complete build output`);
    const files = {};
    for (const path of paths) {
      const name = relative(from, path).replaceAll('\\', '/');
      const target = join(destination, 'apps', framework, name);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(path, target);
      const bytes = await readFile(target);
      files[name] = { sha256: digest(bytes), bytes: bytes.length };
    }
    apps[framework] = { source, files };
  }
  const manifest = {
    schema: 'iot-atlas-build-candidate-v1',
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    generatedAt: new Date().toISOString(),
    apps,
    scope: 'Independent build artifacts only; not a deployed preview, review approval, or release acceptance',
  };
  await writeFile(join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await verify(destination);
  console.log(`Build candidate: ${destination} (${Object.values(apps).map(app => Object.keys(app.files).length).join('/')} files)`);
}

async function verify(destination) {
  const manifest = JSON.parse(await readFile(join(destination, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 'iot-atlas-build-candidate-v1' || !/^[0-9a-f]{40}$/.test(manifest.commit) || Object.keys(manifest.apps ?? {}).sort().join(',') !== 'angular,react,vue') throw new Error('Invalid candidate manifest');
  for (const framework of Object.keys(outputs)) {
    const directory = join(destination, 'apps', framework);
    const listed = (await filesUnder(directory)).map(path => relative(directory, path).replaceAll('\\', '/')).sort();
    const expected = Object.keys(manifest.apps[framework].files ?? {}).sort();
    if (listed.join('\n') !== expected.join('\n') || !listed.includes('index.html')) throw new Error(`${framework} candidate file list mismatch`);
    for (const name of listed) {
      const bytes = await readFile(join(directory, name));
      const recorded = manifest.apps[framework].files[name];
      if (digest(bytes) !== recorded.sha256 || bytes.length !== recorded.bytes) throw new Error(`${framework} candidate hash mismatch: ${name}`);
    }
  }
  console.log(`Verified candidate: ${destination}`);
}

if (process.argv[2] === 'verify' && process.argv[3]) await verify(resolve(process.argv[3]));
else if (process.argv.length === 2) await collect();
else throw new Error('Usage: node tools/collect-build-artifacts.mjs [verify <candidate-directory>]');
