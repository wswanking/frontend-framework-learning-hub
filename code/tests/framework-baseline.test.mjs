import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const cases = [
  ["React", "../apps/react/src/main.tsx", "@mui/material"],
  ["Vue", "../apps/vue/src/dashboard.ts", "element-plus"],
  ["Angular", "../apps/angular/src/main.ts", "@angular/material"],
];

const labCases = [
  ["React", "../apps/react/src/labs.tsx", ["@mui/material", "antd", "shadcn"]],
  ["Vue", "../apps/vue/src/labs.ts", ["element-plus", "ant-design-vue", "vuetify"]],
  ["Angular", "../apps/angular/src/labs.ts", ["@angular/material", "primeng", "ng-zorro-antd"]],
];

for (const [name, path, library] of cases) {
  test(`${name} baseline uses the shared deterministic contract and primary UI library`, async () => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /createMockApi/);
    assert.match(source, /seed:\s*20260829/);
    assert.ok(source.includes(library));
  });
}

for (const [name, path] of cases) {
  test(`${name} offline map projects deterministic device coordinates without online tiles`, async () => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /offline-map/);
    assert.match(source, /node-point/);
    assert.match(source, /deviceCount/);
    assert.match(source, /location.*longitude/);
    assert.match(source, /地图完全离线/);
    assert.doesNotMatch(source, /mapbox|leaflet|googleapis|tile\.openstreetmap/i);
  });
}

for (const [name, path] of cases) {
  test(`${name} dashboard exposes shared filters, complete metrics, event controls, and distinct states`, async () => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const marker of ["onlineRate", "otaSuccessRate", "comparisons", "updatedAt", "ranking", "trend", "alarmDistribution", "partialFailure", "forbidden", "offline", "空数据", "暂停", "恢复", "已接收事件仍保留"])
      assert.match(source, new RegExp(marker));
  });
}

for (const [name, path, libraries] of labCases) {
  test(`${name} lab compares three UI libraries and three chart engines with fixed data`, async () => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const marker of [...libraries, "echarts", "chart.js", "d3", "20260829", "柱状图", "趋势图", "饼图", "API", "体积"]) {
      assert.match(source, new RegExp(marker, "i"));
    }
  });
}

test("framework builds remain independently addressable", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  for (const framework of ["react", "vue", "angular"]) {
    const script = packageJson.scripts[`build:${framework}`];
    assert.match(script, new RegExp(`apps/${framework}/vite\\.config\\.ts`));
    for (const other of ["react", "vue", "angular"].filter((item) => item !== framework)) {
      assert.doesNotMatch(script, new RegExp(`apps/${other}/`));
    }
  }
});

test("portal stages independently navigable framework production builds", async () => {
  for (const framework of ["react", "vue", "angular"]) {
    const html = await readFile(new URL(`../public/frameworks/${framework}/index.html`, import.meta.url), "utf8");
    const config = await readFile(new URL(`../apps/${framework}/vite.config.ts`, import.meta.url), "utf8");
    assert.match(html, /\.\/assets\//);
    assert.match(config, /base:\s*"\.\/"/);
  }
  const reactSource = await readFile(new URL("../apps/react/src/main.tsx", import.meta.url), "utf8");
  const portalSource = await readFile(new URL("../app/dashboard-shell.tsx", import.meta.url), "utf8");
  assert.match(reactSource, /HashRouter/);
  for (const framework of ["react", "vue", "angular"]) assert.match(portalSource, new RegExp(`/frameworks/${framework}/index\\.html`));
});

test("staged framework JavaScript is syntactically executable", async () => {
  for (const framework of ["react", "vue", "angular"]) {
    const assetsDirectory = new URL(`../public/frameworks/${framework}/assets/`, import.meta.url);
    const bundles = (await readdir(assetsDirectory)).filter((file) => file.endsWith(".js"));
    assert.ok(bundles.length > 0, `${framework} should emit at least one JavaScript bundle`);
    for (const bundle of bundles) {
      const result = spawnSync(process.execPath, ["--check", fileURLToPath(new URL(bundle, assetsDirectory))], { encoding: "utf8" });
      assert.equal(result.status, 0, `${framework}/${bundle} is invalid JavaScript:\n${result.stderr}`);
    }
  }
});

test("Angular inline templates pass the Angular compiler parser", async () => {
  const { parseTemplate } = await import("@angular/compiler");
  for (const sourcePath of ["../apps/angular/src/main.ts", "../apps/angular/src/labs.ts"]) {
    const source = await readFile(new URL(sourcePath, import.meta.url), "utf8");
    const templates = [...source.matchAll(/template:\s*`([\s\S]*?)`/g)].map((match) => match[1]);
    assert.ok(templates.length > 0, `${sourcePath} should contain an inline Angular template`);
    for (const [index, template] of templates.entries()) {
      const errors = parseTemplate(template, `${sourcePath}#${index}`).errors ?? [];
      assert.equal(errors.length, 0, errors.map((error) => error.toString()).join("\n\n"));
    }
  }
});

test("React product workbench exposes query, model validation, JSON preview, dirty state, and DP steps", async () => {
  const source = await readFile(new URL("../apps/react/src/main.tsx", import.meta.url), "utf8");
  for (const marker of ["queryProducts", "saveThingModelProperty", "testDpRule", "物模型 JSON 预览", "存在未保存变更", "steps.map"]) assert.match(source, new RegExp(marker));
});

test("Vue product workbench uses shared model save and exposes dirty state and JSON preview", async () => {
  const source = await readFile(new URL("../apps/vue/src/dashboard.ts", import.meta.url), "utf8");
  assert.match(source, /ProductWorkbench/);
  assert.match(source, /saveThingModelProperty/);
  assert.match(source, /存在未保存变更/);
  assert.match(source, /物模型 JSON 预览/);
});

test("Angular product workbench exposes tabs, shared model save, dirty state, JSON preview, and DP steps", async () => {
  const source = await readFile(new URL("../apps/angular/src/main.ts", import.meta.url), "utf8");
  assert.match(source, /productTab/);
  assert.match(source, /saveThingModelProperty/);
  assert.match(source, /productDirty/);
  assert.match(source, /物模型 JSON 预览/);
  assert.match(source, /testProductDp/);
  assert.match(source, /productDpSteps/);
});

for (const [name, path] of cases) {
  test(`${name} topology UI exposes filtering, drill-down, unlocated devices, and details`, async () => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /continent/);
    assert.match(source, /nodeId/);
    assert.match(source, /unlocatedDevices/);
    assert.match(source, /selected(?:Device|Id)/);
    assert.match(source, /离线地图替代视图/);
  });
}

for (const [name, path] of cases) {
  test(`${name} device diagnostics expose consistent operational views and command states`, async () => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const marker of ["queryTelemetrySeries", "listDeviceMessages", "listDeviceAlarms", "shadow", "quality", "控制命令失败", "设备尚未定位"]) {
      assert.match(source, new RegExp(marker));
    }
  });
}

for (const [name, path] of cases) {
  test(`${name} device UI exposes the complete list and telemetry interaction contract`, async () => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const marker of ["activeAfter", "sortBy", "pageSize", "搜索设备", "产品筛选", "状态筛选", "地域筛选", "标签筛选", "批量选择", "granularity", "采样粒度", "缩放", "实时追加", "导出 CSV", "text/csv"])
      assert.match(source, new RegExp(marker));
  });
}

for (const [name, path] of cases) {
  test(`${name} tenant workbench exposes members, roles, quotas, isolation, and viewer state`, async () => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const marker of ["getTenantDetail", "previewRole", "inviteTenantMember", "updateTenantMember", "simulateCreateDevice", "观察员仅可查看", "quota"]) {
      assert.match(source, new RegExp(marker, "i"));
    }
  });
}

for (const [name, path] of cases) {
  test(`${name} rule workbench exposes graph validation, trace details, toggles, and filtered logs`, async () => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const marker of ["listRules", "saveRuleFlow", "toggleRule", "testRuleFlow", "consumeRuleEvent", "listRuleLogs", "版本备注", "环路", "durationMs", "failureReason"]) {
      assert.match(source, new RegExp(marker));
    }
  });
}

for (const [name, path] of cases) {
  test(`${name} firmware workbench exposes browser hashing, metadata, compatibility, history, and reference protection`, async () => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const marker of ["SHA-256", "registerFirmware", "compareFirmwareVersions", "setFirmwareStatus", "deleteFirmware", "compatibleProductIds", "referencedOtaIds", "固件元数据预览"]) {
      assert.match(source, new RegExp(marker));
    }
  });
}

for (const [name, path] of cases) {
  test(`${name} OTA workbench exposes wizard, gray batches, threshold pause, retries, logs, and confirmed rollback`, async () => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const marker of ["createOtaPlan", "startOrContinueOta", "advanceOtaBatch", "pauseOtaTask", "retryFailedOtaDevices", "cancelOtaTask", "rollbackOtaTask", "失败阈值", "影响预览", "版本分布", "再次点击确认"]) {
      assert.match(source, new RegExp(marker));
    }
  });
}
