import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('IOT-LEARNING-001 main UI example filters fixed data and keeps theme local', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/labs');
  await expect(page.getByRole('heading', { name: '组件与图表实验室' })).toBeVisible();
  await expect(page.getByLabel('数据集种子')).toHaveValue('iot-atlas-demo-001');
  await expect(page.locator('.lab-table-wrap tbody tr')).toHaveCount(3);
  await page.getByLabel('实验设备状态').selectOption('online');
  await expect(page.locator('.lab-table-wrap tbody tr')).toHaveCount(2);
  await page.getByLabel('实验搜索设备').fill('摄像头');
  await expect(page.locator('.lab-table-wrap tbody tr')).toHaveCount(1);
  const businessTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByLabel('实验室主题').selectOption('light');
  await expect(page.locator('.lab-grid')).toHaveAttribute('data-lab-theme', 'light');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(businessTheme);
  await page.getByLabel('实验示例').selectOption('form');
  await page.getByLabel('实验设备名称').fill('测试设备');
  await page.getByRole('button', { name: '验证表单' }).click();
  await expect(page.getByRole('status')).toContainText('测试设备');
  await page.getByLabel('实验示例').selectOption('dialog');
  await page.getByRole('button', { name: '打开示例对话框' }).click();
  await expect(page.getByRole('dialog', { name: '确认示例操作' })).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click();
  await page.getByRole('button', { name: '重置实验参数' }).click();
  await expect(page.locator('.lab-table-wrap tbody tr')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('IOT-LEARNING-001 React candidate UI libraries render real controls with shared data', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/labs');
  const businessTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  const initialAssets = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
  expect(initialAssets.some(name => /Lab(Ui|Chakra)Candidate/.test(name))).toBe(false);
  for (const library of ['antd', 'chakra']) {
    await page.getByLabel('实验 UI 库').selectOption(library);
    const demo = page.locator(`[data-ui-library="${library}"]`);
    await expect(demo.locator('tbody tr')).toHaveCount(3);
    if (library === 'antd') {
      const loaded = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
      expect(loaded.some(name => name.includes('LabUiCandidates-'))).toBe(true);
      expect(loaded.some(name => name.includes('LabChakraCandidate-'))).toBe(false);
    }
    await page.getByLabel('实验设备状态').selectOption('offline');
    await expect(demo.locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('实验示例').selectOption('form');
    await page.getByLabel('实验设备名称').fill(`${library}设备`);
    await demo.getByRole('button', { name: '验证表单' }).click();
    await expect(demo.getByRole('status')).toContainText(`${library}设备`);
    await page.getByLabel('实验示例').selectOption('dialog');
    await demo.getByRole('button', { name: '打开示例对话框' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: /取\s*消/ }).click();
    await page.getByLabel('实验示例').selectOption('nav');
    await expect(demo.getByRole('navigation', { name: '实验室示例导航' })).toBeVisible();
    await page.getByLabel('实验室主题').selectOption('light');
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(businessTheme);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
    await page.getByLabel('实验示例').selectOption('table');
    await page.getByLabel('实验设备状态').selectOption('all');
  }
  expect(errors).toEqual([]);
});

test('IOT-LEARNING-001 lab fits narrow screens and passes accessibility scan', async ({ page }) => {
  await page.goto('/labs');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
  await page.getByLabel('实验室主题').selectOption('light');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
});


test('IOT-LEARNING-001 renders the same trend, bar and pie data with three chart libraries', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/labs');
  const section = page.getByRole('region', { name: '图表库对比' });
  await expect(section).toContainText('09:00 12 条消息');
  await expect(section).toContainText('12:00 24 条消息');
  for (const library of ['echarts', 'chartjs', 'd3']) {
    await section.getByLabel('实验图表库').selectOption(library);
    for (const kind of ['trend', 'bar', 'pie']) {
      await section.getByLabel('实验图表类型').selectOption(kind);
      await expect(section.locator('.lab-chart-host')).toHaveAttribute('data-rendered-library', library);
      await expect(section.locator('.lab-chart-host')).toHaveAttribute('data-rendered-kind', kind);
      const graphic = section.locator(library === 'chartjs' ? '.lab-chart-host canvas' : '.lab-chart-host svg');
      await expect(graphic).toBeVisible({ timeout: 15_000 });
      await expect(section.getByRole('alert')).toHaveCount(0);
    }
  }
  expect(errors).toEqual([]);
});


test('IOT-LEARNING-001 serves this framework implementation source and PRD link', async ({ page }) => {
  await page.goto('/labs');
  const links = [
    ['查看 UI 实现', 'LAB_SEED'],
    ['查看 Ant Design 实现', 'ConfigProvider'],
    ['查看 Chakra UI 实现', 'ChakraProvider'],
    ['查看图表界面', 'renderLabChart'],
    ['查看渲染适配', 'LAB_CHART_VALUES'],
  ] as const;
  for (const [label, marker] of links) {
    const href = await page.getByRole('link', { name: label }).getAttribute('href');
    expect(href).toMatch(/^\/source\//);
    const response = await page.request.get(href!);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain(marker);
  }
  const prd = await page.getByRole('link', { name: '关联 PRD 快照' }).getAttribute('href');
  expect(prd).toBe('/source/lab-prd.md');
  expect(await (await page.request.get(prd!)).text()).toContain('IOT-LEARNING-001');
  const metrics = await page.getByRole('link', { name: '查看性能与体积测量' }).getAttribute('href');
  expect(metrics).toBe('/source/lab-metrics.html');
  expect(await (await page.request.get(metrics!)).text()).toContain('JS/CSS 原始合计');
  const data = await (await page.request.get('/source/lab-metrics.json')).json();
  expect(data.framework).toBe('react');
  expect(data.results['chart:echarts'].medianGzipBytes).toBeGreaterThan(0);
});
