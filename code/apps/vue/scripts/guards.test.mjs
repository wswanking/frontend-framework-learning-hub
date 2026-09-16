import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
// Test fixtures stay in this project's ignored report directory.
function fixture() {
  const parent = resolve('reports/guard-fixtures');
  mkdirSync(parent, { recursive: true });
  const dir = mkdtempSync(join(parent, 'case-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ private: true }));
  return dir;
}
const checker = resolve('scripts/check-boundaries.mjs');
test('rejects cross-project source and resources', () => {
  const dir = fixture();
  writeFileSync(join(dir, 'src/bad.ts'), "import value from '../../sibling/module';");
  writeFileSync(join(dir, 'src/bad.css'), 'div { background: url(../../sibling/image.png); }');
  const result = spawnSync(process.execPath, [checker], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Outside import/);
  assert.match(result.stderr, /Outside resource/);
});
test('rejects undeclared or parent-only dependencies', () => {
  const dir = fixture();
  writeFileSync(join(dir, 'src/bad.ts'), "import { x } from 'unlisted-package';");
  const result = spawnSync(process.execPath, [checker], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Undeclared dependency/);
});
test('accepts local source without outside dependencies', () => {
  const dir = fixture();
  writeFileSync(join(dir, 'src/good.ts'), "import { x } from './local';");
  assert.equal(spawnSync(process.execPath, [checker], { cwd: dir }).status, 0);
});
test('unreviewed visual baseline fails closed before launching browsers', () => {
  const dir = fixture();
  mkdirSync(join(dir, 'tests/visual'), { recursive: true });
  mkdirSync(join(dir, 'scripts'));
  writeFileSync(join(dir, 'tests/visual/baseline-review.json'), '{"platforms":{}}');
  copyFileSync(resolve('scripts/visual.mjs'), join(dir, 'scripts/visual.mjs'));
  const result = spawnSync(process.execPath, ['scripts/visual.mjs', 'check'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /VISUAL_PENDING/);
});
