import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('IOT-TENANT-001 filters tenants and carries the selected tenant to the dashboard', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tenants');
  await expect(page.getByRole('heading', { name: '租户管理' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '租户列表 · 共 2 条' })).toBeVisible();
  await expect(page.locator('.tenant-table tbody tr').first().locator('td').nth(6)).toContainText('68%');
  await page.getByLabel('搜索租户').fill('全球');
  await page.getByRole('button', { name: '查询' }).click();
  await expect(page.getByRole('heading', { name: '租户列表 · 共 1 条' })).toBeVisible();
  await page.getByRole('button', { name: '全球能源' }).click();
  await page.getByRole('button', { name: '配额', exact: true }).click();
  await expect(page.locator('.tenant-quota-grid')).toContainText('设备');
  await page.getByLabel('当前租户').selectOption('ten_202609_002');
  await expect(page.getByRole('heading', { name: '租户列表 · 共 1 条' })).toBeVisible();
  await expect(page.locator('.tenant-table tbody')).not.toContainText('华东智联');
  await page.getByRole('link', { name: /数据大盘/ }).click();
  await expect(page).toHaveURL(/tenant=ten_202609_002/);
  await expect(page.getByRole('heading', { name: '全球设备运行态势' })).toBeVisible({ timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('IOT-TENANT-001 previews quota impact, manages Mock members and keeps viewers read-only', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tenants');
  await page.getByRole('button', { name: '华东智联' }).click();
  await page.getByRole('button', { name: '成员', exact: true }).click();
  await page.getByRole('button', { name: '添加成员' }).click();
  await page.getByLabel('成员姓名').fill('测试成员');
  await page.getByLabel('成员邮箱').fill('member@example.com');
  await page.getByLabel('成员角色').selectOption('operator');
  await expect(page.getByRole('dialog', { name: '编辑成员' })).toContainText('设备控制');
  await page.getByRole('button', { name: '确认保存' }).click();
  await expect(page.locator('.tenant-panel').last().locator('.tenant-table tbody')).toContainText('member@example.com');
  await page.getByRole('button', { name: '配额', exact: true }).click();
  await page.getByRole('button', { name: '编辑配额' }).click();
  await page.getByLabel('设备上限', { exact: true }).fill('5');
  await page.getByRole('button', { name: '预览影响' }).click();
  await expect(page.getByRole('dialog', { name: '编辑配额' }).getByRole('alert')).toContainText('设备 6/5');
  await expect(page.getByRole('button', { name: '保存配额' })).toBeDisabled();
  await page.getByLabel('设备上限', { exact: true }).fill('6');
  await page.getByRole('button', { name: '预览影响' }).click();
  await page.getByRole('button', { name: '保存配额' }).click();
  await expect(page.locator('.tenant-quota-grid')).toContainText('6 / 6');
  await page.getByLabel('演示身份').selectOption('viewer');
  await expect(page.getByRole('button', { name: '新建租户' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '添加成员' })).toHaveCount(0);
  await page.goto('/devices?tenant=ten_202609_001');
  await page.getByRole('button', { name: '新建设备' }).click();
  await page.getByLabel('新设备名称').fill('配额边界设备');
  await page.getByRole('button', { name: '确认登记' }).click();
  await expect(page.getByRole('dialog', { name: '新建设备' }).getByRole('alert')).toContainText('已用 6/6');
  expect(errors).toEqual([]);
});

test('IOT-TENANT-001 has accessible light theme and no page overflow', async ({ page }) => {
  await page.goto('/tenants');
  await page.getByLabel('主题').selectOption('light');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
});

test('IOT-TENANT-001 creates a tenant, publishes its product and registers its device', async ({ page }) => {
  await page.goto('/tenants');
  await page.getByRole('button', { name: '新建租户' }).click();
  await page.getByLabel('租户名称').fill('新建验证租户');
  await page.getByLabel('租户标识').fill('acceptance-tenant');
  await page.getByLabel('联系人').fill('验收员');
  await page.getByLabel('联系邮箱').fill('acceptance@example.com');
  await page.getByRole('button', { name: '保存租户' }).click();
  const tenantId = await page.evaluate(() => JSON.parse(localStorage.getItem('iot-atlas-tenants-v1') ?? '{}').tenants?.find((row: { key: string }) => row.key === 'acceptance-tenant')?.id as string);
  expect(tenantId).toBeTruthy();
  await page.goto(`/products?tenant=${tenantId}`);
  await page.getByRole('button', { name: '新建产品' }).click();
  await expect(page.getByLabel('产品租户')).toHaveValue(tenantId);
  await page.getByLabel('产品名称').fill('新租户传感器');
  await page.getByLabel('Product Key', { exact: true }).fill('acceptance-sensor');
  await page.getByLabel('产品状态').selectOption('published');
  await page.getByRole('button', { name: '保存产品' }).click();
  await expect(page.getByRole('alert')).toContainText('已保存');
  await page.goto(`/devices?tenant=${tenantId}`);
  await page.getByRole('button', { name: '新建设备' }).click();
  await expect(page.getByLabel('新建设备产品')).toContainText('新租户传感器');
  await page.getByLabel('新设备名称').fill('新租户设备');
  await page.getByRole('button', { name: '确认登记' }).click();
  await expect(page.locator('.device-list')).toContainText('新租户设备');
});
