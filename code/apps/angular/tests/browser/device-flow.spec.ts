import { expect, test } from '@playwright/test';

test('M2 restores applied filters, pagination and edited detail through URL and history', async ({ page }) => {
  await page.goto('/devices');
  await page.getByLabel('设备产品', { exact: true }).selectOption('prod_as_001');
  await page.getByLabel('设备状态', { exact: true }).selectOption('online');
  await page.getByRole('button', { name: '查询', exact: true }).click();
  await page.getByLabel('每页条数').selectOption('2');
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  const listUrl = page.url();
  const row = page.locator('.device-list tbody tr').first();
  // A committed URL does not mean the asynchronous page of rows has arrived.
  await expect(row.locator('td').nth(2)).toHaveText('dev_oc_001');
  const id = await row.locator('td').nth(2).innerText();
  const name = await row.locator('td').nth(1).innerText();
  await row.getByRole('button').click();
  const panel = page.getByRole('dialog', { name: '设备详情', exact: true });
  await expect(panel.getByLabel('编辑设备名称')).toHaveValue(name);
  await expect(page).toHaveURL(new RegExp(`device=${id}`));
  await panel.getByLabel('编辑设备名称').fill('');
  await panel.getByRole('button', { name: '保存设备信息', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('元数据无效');
  await expect(panel.getByLabel('编辑设备名称')).toHaveValue('');
  await panel.getByLabel('编辑设备名称').fill('M2 已保存设备');
  await panel.getByRole('button', { name: '重试保存', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('设备信息已保存');
  await page.reload();
  await expect(panel.getByLabel('编辑设备名称')).toHaveValue('M2 已保存设备');
  await panel.getByRole('button', { name: '关闭设备详情' }).click();
  await expect(page).toHaveURL(listUrl);
  await expect(page.getByLabel('设备产品', { exact: true })).toHaveValue('prod_as_001');
  await expect(page.getByLabel('设备状态', { exact: true })).toHaveValue('online');
  await expect(page.getByLabel('每页条数')).toHaveValue('2');
  await expect(page.locator('.product-pager')).toContainText('2 /');
  await expect(page.locator('.device-list h2')).toBeFocused();
  await page.goBack();
  await expect(panel.getByLabel('编辑设备名称')).toHaveValue('M2 已保存设备');
  await page.goForward();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(listUrl);
  if (await page.getByRole('button', { name: '导航菜单', exact: true }).isVisible()) await page.getByRole('button', { name: '导航菜单', exact: true }).click();
  await page.locator('.atlas-sidebar').getByRole('link', { name: '数据大盘', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goBack();
  await expect(page).toHaveURL(listUrl);
  await expect(page.locator('.product-pager')).toContainText('2 /');
});

test('M2 distinguishes empty, unavailable and forbidden lists with recoverable feedback', async ({ page }) => {
  await page.goto('/devices?keyword=M2-no-match');
  await expect(page.getByText('当前筛选没有设备。可重置条件后重试。')).toBeVisible();
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(page.locator('.device-list tbody tr')).not.toHaveCount(0);
  await page.locator('.scenario-control summary').click();
  for (const scenario of ['offline', 'forbidden']) {
    await page.getByLabel('Mock 场景').selectOption(scenario);
    await expect(page.locator('.dashboard-feedback [role="alert"]')).toContainText(scenario === 'offline' ? '模拟设备服务暂不可用' : '无权操作设备');
    await expect(page.getByText('当前筛选没有设备。可重置条件后重试。')).toHaveCount(0);
    await page.locator('.dashboard-feedback').getByRole('button', { name: '重试', exact: true }).click();
    await expect(page.locator('.device-list tbody tr')).toHaveCount(0);
  }
  await page.getByLabel('Mock 场景').selectOption('normal');
  await expect(page.locator('.device-list tbody tr')).not.toHaveCount(0);
  await expect(page.locator('.dashboard-feedback [role="alert"]')).toHaveCount(0);
});

test('M2 missing detail reports failure in the drawer and returns to its filtered list', async ({ page }) => {
  await page.goto('/devices?productId=prod_as_001&pageSize=2&page=2&device=missing-m2');
  const panel = page.getByRole('dialog', { name: '设备详情', exact: true });
  await expect(panel.getByRole('alert')).toContainText('设备不存在');
  await expect(panel.getByRole('heading', { name: '设备加载中', exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: '重试详情' }).click();
  await expect(panel.getByRole('alert')).toContainText('设备不存在');
  await panel.getByRole('button', { name: '关闭设备详情' }).click();
  await expect(page).not.toHaveURL(/device=/);
  await expect(page.locator('.product-pager')).toContainText('2 /');
});

test('M2 readonly identity explains metadata permissions without an edit action', async ({ page }) => {
  await page.goto('/devices');
  await page.getByLabel('演示身份').selectOption('viewer');
  await expect(page.getByLabel('设备租户')).toHaveValue('ten_202609_001');
  await page.locator('.device-list tbody tr').first().getByRole('button').click();
  const panel = page.getByRole('dialog', { name: '设备详情', exact: true });
  await expect(panel.getByText('当前身份只读，无权编辑设备元数据。')).toBeVisible();
  await expect(panel.getByLabel('编辑设备名称')).toHaveCount(0);
});

test('M2 Escape protects a dirty draft and restores focus after discard', async ({ page }, info) => {
  await page.goto('/devices?pageSize=2');
  const trigger = page.locator('.device-list tbody tr').first().getByRole('button');
  await trigger.click();
  const panel = page.getByRole('dialog', { name: '设备详情', exact: true });
  await panel.getByLabel('编辑设备名称').fill('M2 未保存');
  const cancelled = page.waitForEvent('dialog').then(dialog => dialog.dismiss());
  await page.keyboard.press('Escape');
  await cancelled;
  await expect(panel.getByLabel('编辑设备名称')).toHaveValue('M2 未保存');
  if (info.project.name === 'mobile') {
    await panel.getByRole('button', { name: '保存设备信息', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(panel.getByRole('button', { name: '关闭设备详情' })).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  }
  const accepted = page.waitForEvent('dialog').then(dialog => dialog.accept());
  await page.keyboard.press('Escape');
  await accepted;
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe('');
});

test('M2 slow detail and save expose pending state and prevent duplicate writes', async ({ page }) => {
  await page.goto('/devices');
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.locator('.scenario-control summary').click();
  await page.getByLabel('Mock 场景').selectOption('slow');
  await page.clock.runFor(20);
  await expect(page.getByRole('status').filter({ hasText: '设备加载中…' })).toBeVisible();
  await page.clock.runFor(100);
  await page.locator('.device-list tbody tr').first().getByRole('button').click();
  await page.clock.runFor(20);
  const panel = page.getByRole('dialog', { name: '设备详情', exact: true });
  await expect(panel.getByRole('status')).toHaveText('详情加载中…');
  await page.clock.runFor(100);
  await panel.getByLabel('编辑设备名称').fill('M2 slow save');
  await panel.getByRole('button', { name: '保存设备信息', exact: true }).click();
  await page.clock.runFor(20);
  await expect(panel.getByRole('button', { name: '保存中…', exact: true })).toBeDisabled();
  await page.clock.runFor(100);
  await expect(panel.getByRole('status')).toHaveText('设备信息已保存');
});

test('M2 version conflicts keep the draft until explicit reload, then allow saving', async ({ page }) => {
  await page.goto('/devices?device=dev_as_001');
  const panel = page.getByRole('dialog', { name: '设备详情', exact: true });
  await panel.getByLabel('编辑设备名称').fill('M2 initial');
  await panel.getByRole('button', { name: '保存设备信息', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('设备信息已保存');
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('iot-atlas-devices-v1')!);
    const device = rows.find((row: { id: string }) => row.id === 'dev_as_001');
    device.version++; device.name = 'M2 concurrent update';
    localStorage.setItem('iot-atlas-devices-v1', JSON.stringify(rows));
  });
  await panel.getByLabel('编辑设备名称').fill('M2 preserved draft');
  await panel.getByRole('button', { name: '保存设备信息', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('设备版本冲突');
  await panel.getByRole('button', { name: '重试保存', exact: true }).click();
  await expect(panel.getByLabel('编辑设备名称')).toHaveValue('M2 preserved draft');
  page.once('dialog', dialog => dialog.dismiss());
  await panel.getByRole('button', { name: '重新加载设备' }).click();
  await expect(panel.getByLabel('编辑设备名称')).toHaveValue('M2 preserved draft');
  page.once('dialog', dialog => dialog.accept());
  await panel.getByRole('button', { name: '重新加载设备' }).click();
  await expect(panel.getByLabel('编辑设备名称')).toHaveValue('M2 concurrent update');
  await panel.getByLabel('编辑设备名称').fill('M2 resolved');
  await panel.getByRole('button', { name: '保存设备信息', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('设备信息已保存');
});

test('M2 history cannot reveal a foreign device after identity changes', async ({ page }) => {
  await page.goto('/devices?device=dev_as_002');
  const panel = page.getByRole('dialog', { name: '设备详情', exact: true });
  await expect(panel.getByLabel('编辑设备名称')).toHaveValue('东京能源网关');
  await panel.getByRole('button', { name: '关闭设备详情' }).click();
  await page.getByLabel('演示身份').selectOption('viewer');
  await expect(page.getByLabel('设备租户')).toHaveValue('ten_202609_001');
  await page.goBack();
  await page.goBack();
  await expect(panel.getByRole('alert')).toContainText('无权访问该租户设备');
  await expect(panel.getByLabel('编辑设备名称')).toHaveCount(0);
  await expect(panel).not.toContainText('东京能源网关');
  await panel.getByRole('button', { name: '重试详情' }).click();
  await expect(panel.getByRole('alert')).toContainText('无权访问该租户设备');
});

test('M2 history closes nested control preview and releases the detail scroll lock', async ({ page }) => {
  await page.goto('/devices');
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByRole('tab', { name: '实时属性' }).click();
  await page.getByLabel('控制命令').selectOption('tm_sampling_interval');
  await page.getByLabel('控制参数').fill('100');
  await page.getByRole('button', { name: '预览命令' }).click();
  await expect(page.getByRole('dialog', { name: '控制预览' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe('');
  await page.goForward();
  await expect(page.getByRole('dialog', { name: '设备详情', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: '控制预览' })).toHaveCount(0);
});

test('M2 full-width tablet detail traps focus and releases it when resized to desktop', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/devices?device=dev_as_001');
  const panel = page.getByRole('dialog', { name: '设备详情', exact: true });
  await expect(panel.getByLabel('编辑设备名称')).not.toHaveValue('');
  await expect(panel).toHaveAttribute('aria-modal', 'true');
  await panel.getByRole('button', { name: '保存设备信息', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('button', { name: '关闭设备详情' })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(panel).toHaveAttribute('aria-modal', 'false');
  await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe('');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});
