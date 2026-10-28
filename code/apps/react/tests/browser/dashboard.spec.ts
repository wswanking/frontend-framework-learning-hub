import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openMobileFilters(page: Page) {
  if ((page.viewportSize()?.width ?? 0) <= 720) await page.getByRole('button', { name: /筛选条件（展开）/ }).click();
}

test('IOT-DASH-001 clears paused events and detail after identity or permission changes', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('.metric-card')).toHaveCount(5);
  await page.getByRole('button', { name: '暂停事件' }).click();
  await page.locator('.country-list').getByRole('button', { name: /中国/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/country=CN/);
  await page.getByLabel('演示身份').selectOption('viewer');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.metric-card')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('无权');
  await expect.poll(() => new URL(page.url()).searchParams.has('country')).toBe(false);
  await page.getByLabel('演示身份').selectOption('platformAdmin');
  await expect(page.locator('.metric-card')).toHaveCount(5);
  await expect(page.getByRole('button', { name: '暂停事件' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openMobileFilters(page);
  await page.getByText('演示状态').click();
  await page.getByLabel('Mock 场景').selectOption('forbidden');
  await expect(page.locator('.metric-card')).toHaveCount(0);
  await page.getByLabel('Mock 场景').selectOption('normal');
  await expect(page.locator('.metric-card')).toHaveCount(5);
  await expect(page.getByRole('button', { name: '暂停事件' })).toBeVisible();
});


test('IOT-DASH-001 keeps mobile filters collapsed until requested', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  const toggle = page.getByRole('button', { name: /筛选条件/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.filter-body')).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.filter-body')).toBeVisible();
  await page.getByRole('button', { name: '应用' }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.filter-body')).toBeHidden();
  await toggle.click();
  await page.getByRole('button', { name: '重置' }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('IOT-QUALITY-001 keeps key data readable at a tablet viewport', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/dashboard');
  await openMobileFilters(page);
  await expect(page.getByRole('heading', { name: '全球设备运行态势' })).toBeVisible();
  await expect(page.locator('.metric-card')).toHaveCount(5);
  await expect(page.locator('.world-chart')).toBeVisible();
  expect(await page.locator('.atlas-sidebar nav').evaluate(nav => getComputedStyle(nav).display)).toBe('grid');
  for (const route of ['/dashboard', '/geography', '/products', '/devices', '/rules', '/firmware', '/tenants', '/labs', '/delivery']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route} overflows the tablet viewport`).toBe(true);
  }
});

test('IOT-DASH-001 opens the lab from the shared navigation', async ({ page }) => {
  await page.goto('/dashboard');
  await openMobileFilters(page);
  const menu = page.getByRole('button', { name: '导航菜单' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation').getByRole('link', { name: '实验室' }).click();
  await expect(page).toHaveURL(/\/labs$/);
  await expect(page.getByRole('heading', { name: '组件与图表实验室' })).toBeVisible();
});

test('IOT-DASH-001 map controls change and reset the view without changing the query', async ({ page }) => {
  await page.goto('/dashboard');
  await openMobileFilters(page);
  const map = page.locator('.world-chart svg');
  await expect(map).toBeVisible();
  const signature = () => map.evaluate(svg => {
    let hash = 2166136261;
    for (const character of svg.innerHTML) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return hash >>> 0;
  });
  const original = await signature();
  const originalUrl = page.url();
  await page.getByRole('button', { name: '放大地图' }).click();
  await expect.poll(signature).not.toBe(original);
  await page.getByRole('button', { name: '放大地图' }).click();
  const enlarged = await signature();
  await page.getByRole('button', { name: '缩小地图' }).click();
  await expect.poll(signature).not.toBe(enlarged);
  const reduced = await signature();
  await page.getByRole('button', { name: '定位到全球' }).click();
  await expect.poll(signature).not.toBe(reduced);
  expect(page.url()).toBe(originalUrl);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('IOT-DASH-001 one applied query drives metrics, map, ranking and country detail', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dashboard');
  await openMobileFilters(page);
  await expect(page.getByRole('heading', { name: '全球设备运行态势' })).toBeVisible();
  const metrics = page.getByRole('region', { name: '关键指标' });
  await expect(metrics.locator('.metric-card').first()).toContainText('12');
  await expect(metrics.locator('.metric-card').first()).toContainText('上期');
  await expect(metrics.locator('.metric-card').first()).toContainText('统计截至');
  await page.getByRole('combobox', { name: '租户' }).click();
  await page.getByRole('option', { name: '华东智联' }).click();
  await page.getByRole('combobox', { name: '时间范围' }).click();
  await page.getByRole('option', { name: '7 天' }).click();
  await page.getByRole('combobox', { name: '地域' }).click();
  await page.getByRole('option', { name: '亚洲' }).click();
  await expect(metrics.locator('.metric-card').first()).toContainText('12');
  await page.getByRole('button', { name: '应用' }).click();
  await expect(metrics.locator('.metric-card').first()).toContainText('1');
  await expect(page.locator('.region-list')).toContainText('亚洲');
  await expect(page.locator('.country-list')).toContainText('中国');
  await expect(page.locator('.country-list')).not.toContainText('德国');
  const countryButton = page.locator('.country-list').getByRole('button', { name: /中国/ });
  await countryButton.click();
  const countryDialog = page.getByRole('dialog', { name: '中国节点详情' });
  await expect(countryDialog).toContainText('node_cn_001');
  await expect(countryDialog).toBeFocused();
  await expect(page).toHaveURL(/country=CN/);
  await page.keyboard.press('Escape');
  await expect(countryDialog).toHaveCount(0);
  await expect(countryButton).toBeFocused();
  await countryButton.click();
  await page.getByRole('button', { name: '关闭详情' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('IOT-DASH-001 applies a valid custom range and rejects reversed or future times', async ({ page }) => {
  await page.goto('/dashboard');
  await openMobileFilters(page);
  await expect(page.locator('.metric-card').first()).toContainText('12');
  await page.getByRole('combobox', { name: '时间范围' }).click();
  await page.getByRole('option', { name: '自定义' }).click();
  await page.getByLabel('开始时间').fill('2026-09-16T08:00');
  await page.getByLabel('结束时间').fill('2026-09-17T08:00');
  await page.getByRole('button', { name: '应用' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('from')).toBe('2026-09-16T00:00:00.000Z');
  expect(new URL(page.url()).searchParams.get('to')).toBe('2026-09-17T00:00:00.000Z');
  await expect(page.locator('.metric-card').first()).toContainText('12');
  const appliedUrl = page.url();
  await openMobileFilters(page);
  await page.getByLabel('结束时间').fill('2026-09-16T07:00');
  await page.getByRole('button', { name: '应用' }).click();
  await expect(page.locator('#dashboard-range-error')).toContainText('请选择有效且不晚于当前时间');
  await expect(page.getByLabel('结束时间')).toBeFocused();
  await expect(page.getByLabel('结束时间')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('结束时间')).toHaveAttribute('aria-describedby', 'dashboard-range-error');
  expect(page.url()).toBe(appliedUrl);
  await page.getByLabel('结束时间').fill('2099-01-01T00:00');
  await page.getByRole('button', { name: '应用' }).click();
  await expect(page.locator('#dashboard-range-error')).toContainText('请选择有效且不晚于当前时间');
  await expect(page.getByLabel('结束时间')).toBeFocused();
  await expect(page.getByLabel('结束时间')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('结束时间')).toHaveAttribute('aria-describedby', 'dashboard-range-error');
  expect(page.url()).toBe(appliedUrl);
});

test('IOT-DASH-001 partial failure, stale data, theme and narrow layout', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.goto('/dashboard');
  await openMobileFilters(page);
  await expect(page.locator('.metric-card').first()).toContainText('12', { timeout: 10_000 });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
  expect(errors).toEqual([]);
  await page.getByLabel('主题').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByText('演示状态').click();
  await page.getByLabel('Mock 场景').selectOption('partialFailure');
  await expect(page.getByRole('alert')).toContainText('地图分区暂不可用');
  await expect(page.locator('.metric-card').first()).toContainText('12');
  expect(errors).toEqual([]);
  await page.getByLabel('Mock 场景').selectOption('offline');
  await expect(page.getByRole('alert')).toContainText('非最新');
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible();
  await expect(page.locator('.metric-card').first()).toContainText('12');
  expect(errors).toEqual([]);
  await page.getByLabel('Mock 场景').selectOption('forbidden');
  await expect(page.getByRole('alert')).toContainText('无权查看该租户数据');
  await expect(page.getByRole('button', { name: '重试' })).toHaveCount(0);
  await expect(page.locator('.metric-card')).toHaveCount(0);
  await page.getByLabel('Mock 场景').selectOption('forbidden');
  await expect(page.getByRole('alert')).toContainText('无权查看该租户数据');
  await expect(page.getByRole('button', { name: '重试' })).toHaveCount(0);
  await expect(page.locator('.metric-card')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await openMobileFilters(page);
  const apply = page.getByRole('button', { name: '应用', exact: true });
  await expect(apply).toBeEnabled();
  expect(await apply.evaluate(button => button.getAnimations().every(animation =>
    !(animation instanceof CSSTransition) || !['color', 'background-color'].includes(animation.transitionProperty)
  ))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
  expect(errors).toEqual([]);
});

test('IOT-DASH-001 reflects device alarm acknowledgement across pages', async ({ page }) => {
  // Seed alarms occurred in September; keep this time-window assertion deterministic.
  await page.clock.setFixedTime(new Date('2026-09-20T12:00:00.000Z'));
  await page.goto('/dashboard');
  await openMobileFilters(page);
  await page.getByRole('combobox', { name: '时间范围' }).click();
  await page.getByRole('option', { name: '7 天' }).click();
  await page.getByRole('button', { name: '应用' }).click();
  const metrics = page.getByRole('region', { name: '关键指标' }).locator('.metric-card');
  await expect(metrics.nth(3)).toContainText('2');
  await expect(page.locator('.event-list li[data-severity="critical"]').first()).toContainText('紧急告警');
  await expect(metrics.nth(4)).toContainText('—');
  await page.goto('/devices');
  await page.locator('.device-list').getByRole('button', { name: '纽约温湿度三号' }).click();
  await page.getByRole('tab', { name: '告警' }).click();
  await page.getByRole('button', { name: '确认告警' }).click();
  await page.goto('/dashboard');
  await openMobileFilters(page);
  await page.getByRole('combobox', { name: '时间范围' }).click();
  await page.getByRole('option', { name: '7 天' }).click();
  await page.getByRole('button', { name: '应用' }).click();
  await expect(page.getByRole('region', { name: '关键指标' }).locator('.metric-card').nth(3)).toContainText('1');
});

test('IOT-DASH-001 includes a live device message in the event stream', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-20T12:00:00.000Z'));
  await page.goto('/devices');
  await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
  await page.getByRole('tab', { name: '时序数据' }).click();
  await page.getByLabel('实时追加').check();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('iot-atlas-device-messages-v1') || '[]').some((message: { deviceId: string }) => message.deviceId === 'dev_as_001'));
  await page.getByLabel('实时追加').uncheck();
  await page.goto('/dashboard');
  await openMobileFilters(page);
  await page.getByRole('combobox', { name: '时间范围' }).click();
  await page.getByRole('option', { name: '7 天' }).click();
  await page.getByRole('button', { name: '应用' }).click();
  const events = page.locator('.event-list li').filter({ hasText: '● 遥测' }).filter({ hasText: 'dev_as_001' });
  await expect(events).toHaveCount(2);
});

test('IOT-DASH-001 receives Mock messages live and holds new events while paused', async ({ page, context }) => {
  await page.goto('/dashboard?tenant=ten_202609_001&from=2026-09-16T12%3A00%3A00.000Z&to=2026-09-16T15%3A00%3A00.000Z');
  await openMobileFilters(page);
  await expect(page.getByRole('heading', { name: '实时事件' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: '暂停事件' }).click();
  const source = await context.newPage();
  await source.goto('/diagnostics');
  await source.evaluate(() => {
    const message = { id: 'msg_live_dashboard_1', tenantId: 'ten_202609_001', deviceId: 'dev_as_001', productId: 'prod_as_001', occurredAt: '2026-09-16T13:01:00.000Z', kind: 'property', payload: { temperature: 31 } };
    localStorage.setItem('iot-atlas-device-messages-v1', JSON.stringify([message]));
  });
  await expect(page.getByRole('button', { name: '有 1 条新事件，点击回到顶部' })).toBeVisible();
  await expect(page.locator('.event-list time[datetime="2026-09-16T13:01:00.000Z"]')).toHaveCount(0);
  await page.getByRole('button', { name: '有 1 条新事件，点击回到顶部' }).click();
  await expect(page.locator('.event-list time[datetime="2026-09-16T13:01:00.000Z"]')).toBeVisible();
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('iot-atlas-device-messages-v1') ?? '[]');
    saved.push({ id: 'msg_live_dashboard_2', tenantId: 'ten_202609_001', deviceId: 'dev_as_001', productId: 'prod_as_001', occurredAt: '2026-09-16T13:02:00.000Z', kind: 'property', payload: { temperature: 32 } });
    localStorage.setItem('iot-atlas-device-messages-v1', JSON.stringify(saved));
    window.dispatchEvent(new Event('iot-atlas-mock-changed'));
  });
  await expect(page.locator('.event-list time[datetime="2026-09-16T13:02:00.000Z"]')).toBeVisible();
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('iot-atlas-device-messages-v1') ?? '[]');
    for (let index = 0; index < 30; index++) saved.push({ id: `msg_live_scroll_${index}`, tenantId: 'ten_202609_001', deviceId: 'dev_as_001', productId: 'prod_as_001', occurredAt: new Date(Date.parse('2026-09-16T13:10:00.000Z') + index * 60_000).toISOString(), kind: 'property', payload: { temperature: 32 } });
    localStorage.setItem('iot-atlas-device-messages-v1', JSON.stringify(saved));
    window.dispatchEvent(new Event('iot-atlas-mock-changed'));
  });
  await expect(page.locator('.event-list time[datetime="2026-09-16T13:39:00.000Z"]')).toHaveCount(1);
  await page.locator('.event-list').evaluate(list => { list.scrollTop = list.scrollHeight; });
  await expect(page.getByRole('button', { name: '恢复事件' })).toBeVisible();
  await source.close();
});

test('IOT-DASH-001 drills from continent through country to node with the applied range', async ({ page }) => {
  await page.goto('/dashboard?tenant=ten_202609_001&from=2026-09-16T00%3A00%3A00.000Z&to=2026-09-17T00%3A00%3A00.000Z');
  await openMobileFilters(page);
  await expect(page.locator('.region-list').getByRole('button', { name: '亚洲' })).toBeVisible({ timeout: 10_000 });
  await page.locator('.region-list').getByRole('button', { name: '亚洲' }).click();
  await expect(page).toHaveURL(/tenant=ten_202609_001.*from=.*to=.*region=AS/);
  await expect(page.locator('.country-list').getByRole('button', { name: /中国/ })).toBeVisible();
  await page.locator('.country-list').getByRole('button', { name: /中国/ }).click();
  await expect(page.getByRole('dialog', { name: '中国节点详情' })).toContainText('node_cn_001');
  await page.getByRole('dialog', { name: '中国节点详情' }).getByRole('button', { name: /node_cn_001/ }).click();
  await expect(page).toHaveURL(/tenant=ten_202609_001.*from=.*to=.*region=AS.*node=node_cn_001/);
  const nodeDialog = page.getByRole('dialog', { name: 'node_cn_001节点详情' });
  await expect(nodeDialog).toContainText('城市级演示坐标');
  await expect(nodeDialog).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nodeDialog).toHaveCount(0);
  const countryButton = page.locator('.country-list').getByRole('button', { name: /中国/ });
  await expect(countryButton).toBeFocused();
  await countryButton.click();
  await page.getByRole('dialog', { name: '中国节点详情' }).getByRole('button', { name: /node_cn_001/ }).click();
  await page.getByRole('button', { name: '返回国家节点' }).click();
  await expect(page.getByRole('dialog', { name: '中国节点详情' })).toBeVisible();
  await page.getByRole('dialog', { name: '中国节点详情' }).getByRole('button', { name: /node_cn_001/ }).click();
  const deviceLink = page.getByRole('dialog', { name: 'node_cn_001节点详情' }).getByRole('link', { name: /查看设备详情/ }).first();
  const deviceId = (await deviceLink.textContent())?.split(' ·')[0];
  expect(deviceId).toBeTruthy();
  await deviceLink.click();
  await expect(page.getByRole('dialog', { name: '设备详情' })).toContainText(deviceId!);
});


test('IOT-DASH-001 and IOT-GEO-001 keep tenant, UTC range and node level across pages', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/dashboard?tenant=ten_202609_001&from=2026-09-16T00%3A00%3A00.000Z&to=2026-09-17T00%3A00%3A00.000Z');
  await openMobileFilters(page);
  await page.locator('.country-list').getByRole('button', { name: /中国/ }).click();
  await page.getByRole('dialog', { name: '中国节点详情' }).getByRole('button', { name: /node_cn_001/ }).click();
  await page.getByRole('dialog', { name: 'node_cn_001节点详情' }).getByRole('link', { name: '在地理页查看节点' }).click();
  await expect(page).toHaveURL(/\/geography\?tenant=ten_202609_001.*from=.*to=.*continent=AS.*country=CN.*node=node_cn_001/);
  await expect(page.getByRole('heading', { name: '全球节点', exact: true })).toBeVisible();
  await expect(page.getByLabel('租户', { exact: true })).toHaveValue('ten_202609_001');
  await expect(page.getByLabel('时间范围')).toHaveValue('custom');
  await expect(page.getByLabel('开始时间')).toHaveValue('2026-09-16T08:00');
  await expect(page.getByRole('navigation', { name: '地理层级' })).toContainText('亚洲');
  await expect(page.getByRole('navigation', { name: '地理层级' })).toContainText('中国节点');
  await expect(page.locator('.geo-list')).toContainText('dev_as_001');
});


test('IOT-DASH-001 shows query cutoff separately from successful refresh time', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('.metric-card')).toHaveCount(5);
  await expect(page.getByText(/最后更新时间：\d{4}/)).toBeVisible();
  await expect(page.locator('.metric-card').first()).toContainText('统计截至');
  const before = new URL(page.url()).searchParams.toString();
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(page.locator('.metric-card')).toHaveCount(5);
  await expect(page.getByText(/最后更新时间：\d{4}/)).toBeVisible();
  expect(new URL(page.url()).searchParams.toString()).toBe(before);
});


test('IOT-DASH-001 expands the full event history without changing the query', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('.metric-card')).toHaveCount(5);
  const list = page.getByRole('list', { name: '实时事件列表' });
  const originalCount = await list.locator('li').count();
  expect(originalCount).toBeGreaterThan(0);
  const before = new URL(page.url()).searchParams.toString();
  await page.getByRole('button', { name: '查看全部' }).click();
  await expect(page.getByRole('button', { name: '收起事件' })).toHaveAttribute('aria-expanded', 'true');
  await expect(list).toHaveClass(/event-list-all/);
  expect(await list.locator('li').count()).toBe(originalCount);
  expect(new URL(page.url()).searchParams.toString()).toBe(before);
  await page.getByRole('button', { name: '收起事件' }).click();
  await expect(list).not.toHaveClass(/event-list-all/);
});
