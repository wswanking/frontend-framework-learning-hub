import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// IOT-DOMAIN-001: outer orchestration compares DTOs exported independently by each app.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apps = ['react', 'vue', 'angular'];
const version = process.versions.node.split('.').map(Number);
if (version[0] !== 24 || version[1] < 15) throw new Error('Use Node 24.15+ for the three app toolchains');

function run(app) {
  return new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd run test:parity'] : ['run', 'test:parity'];
    const child = spawn(command, args, { cwd: join(root, 'code', 'apps', app), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve({ app, output }) : reject(new Error(`${app} parity export failed (${code}):\n${output}`)));
  });
}
function mismatch(a, b, path = '$') {
  if (isDeepStrictEqual(a, b)) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}.length: ${a.length} versus ${b.length}`;
    for (let i = 0; i < a.length; i++) { const found = mismatch(a[i], b[i], `${path}[${i}]`); if (found) return found; }
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const key of keys) { const found = mismatch(a[key], b[key], `${path}.${key}`); if (found) return found; }
  }
  return `${path}: ${JSON.stringify(a)} versus ${JSON.stringify(b)}`;
}

await Promise.all(apps.map(run));
const reports = Object.fromEntries(await Promise.all(apps.map(async app => [app, JSON.parse(await readFile(join(root, 'code', 'apps', app, 'reports', 'contract-parity.json'), 'utf8'))])));
for (const app of apps.slice(1)) {
  const found = mismatch(reports.react, reports[app]);
  if (found) throw new Error(`IOT-DOMAIN-001 React/${app} DTO mismatch at ${found}`);
}
function scenarioPaths(value, path = '') {
  if (value && typeof value === 'object' && ('data' in value || 'error' in value)) return [path];
  return Object.entries(value).flatMap(([key, nested]) => scenarioPaths(nested, path ? `${path}.${key}` : key));
}
const scenarios = scenarioPaths(reports.react);
const digest = createHash('sha256').update(JSON.stringify(reports.react)).digest('hex');
process.stdout.write(`IOT-DOMAIN-001 parity passed: ${apps.join(', ')}; ${scenarios.length} exact DTO/error scenarios; sha256 ${digest}\n${scenarios.join(', ')}\n`);
