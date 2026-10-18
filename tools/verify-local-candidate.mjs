import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSite } from './static-site.mjs';
import { frameworks, repository, verifyCandidate } from './artifacts.mjs';
const [candidateArg, reportArg, appParentArg = join(repository, 'code/apps'), onlyFramework] = process.argv.slice(2);
if (!candidateArg || !reportArg) throw new Error('Usage: verify-local-candidate.mjs <candidate> <new-report-directory> [independent-app-parent]');
const candidate = resolve(candidateArg), report = resolve(reportArg), appParent = resolve(appParentArg);
const manifest = await verifyCandidate(candidate); await mkdir(report, { recursive: true });
const result = { origin: manifest.origin, scope: 'Local independent root-site smoke, not visual approval or remote deployment', browser: null, apps: {} };
if (!onlyFramework) {
  for (const framework of frameworks) {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [process.argv[1], candidate, report, appParent, framework], { stdio: 'inherit', env: process.env });
      child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`${framework} static hosting smoke failed (${code})`)));
    });
    const checked = JSON.parse(await readFile(join(report, `local-hosting-${framework}.json`), 'utf8'));
    result.apps[framework] = checked.apps[framework]; result.browser = checked.browser;
  }
  await verifyCandidate(candidate);
  await writeFile(join(report, 'local-hosting.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
if (!frameworks.includes(onlyFramework)) throw new Error('Unknown framework');
for (const framework of [onlyFramework]) {
  const server = await createSite(join(candidate, 'apps', framework));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    const { chromium, expect } = await import(pathToFileURL(join(appParent, framework, 'node_modules/@playwright/test/index.mjs')));
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    result.browser = { executable: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? 'Playwright bundled Chromium', version: browser.version() };
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
    const failures = []; page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failures.push(`${response.status()} ${response.url()}`); });
    const query = '/devices?productId=prod_as_001&status=online&pageSize=2&page=2';
    const response = await page.goto(url + query); assert.equal(response.status(), 200);
    await expect(page.locator('.product-pager')).toContainText('2 /');
    await page.locator('.device-list tbody tr').first().getByRole('button').click();
    const panel = page.getByRole('dialog', { name: '设备详情', exact: true });
    await expect(panel.getByLabel('编辑设备名称')).not.toHaveValue('');
    const detailUrl = page.url(); await page.reload(); await expect(panel.getByLabel('编辑设备名称')).not.toHaveValue('');
    assert.equal(page.url(), detailUrl);
    await panel.getByRole('button', { name: '关闭设备详情' }).click();
    await expect(page.locator('.product-pager')).toContainText('2 /');
    await page.evaluate(() => { window.__atlasStaticSmoke = true; });
    await page.locator('.atlas-sidebar').getByRole('link', { name: '数据大盘', exact: true }).click();
    await expect(page).toHaveURL(/dashboard/); assert.equal(await page.evaluate(() => window.__atlasStaticSmoke), true);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
    await page.goto(url + '/unknown-local-route'); await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
    await page.screenshot({ path: join(report, `${framework}-unknown-route.png`) });
    const missing = await fetch(url + '/assets/missing.js', { headers: { accept: 'text/html' } }); assert.equal(missing.status, 404);
    assert.equal((await fetch(url + '/')).headers.get('cache-control'), 'no-cache');
    const asset = Object.keys(manifest.apps[framework].files).find(name => /-[A-Za-z0-9_-]{8}\.js$/.test(name)); assert.ok(asset);
    assert.match((await fetch(url + '/' + asset)).headers.get('cache-control'), /immutable/);
    assert.deepEqual(failures, []);
    result.apps[framework] = { status: 'passed', detailDeepLinkRefresh: true, clientNavigation: true, unknownRoute: true, missingAsset404: true, cachePolicy: true, distSha256: manifest.apps[framework].distSha256 };
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
await verifyCandidate(candidate);
await writeFile(join(report, `local-hosting-${onlyFramework}.json`), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
