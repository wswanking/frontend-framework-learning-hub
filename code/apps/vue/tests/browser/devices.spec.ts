import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

test('IOT-TENANT-001 warns before device registration enters the quota warning range', async ({ page }) => {
  await page.goto('/devices');
  await page.getByRole('button', { name: '新建设备' }).click();
  const dialog = page.getByRole('dialog', { name: '新建设备' });
  await expect(dialog.getByRole('status')).toContainText('设备配额已用 6/10');
  await dialog.getByLabel('新建设备租户').selectOption('ten_202609_002');
  await expect(dialog.getByRole('status')).toContainText('设备配额已用 6/8；登记后达到 80% 预警阈值');
});

test('IOT-DEVICE-001 keeps create, import and delete confirmation focus inside dialogs', async ({ page }) => {
  await page.goto('/devices');
  const create = page.getByRole('button', { name: '新建设备' });
  await create.click();
  const createDialog = page.getByRole('dialog', { name: '新建设备' });
  await expect(createDialog).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(createDialog.getByRole('button', { name: '取消' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(createDialog).toHaveCount(0);
  await expect(create).toBeFocused();

  const importButton = page.getByRole('button', { name: 'CSV 导入' });
  await importButton.click();
  const importDialog = page.getByRole('dialog', { name: 'CSV 导入设备' });
  await expect(importDialog).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(importDialog.getByLabel('导入租户')).toBeFocused();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.move(10, 800);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await page.keyboard.press('Escape');
  await expect(importDialog).toHaveCount(0);
  await expect(importButton).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe('');

  await page.locator('.device-list tbody tr').first().locator('input[type="checkbox"]').check();
  const remove = page.getByRole('button', { name: '批量删除' });
  await remove.click();
  const deleteDialog = page.getByRole('dialog', { name: '确认删除设备' });
  await expect(deleteDialog).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(deleteDialog.getByRole('button', { name: '取消' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(deleteDialog).toHaveCount(0);
  await expect(remove).toBeFocused();
});

test('IOT-DEVICE-001 shows the empty UTC interval and focuses the range control', async ({ page }) => {
  await page.goto('/devices');
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByRole('tab', { name: '时序数据' }).click();
  await page.getByLabel('时序范围').selectOption('0');
  await page.getByLabel('开始时间（UTC）').fill('2026-08-31T00:00');
  await page.getByLabel('结束时间（UTC）').fill('2026-08-31T02:00');
  await page.getByLabel('结束时间（UTC）').press('Tab');
  const empty = page.getByRole('status').filter({ hasText: '无遥测数据' });
  await expect(empty).toContainText('2026-08-31T00:00:00.000Z 至 2026-08-31T02:00:00.000Z');
  await empty.getByRole('button', { name: '调整时间范围' }).click();
  await expect(page.getByLabel('时序范围')).toBeFocused();
});

test('IOT-DEVICE-001 exports every selected device across pages', async ({ page }) => {
  await page.goto('/devices');
  await page.getByLabel('每页条数').selectOption('2');
  const first = page.locator('.device-list tbody tr').first();
  const firstId = await first.locator('td').nth(2).innerText();
  await first.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: '下一页' }).click();
  const second = page.locator('.device-list tbody tr').first();
  await expect(second.locator('td').nth(2)).not.toHaveText(firstId);
  const secondId = await second.locator('td').nth(2).innerText();
  await second.locator('input[type="checkbox"]').check();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '批量导出 CSV' }).click();
  const csv = await readFile(await (await pending).path(), 'utf8');
  expect(csv.trim().split('\n')).toHaveLength(3);
  expect(csv).toContain(firstId);
  expect(csv).toContain(secondId);
});

test('IOT-DEVICE-001 requeries the UTC window when zooming telemetry', async ({ page }) => {
  await page.goto('/devices');
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByRole('tab', { name: '时序数据' }).click();
  const rows = page.locator('.device-telemetry-table tbody tr');
  await expect(rows).toHaveCount(50);
  await page.getByRole('button', { name: '放大后半段' }).click();
  await expect(rows).toHaveCount(26);
  await expect(rows.first()).toContainText('2026-09-16T00:00:00.000Z');
  await page.getByRole('button', { name: '恢复全范围' }).click();
  await expect(rows).toHaveCount(50);
  await expect(rows.first()).toContainText('2026-09-15T12:00:00.000Z');
});

test('IOT-DEVICE-001 filters, sorts and pages devices before opening detail', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/devices');
  await expect(page.getByRole('heading', { name: '设备中心' })).toBeVisible();
  await expect(page.locator('.device-list h2')).toContainText('共 12 条');
  await page.getByLabel('每页条数').selectOption('2');
  await expect(page.locator('.device-list tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: '下一页' }).click();
  await expect(page.locator('.device-list tbody')).toContainText('悉尼温湿度六号');
  await page.getByLabel('设备产品').selectOption('prod_as_001');
  await page.getByLabel('设备状态').selectOption('online');
  await page.getByRole('button', { name: '查询' }).click();
  await expect(page.locator('.device-list h2')).toContainText('共 4 条');
  await page.getByLabel('搜索设备').fill('上海');
  await page.getByRole('button', { name: '查询' }).click();
  await expect(page.locator('.device-list h2')).toContainText('共 1 条');
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await expect(page.getByRole('dialog', { name: '设备详情' })).toContainText('dev_as_001');
  await expect(page.getByRole('tabpanel')).toContainText('亚洲');
  expect(errors).toEqual([]);
});

test.describe('IOT-DEVICE-001 UTC and custom tag filters', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });

  test('filters imported tags and treats the entered last active minute as UTC', async ({ page }) => {
    await page.goto('/devices');
    await page.getByRole('button', { name: 'CSV 导入' }).click();
    await page.getByLabel('导入 CSV 文件').setInputFiles({ name: 'custom.csv', mimeType: 'text/csv', buffer: Buffer.from('name,region,countryCode,tags\n定制标签设备,AS,CN,定制标签') });
    await page.getByRole('button', { name: '确认导入' }).click();
    await expect(page.locator('.device-list h2')).toContainText('共 13 条');
    await page.getByLabel('设备标签').fill('定制标签');
    await page.getByRole('button', { name: '查询' }).click();
    await expect(page.locator('.device-list h2')).toContainText('共 1 条');
    await expect(page.locator('.device-list tbody')).toContainText('定制标签设备');
    await page.locator('.device-filter-chips').getByRole('button', { name: /标签：定制标签/ }).click();
    await expect(page.locator('.device-list h2')).toContainText('共 13 条');
    await page.getByLabel('设备产品').selectOption('prod_as_001');
    await page.getByLabel('设备状态').selectOption('online');
    await page.getByText('更多筛选与演示状态').click();
    await page.getByLabel('最后活跃起始时间').fill('2026-09-16T11:57');
    await page.getByRole('button', { name: '查询' }).click();
    await expect(page.locator('.device-list h2')).toContainText('共 3 条');
    await expect(page.locator('.device-filter-chips')).toContainText('最后活跃：2026-09-16T11:57');
    await page.locator('.device-filter-chips').getByRole('button', { name: /最后活跃：2026-09-16T11:57/ }).click();
    await expect(page.locator('.device-list h2')).toContainText('共 4 条');
  });
});

test('IOT-DEVICE-001 shows two telemetry units, gaps, zoom and export', async ({ page }) => {
  await page.goto('/devices');
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByRole('tab', { name: '时序数据' }).click();
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByText('存在 3 个缺失采样时段')).toBeVisible();
  await expect(panel.locator('.device-chart')).toHaveCount(2);
  await expect(panel).toContainText('°C');
  await expect(panel).toContainText('%RH');
  await expect(panel.locator('.device-chart circle title').first()).toContainText('2026-09-');
  await panel.getByText('数值摘要表（可复制）').click();
  const rows = panel.locator('.device-telemetry-table tbody tr');
  const initialCount = await rows.count();
  await page.getByLabel('实时追加').check();
  await expect(rows).toHaveCount(initialCount + 2, { timeout: 8000 });
  await page.getByLabel('实时追加').uncheck();
  await page.getByRole('button', { name: '放大后半段' }).click();
  await expect(page.getByRole('button', { name: '恢复全范围' })).toBeVisible();
  await expect(panel.locator('.device-telemetry-table')).toContainText('缺失');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 CSV', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('telemetry.csv');
  await page.getByRole('tab', { name: '规则执行' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('rule_high_temp');
});

test('IOT-DEVICE-001 queries a custom UTC telemetry interval and rejects invalid bounds', async ({ page }) => {
  await page.goto('/devices');
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByRole('tab', { name: '时序数据' }).click();
  const panel = page.getByRole('tabpanel');
  await panel.getByText('数值摘要表（可复制）').click();
  await page.getByLabel('时序范围').selectOption('0');
  await page.getByLabel('开始时间（UTC）').fill('2026-09-15T06:00');
  await page.getByLabel('结束时间（UTC）').fill('2026-09-15T08:00');
  const rows = panel.locator('.device-telemetry-table tbody tr');
  await expect(rows).toHaveCount(6);
  await expect(rows.first()).toContainText('2026-09-15T06:00:00.000Z');
  await page.getByLabel('结束时间（UTC）').fill('2026-09-15T05:00');
  await expect(panel.getByRole('alert')).toContainText('结束时间必须晚于开始时间');
  await expect(rows).toHaveCount(0);
  await page.getByLabel('时序范围').selectOption('1');
  await expect(rows).not.toHaveCount(0);
});

test('IOT-DEVICE-001 shows raw messages and persists fault alarm acknowledgement', async ({ page }) => {
  await page.goto('/devices');
  await page.locator('.device-list').getByRole('button', { name: '纽约温湿度三号' }).click();
  await page.getByRole('tab', { name: '消息' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('msg_seed_dev_na_001');
  await page.getByRole('tab', { name: '告警' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('设备故障状态');
  await page.getByRole('button', { name: '确认告警' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('已由 usr_202609_001 确认');
  await page.reload();
  await page.locator('.device-list').getByRole('button', { name: '纽约温湿度三号' }).click();
  await page.getByRole('tab', { name: '告警' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('已由 usr_202609_001 确认');
});

test('IOT-DEVICE-001 imports CSV atomically and confirms batch deletion', async ({ page }) => {
  await page.goto('/devices');
  await page.getByRole('button', { name: 'CSV 导入' }).click();
  await page.getByLabel('导入 CSV 文件').setInputFiles({ name: 'devices.csv', mimeType: 'text/csv', buffer: Buffer.from('name,region,countryCode,tags\n批量测试一号,AS,CN,环境|演示\n批量测试二号,EU,DE,环境') });
  const dialog = page.getByRole('dialog', { name: 'CSV 导入设备' });
  await expect(dialog).toContainText('预览：2 台未激活设备');
  await page.getByRole('button', { name: '确认导入' }).click();
  await expect(page.locator('.device-list h2')).toContainText('共 14 条');
  await page.goto('/dashboard');
  await expect(page.getByRole('region', { name: '关键指标' }).locator('.metric-card').first()).toContainText('14', { timeout: 10000 });
  await page.goto('/geography');
  await expect(page.locator('.geo-summary')).toContainText('14');
  await page.goto('/products');
  await expect(page.locator('.product-table-wrap tbody tr').filter({ hasText: '工业温湿度传感器' }).locator('td').nth(5)).toHaveText('8');
  await page.locator('.product-table-wrap').getByRole('button', { name: '工业温湿度传感器' }).click();
  await page.getByRole('tab', { name: '设备' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('8 台设备');
  await page.goto('/devices');
  await page.getByLabel('搜索设备').fill('批量测试');
  await page.getByRole('button', { name: '查询' }).click();
  await expect(page.locator('.device-list h2')).toContainText('共 2 条');
  await page.getByLabel('选择当前页设备').check();
  await page.getByRole('button', { name: '批量删除' }).click();
  await expect(page.getByRole('dialog', { name: '确认删除设备' })).toContainText('确认删除 2 台设备');
  await page.getByRole('dialog', { name: '确认删除设备' }).getByRole('button', { name: '取消' }).click();
  await expect(page.locator('.device-list h2')).toContainText('共 2 条');
  await page.getByRole('button', { name: '批量删除' }).click();
  await page.getByRole('dialog', { name: '确认删除设备' }).getByRole('button', { name: '确认删除' }).click();
  await expect(page.locator('.device-list h2')).toContainText('共 0 条');
  await page.goto('/dashboard');
  await expect(page.getByRole('region', { name: '关键指标' }).locator('.metric-card').first()).toContainText('12');
  await page.goto('/geography');
  await expect(page.locator('.geo-summary')).toContainText('12');
  await page.goto('/products');
  await expect(page.locator('.product-table-wrap tbody tr').filter({ hasText: '工业温湿度传感器' }).locator('td').nth(5)).toHaveText('6');
  await page.goto('/devices');
  await page.reload();
  await expect(page.locator('.device-list h2')).toContainText('共 12 条');
});

test('IOT-DEVICE-001 explains rejected control parameters inside the preview', async ({ page }) => {
  await page.goto('/devices');
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByRole('tab', { name: '实时属性' }).click();
  await page.getByLabel('控制命令').selectOption('tm_sampling_interval');
  await page.getByLabel('控制参数').fill('1001');
  await page.getByRole('button', { name: '预览命令' }).click();
  const preview = page.getByRole('dialog', { name: '控制预览' });
  await preview.getByRole('button', { name: '发送命令' }).click();
  await expect(preview.getByRole('alert')).toContainText('命令参数无效');
  await preview.getByRole('button', { name: '取消' }).click();
  await page.getByLabel('控制参数').fill('100');
  await page.getByRole('button', { name: '预览命令' }).click();
  await expect(preview.getByRole('alert')).toHaveCount(0);
  await preview.getByRole('button', { name: '发送命令' }).click();
  await expect(page.getByRole('tab', { name: '命令记录' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toContainText('成功');
});

test('IOT-DEVICE-001 previews and records model driven control, with offline and permission guards', async ({ page }) => {
  await page.goto('/devices');
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByRole('tab', { name: '实时属性' }).click();
  await page.getByLabel('控制命令').selectOption('tm_sampling_interval');
  await page.getByLabel('控制参数').fill('100');
  await page.getByRole('button', { name: '预览命令' }).click();
  await expect(page.getByRole('dialog', { name: '控制预览' })).toContainText('100');
  const previewBounds = await page.getByRole('dialog', { name: '控制预览' }).boundingBox();
  expect(previewBounds).not.toBeNull();
  expect(Math.abs(previewBounds!.x + previewBounds!.width - page.viewportSize()!.width)).toBeLessThan(2);
  await expect(page.getByRole('dialog', { name: '控制预览' })).toBeFocused();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.move(10, 800);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '发送命令' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: '取消' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '控制预览' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '预览命令' })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe('');
  await page.getByRole('button', { name: '预览命令' }).click();
  await page.getByRole('button', { name: '发送命令' }).click();
  await expect(page.getByRole('tab', { name: '命令记录' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: '命令记录' })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('成功');
  await page.getByRole('button', { name: '关闭设备详情' }).click();
  await page.getByLabel('搜索设备').fill('约堡');
  await page.getByRole('button', { name: '查询' }).click();
  await page.locator('.device-list').getByRole('button', { name: '约堡温湿度五号' }).click();
  await page.getByRole('tab', { name: '实时属性' }).click();
  await expect(page.getByRole('button', { name: '预览命令' })).toBeDisabled();
  await expect(page.getByRole('tabpanel')).toContainText('设备离线或不可控制');
  await page.getByRole('button', { name: '关闭设备详情' }).click();
  await page.getByLabel('演示身份').selectOption('viewer');
  await page.getByLabel('搜索设备').fill('上海');
  await page.getByRole('button', { name: '查询' }).click();
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await expect(page.getByRole('button', { name: '保存设备信息' })).toHaveCount(0);
  await page.getByRole('tab', { name: '实时属性' }).click();
  await expect(page.getByRole('button', { name: '预览命令' })).toBeDisabled();
});

test('IOT-DEVICE-001 live telemetry updates and persists the reported shadow', async ({ page }) => {
  await page.goto('/devices');
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByRole('tab', { name: '时序数据' }).click();
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByText('存在 3 个缺失采样时段')).toBeVisible();
  await panel.getByText('数值摘要表（可复制）').click();
  const rows = panel.locator('.device-telemetry-table tbody tr');
  const initialCount = await rows.count();
  await page.getByLabel('实时追加').check();
  await expect(rows).toHaveCount(initialCount + 2, { timeout: 8000 });
  const liveHumidity = (await rows.last().locator('td').nth(2).textContent())?.trim();
  expect(liveHumidity).toBeTruthy();
  await page.getByLabel('实时追加').uncheck();
  await page.getByRole('tab', { name: '消息' }).click();
  await expect(page.getByRole('tabpanel').locator('details').filter({ hasText: 'msg_seed_dev_as_001' })).toContainText('24.5');
  await page.getByRole('tab', { name: '设备影子' }).click();
  await expect(page.getByRole('tabpanel').getByRole('row').filter({ hasText: 'humidity' }).locator('td').nth(1)).toHaveText(liveHumidity!);
  await page.reload();
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByRole('tab', { name: '设备影子' }).click();
  await expect(page.getByRole('tabpanel').getByRole('row').filter({ hasText: 'humidity' }).locator('td').nth(1)).toHaveText(liveHumidity!);
});

test('IOT-DEVICE-001 displays and reconciles the device shadow after a command', async ({ page }) => {
  await page.goto('/devices');
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByRole('tab', { name: '设备影子' }).click();
  const panel = page.getByRole('tabpanel');
  const property = panel.getByRole('row').filter({ hasText: 'sampling_interval' });
  await expect(property).toContainText('60');
  await expect(property).toContainText('—');
  await page.getByRole('tab', { name: '实时属性' }).click();
  await page.getByLabel('控制命令').selectOption('tm_sampling_interval');
  await page.getByLabel('控制参数').fill('100');
  await page.getByRole('button', { name: '预览命令' }).click();
  await page.getByRole('button', { name: '发送命令' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('成功');
  await page.getByRole('tab', { name: '设备影子' }).click();
  await expect(page.getByRole('tabpanel').getByRole('row').filter({ hasText: 'sampling_interval' })).toContainText('100');
  await page.getByRole('tab', { name: '实时属性' }).click();
  await expect(page.getByRole('tabpanel').getByRole('row').filter({ hasText: 'sampling_interval' })).toContainText('100');
  await page.reload();
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByRole('tab', { name: '设备影子' }).click();
  await expect(page.getByRole('tabpanel').getByRole('row').filter({ hasText: 'sampling_interval' })).toContainText('100');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('IOT-DEVICE-001 is accessible in light theme and narrow viewport', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/devices');
  await page.getByLabel('主题').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByRole('tab', { name: '时序数据' }).click();
  await expect(page.getByRole('tabpanel').locator('.device-chart')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
  expect(errors).toEqual([]);
});

test('IOT-DEVICE-001 keeps edited metadata after reload', async ({ page }) => {
  await page.goto('/devices');
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByLabel('编辑设备名称').fill('上海演示设备');
  await page.getByLabel('编辑设备标签').fill('环境,演示');
  await page.getByRole('button', { name: '保存设备信息' }).click();
  await expect(page.getByRole('dialog', { name: '设备详情' })).toContainText('上海演示设备');
  await page.reload();
  await page.locator('.device-list').getByRole('button', { name: '上海演示设备' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('演示');
});
