import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('IOT-PLATFORM-001/002 shows factual requirements, issue and pending review with traceability', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/delivery');
  await expect(page.getByRole('heading', { name: '交付看板' })).toBeVisible();
  await page.getByLabel('搜索交付记录').fill('IOT-TENANT-001');
  await page.getByRole('button', { name: '查询' }).click();
  await page.getByRole('button', { name: /IOT-TENANT-001.*租户、成员与配额/ }).click();
  await expect(page.locator('.delivery-detail')).toContainText('ISSUE-20260920-001');
  await expect(page.locator('.delivery-detail')).toContainText('REVIEW-003');
  await page.getByRole('button', { name: /ISSUE-20260920-001.*租户管理员成员权限契约冲突/ }).first().click();
  await expect(page.locator('.delivery-detail')).toContainText('待用户决定');
  await page.getByLabel('搜索交付记录').fill('IOT-DASH-001');
  await page.getByRole('button', { name: '查询' }).click();
  await page.getByRole('button', { name: /IOT-DASH-001.*数据大盘/ }).click();
  await expect(page.locator('.delivery-detail')).toContainText('REVIEW-002');
  await page.getByLabel('搜索交付记录').fill('IOT-LEARNING-001');
  await page.getByRole('button', { name: '查询' }).click();
  await page.getByRole('button', { name: /IOT-LEARNING-001.*三框架组件与图表实验室/ }).click();
  await expect(page.locator('.delivery-detail')).toContainText('ISSUE-20260920-002');
  await expect(page.locator('.delivery-detail')).toContainText('REVIEW-004');
  expect(errors).toEqual([]);
});

test('IOT-RELEASE-001 explains why production is blocked and saves only a local Mock record', async ({ page }) => {
  await page.goto('/delivery');
  await page.getByLabel('模拟治理身份').selectOption('releaseLead');
  await page.getByRole('button', { name: '创建发布记录' }).click();
  await page.getByLabel('交付标题').fill('租户演示版本');
  await page.getByLabel('发布环境').selectOption('production');
  await page.getByLabel('目标版本', { exact: true }).fill('v0.1.0');
  await page.getByLabel('发布关联需求', { exact: true }).selectOption('IOT-TENANT-001');
  await expect(page.locator('.delivery-check')).toContainText('ISSUE-20260920-001');
  await expect(page.locator('.delivery-check')).toContainText('REVIEW-003');
  await expect(page.locator('.delivery-check')).toContainText('REVIEW-005');
  await page.getByRole('button', { name: '保存模拟记录' }).click();
  await expect(page.locator('.delivery-detail')).toContainText('阻塞');
  await expect(page.getByRole('button', { name: '标记模拟发布' })).toBeDisabled();
});

test('IOT-PLATFORM-002 light theme is accessible and page fits the viewport', async ({ page }) => {
  await page.goto('/delivery');
  await page.getByLabel('主题').selectOption('light');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
});


test('IOT-PLATFORM-001 returns an approved scope change to review with a CHG trace', async ({ page }) => {
  await page.goto('/delivery');
  await page.getByLabel('模拟治理身份').selectOption('techLead');
  await page.getByLabel('搜索交付记录').fill('REVIEW-003');
  await page.getByRole('button', { name: '查询' }).click();
  await page.getByRole('button', { name: /REVIEW-003.*领域契约与业务交互审核/ }).first().click();
  await page.getByLabel('审核结论').selectOption('approved');
  await page.getByLabel('审核原因').fill('模拟审核首轮范围');
  await page.getByRole('button', { name: '记录模拟审核结论' }).click();
  await page.getByLabel('模拟治理身份').selectOption('productOwner');
  await page.getByLabel('搜索交付记录').fill('IOT-TENANT-001');
  await page.getByRole('button', { name: '查询' }).click();
  await page.getByRole('button', { name: /IOT-TENANT-001.*租户、成员与配额/ }).first().click();
  await page.getByRole('button', { name: '编辑需求范围' }).click();
  await page.getByLabel('交付负责人', { exact: true }).fill('product-lead');
  await page.getByLabel('验收标准').fill('成员权限按统一契约执行');
  await page.getByRole('button', { name: '保存模拟记录' }).click();
  await page.getByLabel('需求状态').selectOption('approved');
  await page.getByRole('button', { name: '保存需求状态' }).click();
  await expect(page.locator('.delivery-detail')).toContainText('已通过');
  await page.getByRole('button', { name: '编辑需求范围' }).click();
  await page.getByLabel('交付说明').fill('扩大租户成员管理范围，须重新审核');
  await page.getByRole('button', { name: '保存模拟记录' }).click();
  await expect(page.locator('.delivery-detail')).toContainText('待处理');
  await expect(page.locator('.delivery-detail')).toContainText('CHG-20260920-');
  await expect(page.locator('.delivery-detail')).toContainText('REVIEW-003');
  await page.getByRole('button', { name: /CHG-20260920-/ }).click();
  await expect(page.locator('.delivery-detail')).toContainText('已批准需求范围变更，退回待审核');
});


test('IOT-RELEASE-001 groups checks and opens missing release material', async ({ page }) => {
  await page.goto('/delivery');
  await page.getByRole('button', { name: '创建发布记录' }).click();
  await expect(page.getByRole('region', { name: '通过检查项' })).toBeVisible();
  await expect(page.getByRole('region', { name: '阻塞检查项' })).toContainText('缺少目标版本');
  await page.getByRole('button', { name: /查看缺失材料：缺少目标版本/ }).click();
  await expect(page.getByRole('textbox', { name: '目标版本', exact: true })).toBeFocused();
  await page.getByLabel('发布环境').selectOption('production');
  await page.getByLabel('发布关联需求', { exact: true }).selectOption('IOT-TENANT-001');
  await expect(page.getByRole('region', { name: '阻塞检查项' })).toContainText('REVIEW-005');
  await expect(page.getByRole('region', { name: '阻塞检查项' })).toContainText('下一责任人');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
  await page.getByRole('button', { name: /查看缺失材料：正式发布审核未通过：REVIEW-005/ }).click();
  await expect(page.getByRole('dialog', { name: '新建发布记录' })).toHaveCount(0);
  await expect(page.locator('.delivery-detail')).toContainText('REVIEW-005');
});


test('IOT-RELEASE-001 keeps a blocked record editable with an audit revision', async ({ page }) => {
  await page.goto('/delivery');
  await page.getByLabel('模拟治理身份').selectOption('releaseLead');
  await page.getByRole('button', { name: '创建发布记录' }).click();
  await page.getByLabel('交付标题').fill('待补材料版本');
  await page.getByLabel('发布环境').selectOption('production');
  await page.getByLabel('目标版本', { exact: true }).fill('v0.2.0');
  await page.getByLabel('发布关联需求', { exact: true }).selectOption('IOT-TENANT-001');
  await page.getByRole('button', { name: '保存模拟记录' }).click();
  const detail = page.locator('.delivery-detail');
  await expect(detail).toContainText('缺少回滚步骤或上一已验证版本');
  await expect(page.getByRole('button', { name: '标记模拟发布' })).toBeDisabled();
  await page.getByRole('button', { name: '补齐发布材料' }).click();
  await expect(page.getByRole('dialog', { name: '编辑发布记录' })).toBeVisible();
  await page.getByLabel('上一已验证版本', { exact: true }).fill('v0.1.0');
  await page.getByLabel('变更摘要', { exact: true }).fill('补齐交付材料');
  await page.getByLabel('测试证据', { exact: true }).fill('本地浏览器回归');
  await page.getByLabel('回滚步骤', { exact: true }).fill('恢复 v0.1.0');
  await page.getByRole('button', { name: '保存模拟记录' }).click();
  await expect(detail).toContainText('更新发布材料');
  await expect(detail).toContainText('REVIEW-005');
  await expect(detail).not.toContainText('缺少回滚步骤或上一已验证版本');
  await expect(page.getByRole('button', { name: '标记模拟发布' })).toBeDisabled();
});


test('IOT-PLATFORM-002 delivery dialog keeps keyboard focus and restores the trigger', async ({ page }) => {
  await page.goto('/delivery');
  const trigger = page.getByRole('button', { name: '创建发布记录' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '新建发布记录' });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('交付标题')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await page.getByRole('button', { name: '取消' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '关闭新建' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
});
