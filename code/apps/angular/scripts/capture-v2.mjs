import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// IOT-QUALITY-001: candidate screenshots only; visual approval stays with the reviewer.
const framework = JSON.parse(await readFile('package.json', 'utf8')).name.split('/').at(-1);
const port = { react: 14101, vue: 14102, angular: 14103 }[framework];
if (!port) throw new Error('Unknown application preview port');
const base = `http://127.0.0.1:${port}`;
const output = 'reports/v2-candidates';
const pages = [
  ['dashboard', '全球设备运行态势', '02-dashboard.png'],
  ['geography', '全球节点', '03-global-topology.png'],
  ['products', '产品与物模型', '04-product-thingmodel-dp.png'],
  ['devices', '设备中心', '05-device-telemetry-control.png'],
  ['rules', '规则引擎', '06-rule-engine.png'],
  ['firmware', '固件与 OTA', '07-firmware-ota.png'],
  ['tenants', '租户管理', '08-tenant-management.png'],
  ['labs', '组件与图表实验室', '09-framework-labs.png'],
  ['delivery', '交付看板', '10-delivery-board.png'],
];
const viewports = [['desktop', 1440, 900], ['mobile', 390, 844]];
const server = spawn('npm', ['run', 'preview'], { stdio: 'ignore' });
let browser;

async function chooseDashboardFilter(page, name, option, nativeValue) {
  const input = page.getByRole('combobox', { name });
  if (framework === 'angular') await input.selectOption(nativeValue);
  else {
    if (framework === 'vue') { await input.focus(); await input.press('Enter'); }
    else await input.click();
    await page.getByRole('option', { name: option }).click();
  }
}

async function ready() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Preview server exited before capture');
    try { if ((await globalThis.fetch(base)).ok) return; } catch { /* Starting. */ }
    await new Promise(done => globalThis.setTimeout(done, 100));
  }
  throw new Error('Preview server did not become ready');
}

try {
  await ready();
  browser = await chromium.launch({ headless: true });
  const captures = [];
  async function saveCandidate(page, device, width, height, route, title, reference) {
    await page.waitForTimeout(350);
    const candidate = `${device}/${route}.png`;
    const viewportOnly = ['products-new', 'devices-create', 'devices-import', 'devices-delete', 'devices-control-preview', 'devices-control-error', 'ota-start-confirm', 'delivery-release-blocked', 'delivery-release-checklist', 'delivery-release-edit'].includes(route);
    const bytes = await page.screenshot({ path: `${output}/${candidate}`, fullPage: !viewportOnly, animations: 'disabled' });
    captures.push({ device, route, viewport: { width, height }, title, candidate, reference: `docs/interaction/assets/interaction-v2/${reference}`, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  for (const [device, width, height] of viewports) {
    await mkdir(`${output}/${device}`, { recursive: true });
    for (const [route, title, reference] of pages) {
      const context = await browser.newContext({ viewport: { width, height }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        const page = await context.newPage();
        await page.goto(`${base}/${route}`);
        await page.getByRole('heading', { level: 1, name: title, exact: true }).waitFor({ timeout: 15000 });
        await page.evaluate(() => globalThis.document.fonts.ready);
        await saveCandidate(page, device, width, height, route, title, reference);
        if (route === 'dashboard') {
          const metric = page.getByRole('region', { name: '关键指标' }).locator('.metric-card').first();
          await expect(metric).toContainText('12');
          if (width <= 720) await page.getByRole('button', { name: /筛选条件（展开）/ }).click();
          await chooseDashboardFilter(page, '租户', '华东智联', 'ten_202609_001');
          await chooseDashboardFilter(page, '时间范围', '7 天', '7d');
          await chooseDashboardFilter(page, '地域', '亚洲', 'AS');
          await expect(metric).toContainText('12');
          await saveCandidate(page, device, width, height, 'dashboard-draft', '筛选草稿未应用', reference);
          await page.getByRole('button', { name: '应用' }).click();
          await expect(metric).toContainText('1');
          await expect(page.locator('.country-list')).toContainText('中国');
          await saveCandidate(page, device, width, height, 'dashboard-applied', '筛选已应用', reference);
          await page.locator('.country-list').getByRole('button', { name: /中国/ }).click();
          await expect(page.getByRole('dialog', { name: '中国节点详情' })).toContainText('node_cn_001');
          await saveCandidate(page, device, width, height, 'dashboard-drawer', '国家节点详情', reference);
          await page.goto(`${base}/dashboard`);
          await expect(metric).toContainText('12');
          if (width <= 720) await page.getByRole('button', { name: /筛选条件（展开）/ }).click();
          await chooseDashboardFilter(page, '时间范围', '自定义', 'custom');
          await page.getByLabel('开始时间').fill('2026-09-17T08:00');
          await page.getByLabel('结束时间').fill('2026-09-16T08:00');
          await page.getByRole('button', { name: '应用' }).click();
          await expect(page.locator('#dashboard-range-error')).toBeVisible();
          await expect(page.getByLabel('结束时间')).toBeFocused();
          await saveCandidate(page, device, width, height, 'dashboard-invalid-range', '自定义时间校验失败', reference);
          await page.goto(`${base}/dashboard`);
          await expect(metric).toContainText('12');
          if (width <= 720) await page.getByRole('button', { name: /筛选条件（展开）/ }).click();
          await page.getByText('演示状态').click();
          await page.getByLabel('Mock 场景').selectOption('partialFailure');
          await expect(page.getByRole('alert')).toContainText('地图分区暂不可用');
          await expect(metric).toContainText('12');
          await saveCandidate(page, device, width, height, 'dashboard-partial-failure', '地图局部失败', reference);
          await page.getByLabel('Mock 场景').selectOption('offline');
          await expect(page.getByRole('alert')).toContainText('非最新');
          await expect(metric).toContainText('12');
          await saveCandidate(page, device, width, height, 'dashboard-offline', '离线保留旧数据', reference);
        }
        if (route === 'geography') {
          await expect(page.locator('.geo-summary')).toContainText('12');
          await page.locator('.geo-unlocated').getByRole('button', { name: 'dev_oc_002' }).click();
          const drawer = page.getByRole('dialog', { name: 'dev_oc_002详情' });
          await expect(drawer).toBeFocused();
          await saveCandidate(page, device, width, height, 'geography-drawer', '未定位设备详情', reference);
          await page.keyboard.press('Escape');
          await page.getByLabel('时间范围').selectOption('custom');
          await page.getByLabel('开始时间').fill('2026-09-17T08:00');
          await page.getByLabel('结束时间').fill('2026-09-16T08:00');
          await page.getByRole('button', { name: '应用' }).click();
          await expect(page.locator('#geo-range-error')).toBeVisible();
          await expect(page.getByLabel('结束时间')).toBeFocused();
          await saveCandidate(page, device, width, height, 'geography-invalid-range', '地理 UTC 时间校验失败', reference);
          await page.goto(`${base}/geography`);
          await expect(page.locator('.geo-summary')).toContainText('12');
          await page.getByText('演示状态').click();
          await page.getByLabel('Mock 场景').selectOption('forbidden');
          await expect(page.getByRole('alert')).toContainText('无权查看该租户数据');
          await expect(page.locator('.geo-summary')).toHaveCount(0);
          await saveCandidate(page, device, width, height, 'geography-forbidden', '无权限清空旧地理数据', reference);
        }
        if (route === 'delivery') {
          await page.getByRole('button', { name: /REVIEW-003.*领域契约与业务交互审核/ }).first().click();
          await expect(page.locator('.delivery-detail')).toContainText('REVIEW-003');
          await saveCandidate(page, device, width, height, 'delivery-review-detail', '待审核材料详情', reference);
          await page.getByLabel('模拟治理身份').selectOption('releaseLead');
          await page.getByRole('button', { name: '创建发布记录' }).click();
          await page.getByLabel('交付标题').fill('V2 候选发布记录');
          await page.getByLabel('发布环境').selectOption('production');
          await page.getByLabel('目标版本', { exact: true }).fill('v0.2.0');
          await page.getByLabel('发布关联需求', { exact: true }).selectOption('IOT-TENANT-001');
          await expect(page.getByRole('region', { name: '阻塞检查项' })).toContainText('REVIEW-005');
          await saveCandidate(page, device, width, height, 'delivery-release-blocked', '正式发布阻塞清单', reference);
          await page.locator('.delivery-modal').evaluate(element => { element.scrollTop = element.scrollHeight; });
          await expect(page.getByRole('region', { name: '阻塞检查项' })).toBeVisible();
          await saveCandidate(page, device, width, height, 'delivery-release-checklist', '正式发布阻塞清单与底部操作', reference);
          await page.getByRole('button', { name: '保存模拟记录' }).click();
          await expect(page.locator('.delivery-detail')).toContainText('缺少回滚步骤或上一已验证版本');
          await saveCandidate(page, device, width, height, 'delivery-release-detail', '阻塞发布记录详情', reference);
          await page.getByRole('button', { name: '补齐发布材料' }).click();
          await expect(page.getByRole('dialog', { name: '编辑发布记录' })).toBeVisible();
          await saveCandidate(page, device, width, height, 'delivery-release-edit', '发布材料补正', reference);
        }
        if (route === 'products') {
          await page.goto(`${base}/tenants`);
          await page.getByRole('button', { name: '华东智联' }).click();
          await page.getByRole('button', { name: '配额', exact: true }).click();
          await page.getByRole('button', { name: '编辑配额' }).click();
          await page.getByLabel('产品上限', { exact: true }).fill('3');
          await page.getByRole('button', { name: '预览影响' }).click();
          await page.getByRole('button', { name: '保存配额' }).click();
          await page.goto(`${base}/products`);
          await page.getByRole('button', { name: '新建产品' }).click();
          await expect(page.getByRole('dialog', { name: '产品详情' }).getByRole('status').filter({ hasText: '产品配额' })).toContainText('保存后达到 80% 预警阈值');
          await saveCandidate(page, device, width, height, 'products-new', '新建产品与配额预警', reference);
        }
        if (route === 'firmware') {
          await page.getByRole('button', { name: '新建固件' }).click();
          await page.getByLabel('本地固件文件').setInputFiles({ name: 'review-sensor.bin', mimeType: 'application/octet-stream', buffer: Buffer.from('v2 candidate firmware') });
          await expect(page.locator('.firmware-form [role="status"]')).toContainText('校验完成');
          await page.getByRole('button', { name: '下一步' }).click();
          await page.getByLabel('固件名称').fill('sensor-core');
          await page.getByLabel('固件版本号').fill('2.5.0');
          await saveCandidate(page, device, width, height, 'firmware-new', '新建固件元数据与校验', reference);
          await page.goto(`${base}/firmware`);
          await page.getByRole('button', { name: 'OTA 任务' }).click();
          await page.getByRole('button', { name: '创建 OTA 任务' }).click();
          await page.getByLabel('OTA 固件').selectOption('fw_as_001');
          await page.getByRole('button', { name: '下一步' }).click();
          await page.locator('.ota-devices label').filter({ hasText: '上海温湿度一号' }).getByRole('checkbox').check();
          await page.locator('.ota-devices label').filter({ hasText: '柏林温湿度二号' }).getByRole('checkbox').check();
          await saveCandidate(page, device, width, height, 'ota-targets', 'OTA 目标设备选择', reference);
          await page.getByRole('button', { name: '下一步' }).click();
          await page.getByLabel('灰度批次').fill('50,50');
          await page.getByLabel('失败阈值').fill('20');
          await page.getByLabel('模拟失败设备').selectOption('dev_as_001');
          await page.getByRole('button', { name: '影响预览' }).click();
          await expect(page.locator('.ota-panel').last()).toContainText('第 1 批 1 台');
          await saveCandidate(page, device, width, height, 'ota-preview', 'OTA 灰度影响预览', reference);
          await page.getByRole('button', { name: '下一步' }).click();
          await page.getByRole('button', { name: '确认创建' }).click();
          await expect(page.locator('.ota-panel').last().getByRole('heading', { name: /ota_new_/ })).toBeVisible();
          await saveCandidate(page, device, width, height, 'ota-task-draft', 'OTA 任务详情与版本分布', reference);
          await page.getByRole('button', { name: '开始', exact: true }).click();
          await expect(page.getByRole('dialog', { name: '风险操作确认' })).toBeVisible();
          await saveCandidate(page, device, width, height, 'ota-start-confirm', 'OTA 开始操作风险确认', reference);
          await page.getByRole('dialog', { name: '风险操作确认' }).getByRole('button', { name: '确认' }).click();
          await expect(page.getByRole('alert')).toContainText('自动暂停', { timeout: 12000 });
          await saveCandidate(page, device, width, height, 'ota-task-paused', 'OTA 灰度失败自动暂停', reference);
        }
        if (route === 'devices') {
          await page.locator('.device-list').getByRole('button', { name: '上海温湿度一号' }).click();
          await expect(page.getByRole('dialog', { name: '设备详情' })).toContainText('dev_as_001');
          await saveCandidate(page, device, width, height, 'devices-drawer', '设备详情', reference);
          await page.getByRole('tab', { name: '时序数据' }).click();
          await expect(page.getByRole('tabpanel').locator('.device-chart')).toHaveCount(2);
          await saveCandidate(page, device, width, height, 'devices-telemetry', '双指标时序与缺失提示', reference);
          await page.getByRole('tab', { name: '实时属性' }).click();
          await page.getByLabel('控制命令').selectOption('tm_sampling_interval');
          await page.getByLabel('控制参数').fill('100');
          await page.getByRole('button', { name: '预览命令' }).click();
          await expect(page.getByRole('dialog', { name: '控制预览' })).toContainText('100');
          await saveCandidate(page, device, width, height, 'devices-control-preview', '控制命令预览', reference);
          await page.getByRole('dialog', { name: '控制预览' }).getByRole('button', { name: '取消' }).click();
          await page.getByLabel('控制参数').fill('1001');
          await page.getByRole('button', { name: '预览命令' }).click();
          const preview = page.getByRole('dialog', { name: '控制预览' });
          await preview.getByRole('button', { name: '发送命令' }).click();
          await expect(preview.getByRole('alert')).toContainText('命令参数无效');
          await saveCandidate(page, device, width, height, 'devices-control-error', '控制参数被服务拒绝', reference);
          await page.goto(`${base}/devices`);
          await page.getByRole('button', { name: '新建设备' }).click();
          const createDialog = page.getByRole('dialog', { name: '新建设备' });
          await expect(createDialog).toBeFocused();
          await saveCandidate(page, device, width, height, 'devices-create', '设备登记确认', reference);
          await createDialog.getByRole('button', { name: '取消' }).click();
          await page.getByRole('button', { name: 'CSV 导入' }).click();
          const importDialog = page.getByRole('dialog', { name: 'CSV 导入设备' });
          await expect(importDialog).toBeFocused();
          await saveCandidate(page, device, width, height, 'devices-import', '设备 CSV 导入', reference);
          await importDialog.getByRole('button', { name: '取消' }).click();
          await page.locator('.device-list tbody tr').first().locator('input[type="checkbox"]').check();
          await page.getByRole('button', { name: '批量删除' }).click();
          const deleteDialog = page.getByRole('dialog', { name: '确认删除设备' });
          await expect(deleteDialog).toBeFocused();
          await saveCandidate(page, device, width, height, 'devices-delete', '批量删除影响确认', reference);
        }
      } finally { await context.close(); }
    }
  }
  const manifest = { status: 'candidate-unreviewed', framework, capturedAt: new Date().toISOString(), node: process.version, browser: browser.version(), build: 'current local production dist', captures };
  await writeFile(`${output}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  const rows = captures.map(item => `<tr><th>${item.device} / ${item.route}</th><td><img src="${item.candidate}" alt="${framework} ${item.route} ${item.device} 候选截图"></td><td><code>${item.reference}</code></td></tr>`).join('');
  await writeFile(`${output}/index.html`, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${framework} V2 候选截图</title><style>body{font:16px/1.5 system-ui,sans-serif;color:#122334;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #9aabb7;padding:8px;vertical-align:top}th{width:12rem}img{width:100%;max-width:720px;height:auto}td{width:45%}</style><h1>${framework} V2 候选截图</h1><p>本机生产构建截图，状态：待人工审核。参考图稿为桌面设计稿，移动截图需依照响应式交互规格评审。原始哈希与环境见 <a href="manifest.json">manifest.json</a>。</p><table><thead><tr><th>页面</th><th>运行态候选</th><th>中央 V2 图稿路径</th></tr></thead><tbody>${rows}</tbody></table></html>\n`);
  process.stdout.write(`${framework}: ${captures.length} V2 candidate screenshots in ${resolve(output)}; review pending\n`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
