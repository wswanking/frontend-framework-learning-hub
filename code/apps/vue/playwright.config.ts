import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: true, forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, workers: 2, timeout: 30_000, outputDir: 'reports/test-results',
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright', open: 'never' }], ['junit', { outputFile: 'reports/e2e.xml' }]],
  use: { channel: process.env.PLAYWRIGHT_CHANNEL, baseURL: 'http://127.0.0.1:14102', locale: 'zh-CN', timezoneId: 'Asia/Shanghai', colorScheme: 'light', reducedMotion: 'reduce', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }, { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:14102', reuseExistingServer: false, timeout: 60_000 },
});
