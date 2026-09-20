import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const port = 14103;
const framework = 'angular';
const uiLibraries = ['material', 'bootstrap', 'zorro'];
const browserRoot = 'dist/diagnostics/browser';
const serve = ['scripts/serve.mjs'];
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, serve, { stdio: 'ignore' });
let browser;

async function ready() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Preview server exited before it was ready');
    try { if ((await globalThis.fetch(base)).ok) return; } catch { /* still starting */ }
    await new Promise(done => globalThis.setTimeout(done, 100));
  }
  throw new Error('Preview server did not start');
}
function median(values) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; }
async function assets(page) {
  const names = await page.evaluate(() => globalThis.performance.getEntriesByType('resource').map(entry => entry.name));
  for (const frame of page.frames().filter(frame => frame !== page.mainFrame())) {
    names.push(...await frame.evaluate(() => globalThis.performance.getEntriesByType('resource').map(entry => entry.name)));
  }
  const unique = [...new Set(names.map(name => new URL(name).pathname).filter(name => /\.(js|css)$/.test(name)))];
  let rawBytes = 0, gzipBytes = 0;
  for (const pathname of unique) {
    const data = await readFile(resolve(browserRoot, `.${pathname}`));
    rawBytes += data.length;
    gzipBytes += gzipSync(data, { level: 9 }).length;
  }
  return { rawBytes, gzipBytes, assetCount: unique.length };
}
async function sample(kind, library) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(`${base}/labs`);
  await page.locator('.lab-chart-host[data-rendered-library="echarts"][data-rendered-kind="trend"]').waitFor();
  let elapsedMs;
  if (kind === 'chart') {
    if (library === 'echarts') elapsedMs = await page.evaluate(() => globalThis.performance.now());
    else {
      const start = await page.evaluate(() => globalThis.performance.now());
      await page.getByLabel('实验图表库').selectOption(library);
      await page.locator(`.lab-chart-host[data-rendered-library="${library}"][data-rendered-kind="trend"]`).waitFor();
      elapsedMs = await page.evaluate(startTime => globalThis.performance.now() - startTime, start);
    }
  } else {
    const start = library === uiLibraries[0] ? 0 : await page.evaluate(() => globalThis.performance.now());
    if (library !== uiLibraries[0]) await page.getByLabel('实验 UI 库').selectOption(library);
    if (library === uiLibraries[0] || framework === 'react') await page.locator('.lab-table-wrap tbody tr').first().waitFor();
    else await page.frameLocator('iframe[title="UI 候选组件示例"]').locator('tbody tr').first().waitFor();
    elapsedMs = await page.evaluate(startTime => globalThis.performance.now() - startTime, start);
  }
  const size = await assets(page);
  await context.close();
  return { elapsedMs: Math.round(elapsedMs), ...size };
}
try {
  await ready();
  browser = await chromium.launch({ headless: true });
  const results = {};
  for (const [kind, libraries] of [['chart', ['echarts', 'chartjs', 'd3']], ['ui', uiLibraries]]) {
    for (const library of libraries) {
      const samples = [];
      for (let iteration = 0; iteration < 3; iteration++) samples.push(await sample(kind, library));
      results[`${kind}:${library}`] = { medianMs: median(samples.map(item => item.elapsedMs)), medianRawBytes: median(samples.map(item => item.rawBytes)), medianGzipBytes: median(samples.map(item => item.gzipBytes)), medianAssetCount: median(samples.map(item => item.assetCount)), samples };
    }
  }
  const report = { framework, capturedAt: new Date().toISOString(), node: process.version, browser: browser.version(), conditions: 'production build; local 127.0.0.1 preview; Chromium desktop 1440x900; fresh browser context per sample; 3 samples; median; UI timing starts after default chart is ready; chart timing from navigation for ECharts and selection for others; local JS/CSS resource bytes, gzip level 9', results };
  const rows = Object.entries(results).map(([key, value]) => {
    const [kind, library] = key.split(':');
    const point = library === (kind === 'ui' ? uiLibraries[0] : 'echarts') ? '页面初次渲染' : '切换后渲染';
    return `<tr><th scope="row">${kind === 'ui' ? 'UI' : '图表'} · ${library}</th><td>${point}</td><td>${value.medianMs} ms</td><td>${(value.medianRawBytes / 1024).toFixed(1)} KiB</td><td>${(value.medianGzipBytes / 1024).toFixed(1)} KiB</td><td>${value.medianAssetCount}</td></tr>`;
  }).join('');
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${framework} 实验室测量</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:1000px;margin:auto;padding:24px;color:#102536}table{border-collapse:collapse;width:100%}th,td{border:1px solid #8199a5;padding:8px;text-align:left}thead{background:#e4f1f5}.wrap{overflow-x:auto}</style><main><h1>${framework} 实验室测量</h1><p>采集：${new Date(report.capturedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}（北京时间）；Node ${report.node}；Chromium ${report.browser}。</p><p>生产构建、本机 127.0.0.1 预览、1440×900 桌面视口。每项新建浏览器上下文，采样 3 次取中位数。默认 UI 和 ECharts 时间从页面导航开始；其余时间从切换开始。字节数为该场景全部实际请求的本地 JS/CSS 资源去重后合计，gzip 为构建文件以 9 级压缩的估算，不是组件库单包大小或网络传输记录。</p><p>切换场景会先加载默认 ECharts；初次渲染与切换时间不能直接排行。结果受设备负载、浏览器缓存策略与构建变化影响；细节见 <a href="lab-metrics.json">原始采样 JSON</a>。</p><div class="wrap"><table><thead><tr><th scope="col">场景</th><th scope="col">计时点</th><th scope="col">中位时间</th><th scope="col">JS/CSS 原始合计</th><th scope="col">gzip 估算合计</th><th scope="col">资源数</th></tr></thead><tbody>${rows}</tbody></table></div></main></html>
`;
  await mkdir('reports', { recursive: true });
  await mkdir('docs', { recursive: true });
  await mkdir('public/source', { recursive: true });
  await mkdir(`${browserRoot}/source`, { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  for (const path of ['reports/lab-metrics.json', 'docs/lab-metrics.json', 'public/source/lab-metrics.json', `${browserRoot}/source/lab-metrics.json`]) await writeFile(path, json);
  for (const path of ['docs/lab-metrics.html', 'public/source/lab-metrics.html', `${browserRoot}/source/lab-metrics.html`]) await writeFile(path, html);
  process.stdout.write(`${framework}: ${Object.entries(results).map(([key, value]) => `${key} ${value.medianMs}ms ${value.medianGzipBytes} gzip bytes`).join('; ')}\n`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
