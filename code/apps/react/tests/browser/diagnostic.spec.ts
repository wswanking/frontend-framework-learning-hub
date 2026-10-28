import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('IOT-QUALITY-001 invalid input, failure and retry', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/diagnostics');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('诊断与验收环境');
  await page.getByRole('button', { name: '运行诊断' }).click();
  await expect(page.getByRole('alert')).toHaveText('请输入诊断名称');
  await page.getByLabel('诊断名称').fill('链路检查');
  await page.getByLabel('模拟失败').check();
  await page.getByRole('button', { name: '运行诊断' }).click();
  await expect(page.getByRole('alert')).toContainText('模拟请求失败');
  await expect(page.getByLabel('诊断名称')).toHaveValue('链路检查');
  await page.getByLabel('模拟失败').uncheck();
  await page.getByRole('button', { name: '运行诊断' }).click();
  await expect(page.getByRole('status')).toHaveText('诊断通过：链路检查');
  expect(errors).toEqual([]);
});
test('IOT-QUALITY-001 accessible states and responsive layout', async ({ page }) => {
  await page.goto('/diagnostics');
  for (const state of ['initial', 'error', 'success']) {
    if (state === 'error') await page.getByRole('button', { name: '运行诊断' }).click();
    if (state === 'success') {
      await page.getByLabel('诊断名称').fill('链路检查');
      await page.getByRole('button', { name: '运行诊断' }).click();
      await expect(page.getByRole('status')).toBeVisible();
    }
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations, state).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
