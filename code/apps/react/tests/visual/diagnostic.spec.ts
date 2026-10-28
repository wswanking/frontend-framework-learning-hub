import { expect, test } from '@playwright/test';
test('diagnostic fixture states, not product acceptance', async ({ page, browser }, testInfo) => {
  await testInfo.attach('render-environment', { body: JSON.stringify({ platform: process.platform, browserVersion: browser.version(), channel: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? 'explicit-executable' : process.env.PLAYWRIGHT_CHANNEL ?? 'bundled-chromium', executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? null, viewport: testInfo.project.use.viewport }), contentType: 'application/json' });
  await page.goto('/diagnostics');
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('initial.png', { fullPage: true });
  await page.getByRole('button', { name: '运行诊断' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveScreenshot('invalid.png', { fullPage: true });
  await page.getByLabel('诊断名称').fill('链路检查');
  await page.getByRole('button', { name: '运行诊断' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page).toHaveScreenshot('success.png', { fullPage: true });
});
