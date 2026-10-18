import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshot, seal, assemble, verifyCandidate, verifyPackage, inventory, junitSummary, sha256 } from '../artifacts.mjs';
const xml = (count = 2, suffix = '') => `<testsuites tests="${count}" failures="0" errors="0" skipped="0">${'<testcase name="a"/>'.repeat(count)}${suffix}</testsuites>`;
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'atlas-artifacts-')); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, '.gitignore'), '**/node_modules/\n**/dist/\n**/reports/\n');
  for (const app of ['react', 'vue', 'angular']) {
    const dir = join(root, 'code/apps', app); const out = join(dir, app === 'angular' ? 'dist/diagnostics/browser' : 'dist');
    await mkdir(out, { recursive: true }); await mkdir(join(dir, 'reports')); await mkdir(join(dir, 'node_modules/playwright'), { recursive: true });
    await writeFile(join(dir, 'package-lock.json'), '{"lockfileVersion":3}'); await writeFile(join(dir, 'package.json'), '{"private":true}');
    await writeFile(join(out, 'index.html'), '<html>fixture</html>'); await writeFile(join(out, 'main-1234abcd.js'), 'console.log(1)');
    await writeFile(join(dir, 'reports/unit.xml'), xml()); await writeFile(join(dir, 'reports/contract-parity.json'), '{"device":{"data":{"id":"one"}}}');
    await writeFile(join(dir, 'node_modules/playwright/cli.js'), 'console.log(JSON.stringify({suites:[{specs:[{tests:[{},{}]}]}]}))');
  }
  execFileSync('git', ['init', '-q'], { cwd: root }); execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'], { cwd: root });
  const pack = async app => {
    const dir = join(root, 'code/apps', app), dest = join(root, 'reports', app);
    const before = await snapshot(app, dir, dest, root); await writeFile(join(dir, 'reports/e2e.xml'), xml());
    await seal(dir, dest, root); return { dir, dest, before };
  };
  return { root, pack };
}
test('same tested bytes assemble with commit, clean state, locks and parity; tampering fails', async t => {
  const { root, pack } = await fixture(t); const packages = [];
  for (const app of ['react', 'vue', 'angular']) packages.push((await pack(app)).dest);
  const candidate = join(root, 'reports/candidate'); const result = await assemble(packages, candidate);
  assert.equal(result.origin.dirty, false); assert.match(result.apps.react.lockSha256, /^[a-f0-9]{64}$/);
  await verifyCandidate(candidate);
  await writeFile(join(candidate, 'apps/vue/main-1234abcd.js'), 'tampered');
  await assert.rejects(verifyCandidate(candidate), /files/);
});
test('build modified after snapshot cannot be sealed', async t => {
  const { root } = await fixture(t), dir = join(root, 'code/apps/react'), dest = join(root, 'reports/react');
  await snapshot('react', dir, dest, root); await writeFile(join(dir, 'reports/e2e.xml'), xml());
  await writeFile(join(dir, 'dist/index.html'), 'rebuilt'); await assert.rejects(seal(dir, dest, root), /Tested build/);
});
test('partial, failed and stale browser evidence are rejected', async t => {
  const { root } = await fixture(t), dir = join(root, 'code/apps/react'), dest = join(root, 'reports/react');
  await writeFile(join(dir, 'reports/e2e.xml'), xml()); await snapshot('react', dir, dest, root);
  await assert.rejects(seal(dir, dest, root), /Stale/);
  await writeFile(join(dir, 'reports/e2e.xml'), xml(1)); await assert.rejects(seal(dir, dest, root), /Partial/);
  await writeFile(join(dir, 'reports/e2e.xml'), xml(2, '<failure/>')); await assert.rejects(seal(dir, dest, root), /JUnit/);
});
test('dirty state is explicit; independent copy drift is rejected', async t => {
  const { root } = await fixture(t), dir = join(root, 'code/apps/react');
  await writeFile(join(dir, 'package.json'), '{"private":true,"description":"dirty"}');
  const manifest = await snapshot('react', dir, join(root, 'reports/dirty'), root); assert.equal(manifest.origin.dirty, true);
  const other = join(root, 'reports/copy'); await mkdir(other, { recursive: true }); await writeFile(join(other, 'package-lock.json'), '{}');
  await assert.rejects(snapshot('react', other, join(root, 'reports/bad'), root), /source/);
});
test('mixing source provenance, altered evidence or mismatched domain exports fails', async t => {
  const { root, pack } = await fixture(t); const packages = [];
  for (const app of ['react', 'vue', 'angular']) packages.push((await pack(app)).dest);
  const path = join(packages[1], 'manifest.json'); const m = JSON.parse(await readFile(path, 'utf8'));
  m.origin.commit = 'f'.repeat(40); await writeFile(path, JSON.stringify(m));
  await assert.rejects(assemble(packages, join(root, 'reports/bad')), /Candidate source/);
  m.origin.commit = JSON.parse(await readFile(join(packages[0], 'manifest.json'), 'utf8')).origin.commit;
  const changedContract = '{"different":true}'; m.evidence['contract-parity.json'] = sha256(changedContract);
  await writeFile(path, JSON.stringify(m)); await writeFile(join(packages[1], 'evidence/contract-parity.json'), changedContract);
  await assert.rejects(assemble(packages, join(root, 'reports/parity-bad')), /Domain parity/);
  await writeFile(join(packages[0], 'evidence/e2e.xml'), xml(1)); await assert.rejects(verifyPackage(packages[0]), /e2e.xml/);
});
test('extra files and output symlinks are not silently shipped', async t => {
  const { root, pack } = await fixture(t); const { dest } = await pack('react');
  await writeFile(join(dest, 'site/unlisted.txt'), 'surprise'); await assert.rejects(verifyPackage(dest), /Packaged build/);
  const links = join(root, 'reports/links'); await mkdir(links); await symlink(join(root, '.gitignore'), join(links, 'outside'));
  await assert.rejects(inventory(links), /symlink/);
});
test('JUnit accepts Vitest root without optional skipped count', () => { assert.equal(junitSummary(xml().replace(' skipped="0"', '')).skipped, 0); });
test('JUnit rejects empty counts, skipped cases and mismatched case totals', () => {
  for (const input of [xml(0), xml(2, '<skipped/>'), xml(2).replace('tests="2"','tests="3"'), '<testsuites/>']) assert.throws(() => junitSummary(input));
});
