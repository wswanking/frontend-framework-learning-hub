import { test, expect, type Page } from '@playwright/test';
async function navigate(page: Page, name: string) {
  const toggle = page.getByRole('button', { name: '导航菜单' });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  const link = page.getByRole('complementary', { name: '主导航' }).getByRole('link', { name, exact: true });
  const url = new URL((await link.getAttribute('href'))!, page.url()).href;
  await link.click();
  await expect(page).toHaveURL(url);
}
async function openDevice(page: Page) {
  const trigger = page.locator('.product-table-wrap tbody tr').first().locator('td').nth(1).getByRole('button');
  await expect(trigger).toBeVisible();
  const name = await trigger.innerText();
  await trigger.click();
  await expect(page.getByLabel('编辑设备名称', { exact: true })).toHaveValue(name);
  return trigger;
}
test('IOT-PLATFORM-003 M1 persistent shell, all menus, lazy content and history', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: '全球设备运行态势' })).toBeVisible();
  const shell = await page.getByTestId('app-shell').elementHandle();
  const header = await page.locator('.shell-topbar').elementHandle();
  let documentRequests = 0; page.on('request', request => { if (request.resourceType() === 'document') documentRequests++; });
  await navigate(page, '设备中心');
  const trigger = await openDevice(page);
  await expect(page).toHaveURL(/device=/);
  await page.evaluate(() => window.history.back());
  await expect(page.getByRole('dialog', { name: '设备详情', exact: true })).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.evaluate(() => window.history.forward());
  await expect(page.getByRole('dialog', { name: '设备详情', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭设备详情' }).click();
  for (const name of ['产品与物模型', '实验室', '交付看板', '全球节点', '规则引擎', '固件与 OTA', '租户管理', '数据大盘']) {
    await navigate(page, name);
    await expect(page.locator('.atlas-sidebar nav .active')).toHaveText(name);
    expect(await shell!.evaluate(node => node === document.querySelector('[data-testid="app-shell"]'))).toBe(true);
    expect(await header!.evaluate(node => node === document.querySelector('.shell-topbar'))).toBe(true);
  }
  expect(documentRequests).toBe(0);
  expect(errors).toEqual([]);
});
test('M1 dirty metadata protects Back to unknown route and refresh; discard and focus return', async ({ page }) => {
  await page.goto('/devices/missing-m1');
  await expect(page.locator('.atlas-sidebar nav .active')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
  await navigate(page, '设备中心');
  await openDevice(page);
  const input = page.getByLabel('编辑设备名称', { exact: true });
  await input.fill('未保存设备');
  page.once('dialog', dialog => dialog.dismiss());
  await page.evaluate(() => window.history.back());
  await expect(input).toHaveValue('未保存设备');
  await expect(page).toHaveURL(/device=/);
  page.once('dialog', dialog => dialog.dismiss());
  await page.reload({ timeout: 2000 }).catch(() => undefined);
  await expect(input).toHaveValue('未保存设备');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: '关闭设备详情' }).click();
  await expect(input).toHaveValue('未保存设备');
  await expect(page.getByRole('button', { name: '关闭设备详情' })).toBeFocused();
  page.once('dialog', dialog => dialog.accept());
  await page.evaluate(() => window.history.back());
  await expect(page.getByRole('dialog', { name: '设备详情', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.history.back());
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
});
test('M1 dirty products protect navigation and forward history', async ({ page }) => {
  await page.goto('/products');
  await expect(page.getByRole('button', { name: '新建产品', exact: true })).toBeVisible();
  await navigate(page, '设备中心');
  await page.evaluate(() => window.history.back());
  await page.getByRole('button', { name: '新建产品', exact: true }).click();
  await page.getByLabel('产品名称', { exact: true }).fill('未保存产品');
  page.once('dialog', dialog => dialog.dismiss());
  await page.evaluate(() => window.history.forward());
  await expect(page.getByLabel('产品名称', { exact: true })).toHaveValue('未保存产品');
  // Main navigation remains available on desktop; close confirmation is separately covered by products tests.
  page.once('dialog', dialog => dialog.accept());
  await page.evaluate(() => window.history.forward());
  await expect(page).toHaveURL(/\/devices$/);
});
test('M1 responsive navigation and fixed chrome', async ({ page }, testInfo) => {
  await page.goto('/dashboard');
  await expect(page.locator('.metric-card')).toHaveCount(5);
  await page.screenshot({ path: `reports/visual-candidates/m1-shell-${testInfo.project.name}.png` });
  const toggle = page.getByRole('button', { name: '导航菜单' });
  if (page.viewportSize()!.width <= 800) {
    await expect(page.locator('.atlas-sidebar')).toBeHidden();
    await toggle.click();
    await page.getByRole('link', { name: '设备中心', exact: true }).focus();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(page.locator('.atlas-sidebar')).toBeHidden();
    await navigate(page, '设备中心');
    await expect(page.locator('.atlas-sidebar')).toBeHidden();
    await expect(toggle).toBeFocused();
  } else {
    await expect(page.locator('.atlas-sidebar')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 700));
    expect((await page.locator('.shell-topbar').boundingBox())!.y).toBe(0);
    expect((await page.locator('.atlas-sidebar').boundingBox())!.y).toBe(56);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('M1 dirty unknown destination, route links and clean deep-link reload', async ({ page }) => {
  await page.goto('/devices/missing-m1');
  await expect(page.locator('.atlas-sidebar nav .active')).toHaveCount(0);
  await navigate(page, '产品与物模型');
  await page.getByRole('button', { name: '新建产品', exact: true }).click();
  await page.getByLabel('产品名称', { exact: true }).fill('保留草稿');
  page.once('dialog', dialog => dialog.dismiss());
  await page.evaluate(() => window.history.back());
  await expect(page.getByLabel('产品名称', { exact: true })).toHaveValue('保留草稿');
  await expect(page).toHaveURL(/products$/);
  if (page.viewportSize()!.width > 800) {
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('complementary', { name: '主导航' }).getByRole('link', { name: '交付看板', exact: true }).click();
    await expect(page).toHaveURL(/products$/);
    await expect(page.getByLabel('产品名称', { exact: true })).toHaveValue('保留草稿');
  }
  page.once('dialog', dialog => dialog.accept());
  await page.evaluate(() => window.history.back());
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
  await page.goto('/devices?device=dev_as_001');
  await expect(page.getByLabel('编辑设备名称', { exact: true })).not.toHaveValue('');
  const name = await page.getByLabel('编辑设备名称', { exact: true }).inputValue();
  await page.reload();
  await expect(page.getByLabel('编辑设备名称', { exact: true })).toHaveValue(name);
});

test('M1 React map survives callback changes while country drawer opens', async ({ page }) => {
  await page.goto('/dashboard');
  const map = page.locator('.world-chart');
  await expect(map).toHaveAttribute('_echarts_instance_', /.+/);
  const instance = await map.getAttribute('_echarts_instance_');
  await page.locator('.country-list').getByRole('button', { name: /中国/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(map).toHaveAttribute('_echarts_instance_', instance!);
});

test('M1 saved normalized metadata leaves without confirmation and closed detail stops telemetry', async ({ page }) => {
  await page.goto('/devices?device=dev_as_001');
  await expect(page.getByLabel('编辑设备名称', { exact: true })).not.toHaveValue('');
  await page.getByLabel('编辑设备标签', { exact: true }).fill('  教学标签  , 持久壳层 ');
  await page.getByRole('button', { name: '保存设备信息' }).click();
  await expect(page.getByLabel('编辑设备标签', { exact: true })).toHaveValue('教学标签,持久壳层');
  const prompts: string[] = [];
  page.on('dialog', async dialog => { prompts.push(dialog.message()); await dialog.dismiss(); });
  await page.clock.install();
  await page.getByRole('tab', { name: '时序数据' }).click();
  await page.getByLabel('实时追加').check();
  await page.clock.fastForward(5100);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('iot-atlas-device-messages-v1') || '[]').length)).toBeGreaterThan(0);
  await page.getByRole('button', { name: '关闭设备详情' }).click();
  await expect(page.getByRole('dialog', { name: '设备详情', exact: true })).toHaveCount(0);
  const count = await page.evaluate(() => JSON.parse(localStorage.getItem('iot-atlas-device-messages-v1') || '[]').length);
  await page.clock.fastForward(10_100);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('iot-atlas-device-messages-v1') || '[]').length)).toBe(count);
  expect(prompts).toEqual([]);
});

test('M1 navigation chrome stays mounted while the next route chunk is loading', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('.metric-card')).toHaveCount(5);
  const shell = await page.getByTestId('app-shell').elementHandle();
  let requested = false;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\.js(?:\?.*)?$/, async route => { requested = true; await gate; await route.continue(); });
  const toggle = page.getByRole('button', { name: '导航菜单' });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('complementary', { name: '主导航' }).getByRole('link', { name: '设备中心', exact: true }).click();
  try {
    await expect.poll(() => requested).toBe(true);
    await expect(page.locator('.shell-topbar')).toBeVisible();
    expect(await shell!.evaluate(node => node.isConnected)).toBe(true);
  } finally { release(); }
  await expect(page.getByRole('heading', { name: '设备中心', exact: true })).toBeVisible();
  expect(await shell!.evaluate(node => node === document.querySelector('[data-testid="app-shell"]'))).toBe(true);
});
