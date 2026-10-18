import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { request } from 'node:http';
import { createSite } from '../static-site.mjs';
async function site(t, base = '/') {
  const parent = await mkdtemp(join(tmpdir(), 'atlas-site-')), dir = join(parent, 'site'); await mkdir(join(dir, 'assets'), { recursive: true });
  await writeFile(join(dir, 'index.html'), '<html>SPA entry</html>'); await writeFile(join(dir, 'assets/main-1234abcd.js'), 'console.log(1)'); await writeFile(join(dir, 'config.json'), '{"api":"public"}');
  await writeFile(join(parent, 'secret.txt'), 'must not escape'); await symlink(join(parent, 'secret.txt'), join(dir, 'secret.txt'));
  const server = await createSite(dir, base); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(parent, { recursive: true, force: true }); });
  return { server, url: `http://127.0.0.1:${server.address().port}`, dir };
}
test('deep links return HTML only for document requests; missing assets really 404', async t => {
  const { url } = await site(t);
  const deep = await fetch(`${url}/devices?device=dev_as_001`, { headers: { accept: 'text/html' } });
  assert.equal(deep.status, 200); assert.match(await deep.text(), /SPA entry/); assert.equal(deep.headers.get('cache-control'), 'no-cache');
  for (const path of ['/assets/missing.js','/assets/missing','/missing.css','/missing.json','/source/missing']) {
    const res = await fetch(url + path, { headers: { accept: 'text/html' } }); assert.equal(res.status, 404, path); assert.doesNotMatch(await res.text(), /SPA/);
  }
  assert.equal((await fetch(url + '/unknown', { headers: { accept: '*/*' } })).status, 404);
});
test('hashed assets are immutable, config is revalidated; ETag and HEAD work', async t => {
  const { url } = await site(t); const asset = await fetch(url + '/assets/main-1234abcd.js');
  assert.match(asset.headers.get('cache-control'), /immutable/); assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(url + '/config.json')).headers.get('cache-control'), 'no-cache');
  assert.equal((await fetch(url + '/assets/main-1234abcd.js', { headers: { 'if-none-match': asset.headers.get('etag') } })).status, 304);
  const head = await fetch(url + '/', { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal((await fetch(url + '/', { method: 'POST' })).status, 405);
});
test('encoded traversal and escaping symlinks cannot expose files', async t => {
  const { url } = await site(t);
  assert.equal((await fetch(url + '/secret.txt')).status, 403);
  const status = await new Promise((resolve, reject) => { const req = request(url, { path: '/%2e%2e/secret.txt' }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end(); });
  assert.equal(status, 403);
});
test('configured prefix is explicit, outside requests fail, and separate release roots can be restarted', async t => {
  const { url, dir } = await site(t, '/react/');
  assert.equal((await fetch(url + '/devices', { headers: { accept: 'text/html' } })).status, 404);
  assert.equal((await fetch(url + '/react/devices', { headers: { accept: 'text/html' } })).status, 200);
  await assert.rejects(createSite(dir, '../'), /Base/);
  const otherRoot = join(dirname(dir), 'release-b'); await mkdir(otherRoot); await writeFile(join(otherRoot, 'index.html'), '<html>release B</html>');
  const candidate = await createSite(otherRoot); await new Promise(resolve => candidate.listen(0, '127.0.0.1', resolve));
  const port = candidate.address().port;
  assert.match(await (await fetch(`http://127.0.0.1:${port}/`)).text(), /release B/);
  await new Promise(resolve => candidate.close(resolve));
  const previous = await createSite(dir); await new Promise(resolve => previous.listen(port, '127.0.0.1', resolve));
  const response = await fetch(`http://127.0.0.1:${previous.address().port}/`); assert.match(await response.text(), /SPA entry/);
  await new Promise(resolve => previous.close(resolve));
});
