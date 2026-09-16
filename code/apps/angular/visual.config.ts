import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testDir: './tests/visual', updateSnapshots: 'none',
  outputDir: 'reports/visual-results',
  reporter: [['list'], ['html', { outputFolder: 'reports/visual-report', open: 'never' }], ['junit', { outputFile: 'reports/visual.xml' }]],
  snapshotPathTemplate: process.env.VISUAL_CANDIDATES === '1' ? '{testDir}/../../reports/visual-candidates/{projectName}/{arg}-{platform}{ext}' : '{testDir}/baselines/{projectName}/{arg}-{platform}{ext}',
  expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.005 } },
});
