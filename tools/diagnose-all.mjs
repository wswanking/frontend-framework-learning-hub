import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const task = process.argv[2] ?? 'diagnose';
if (!['diagnose', 'build', 'test:e2e', 'visual:capture', 'test:visual', 'verify'].includes(task)) throw new Error('Unsupported task');
let failed = false;
for (const framework of ['react', 'vue', 'angular']) {
  console.log(`\n[${framework}] ${task}`);
  const cwd = fileURLToPath(new URL(`../code/apps/${framework}/`, import.meta.url));
  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${task}`], { cwd, stdio: 'inherit' })
    : spawnSync('npm', ['run', task], { cwd, stdio: 'inherit' });
  if (result.status !== 0) { failed = true; console.error(`${framework}: failed (${result.status ?? result.error?.message})`); }
}
process.exitCode = failed ? 1 : 0;
