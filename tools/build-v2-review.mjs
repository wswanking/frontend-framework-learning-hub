import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Outer review orchestration only. Applications keep their own capture code and assets.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apps = ['react', 'vue', 'angular'];
const manifests = {};
for (const app of apps) {
  const dir = join(root, 'code', 'apps', app, 'reports', 'v2-candidates');
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  if (manifest.status !== 'candidate-unreviewed' || manifest.framework !== app || !Array.isArray(manifest.captures) || manifest.captures.length < 18) throw new Error(`${app}: invalid candidate manifest`);
  const keys = manifest.captures.map(item => `${item.device}/${item.route}`);
  if (new Set(keys).size !== keys.length) throw new Error(`${app}: duplicate candidate route`);
  for (const device of ['desktop', 'mobile']) for (const route of ['dashboard', 'geography', 'products', 'devices', 'rules', 'firmware', 'tenants', 'labs', 'delivery']) {
    if (!keys.includes(`${device}/${route}`)) throw new Error(`${app}: missing ${device}/${route}`);
  }
  for (const item of manifest.captures) {
    const bytes = await readFile(join(dir, item.candidate));
    if (createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw new Error(`${app}: changed candidate ${item.candidate}`);
    await stat(join(root, item.reference));
  }
  manifests[app] = manifest;
}
const keys = manifests.react.captures.map(item => `${item.device}/${item.route}`);
for (const app of apps.slice(1)) {
  if (JSON.stringify(manifests[app].captures.map(item => `${item.device}/${item.route}`)) !== JSON.stringify(keys)) throw new Error(`${app}: route order differs`);
  for (let index = 0; index < keys.length; index++) if (manifests[app].captures[index].reference !== manifests.react.captures[index].reference) throw new Error(`${app}: reference differs at ${keys[index]}`);
}
const rows = manifests.react.captures.map((item, index) => {
  const candidate = app => `../../code/apps/${app}/reports/v2-candidates/${manifests[app].captures[index].candidate}`;
  const img = (src, label) => `<a href="${src}"><img src="${src}" alt="${label}"></a>`;
  return `<tr><th scope="row">${item.device}<br>${item.route}</th><td>${img(`../../${item.reference}`, `V2 ${item.route} 图稿`)}</td>${apps.map(app => `<td>${img(candidate(app), `${app} ${item.route} 候选`)}</td>`).join('')}</tr>`;
}).join('');
const output = join(root, 'reports', 'v2-review');
await mkdir(output, { recursive: true });
await writeFile(join(output, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>IoT Atlas V2 三端视觉候选对照</title><style>body{font:16px/1.5 system-ui,sans-serif;color:#102536;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #9aabb7;padding:8px;vertical-align:top}th{min-width:7rem}img{display:block;width:100%;height:auto}td{width:23%}a:focus-visible{outline:3px solid #b45309}</style><h1>IoT Atlas V2 三端视觉候选对照</h1><p>状态：待人工审核。左侧 V2 图稿为多状态桌面设计稿；候选图包含九个业务页初始状态，大盘筛选、详情、错误和离线状态，地理详情、UTC 时间错误和无权限状态，设备详情与高影响弹窗，固件登记与 OTA 灰度流程，以及交付审核详情、正式发布阻塞清单和材料补正。移动候选须按响应式规格评审。点击图片查看原图。本页不批准任何视觉基准或最终验收。</p><table><thead><tr><th>页面</th><th>V2 图稿</th><th>React</th><th>Vue</th><th>Angular</th></tr></thead><tbody>${rows}</tbody></table></html>\n`);
await writeFile(join(output, 'manifest.json'), `${JSON.stringify({ status: 'candidate-unreviewed', generatedAt: new Date().toISOString(), apps: Object.fromEntries(apps.map(app => [app, { capturedAt: manifests[app].capturedAt, browser: manifests[app].browser, count: manifests[app].captures.length }])) }, null, 2)}\n`);
process.stdout.write(`V2 review sheet: ${join(output, 'index.html')} (${keys.length} rows, ${keys.length * apps.length} app captures); review pending\n`);
