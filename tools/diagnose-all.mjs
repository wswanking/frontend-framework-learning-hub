import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const task = process.argv[2] ?? 'diagnose';
if (!['diagnose', 'build', 'test:e2e', 'visual:capture', 'test:visual', 'verify', 'parity'].includes(task)) throw new Error('Unsupported task');
if (task === 'parity') {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-contract-parity.mjs', import.meta.url))], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} else {
  let failed = false;
  for (const framework of ['react', 'vue', 'angular']) {
    console.log(`\n[${framework}] ${task}`);
    const cwd = fileURLToPath(new URL(`../code/apps/${framework}/`, import.meta.url));
    const result = process.platform === 'win32'
      ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${task}`], { cwd, stdio: 'inherit' })
      : spawnSync('npm', ['run', task], { cwd, stdio: 'inherit' });
    if (result.status !== 0) { failed = true; console.error(`${framework}: failed (${result.status ?? result.error?.message})`); }
  }
  if (!failed && (task === 'diagnose' || task === 'verify')) {
    console.log('\n[cross-framework] IOT-DOMAIN-001 parity');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-contract-parity.mjs', import.meta.url))], { stdio: 'inherit' });
    if (result.status !== 0) { failed = true; console.error(`cross-framework parity: failed (${result.status ?? result.error?.message})`); }
  }
  if (!failed && task === 'build') {
    console.log('\n[build candidate] collect independent app artifacts');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./collect-build-artifacts.mjs', import.meta.url))], { stdio: 'inherit' });
    if (result.status !== 0) { failed = true; console.error(`build candidate: failed (${result.status ?? result.error?.message})`); }
  }
  process.exitCode = failed ? 1 : 0;
}
