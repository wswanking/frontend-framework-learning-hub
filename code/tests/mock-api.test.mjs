import assert from "node:assert/strict";
import test from "node:test";

// This test runs against the compiled TypeScript through the existing build step.
// The package entry is intentionally framework-free and is imported by all three apps.
const source = await import("../packages/mock-api/index.ts");
const domain = await import("../packages/domain/index.ts");

const baseContext = { actorId: "usr_001", role: "tenantAdmin", tenantId: "ten_cn_001", seed: 20260829 };
const query = { tenantId: "ten_cn_001", seed: 20260829, from: "2026-08-28T00:00:00.000Z", to: "2026-08-29T00:00:00.000Z" };

test("Mock API is deterministic for a fixed seed and query", () => {
  const first = source.createMockApi(baseContext).getDashboard(query);
  const second = source.createMockApi(baseContext).getDashboard(query);
  assert.deepEqual(first, second);
  const filtered = source.createMockApi(baseContext).getDashboard({ ...query, region: first.data.regions[0].continent });
  if ("data" in filtered) {
    assert.ok(filtered.data.metrics.connectedDevices <= first.data.metrics.connectedDevices);
    assert.deepEqual(filtered.data.regions.map(item => item.continent), [first.data.regions[0].continent]);
  } else {
    assert.fail(filtered.error.message);
  }
});

test("Dashboard uses one query for metrics, rankings, trends, alarms, and newest-first events", () => {
  const api = source.createMockApi(baseContext);
  const day = api.getDashboard(query).data;
  const week = api.getDashboard({ ...query, from: "2026-08-22T00:00:00.000Z" }).data;
  assert.equal(day.metrics.messageCount, day.regions.reduce((sum, item) => sum + item.messages, 0));
  assert.equal(day.metrics.messageCount, day.ranking.reduce((sum, item) => sum + item.messages, 0));
  assert.ok(week.metrics.messageCount > day.metrics.messageCount);
  assert.equal(day.trend.length, 8);
  assert.deepEqual(day.alarmDistribution.map(item => item.severity), ["info", "warning", "critical"]);
  assert.ok(day.events.every((item, index) => index === 0 || item.occurredAt <= day.events[index - 1].occurredAt));
  assert.ok(day.events.every(item => ["info", "warning", "critical"].includes(item.severity)));
  const empty = api.getDashboard({ ...query, region: "不存在地域" }).data;
  assert.equal(empty.metrics.onlineRate, null);
  assert.equal(empty.metrics.otaSuccessRate, null);
});

test("Shared domain validates UTC timestamps", () => {
  assert.equal(domain.validateIsoUtc("2026-08-30T00:00:00.000Z"), undefined);
  assert.equal(domain.validateIsoUtc("2026-08-30 00:00:00").code, "VALIDATION_ERROR");
});

test("Mock API enforces tenant isolation and role permissions", () => {
  const api = source.createMockApi({ ...baseContext, role: "viewer" });
  assert.equal(api.getDashboard({ ...query, tenantId: "ten_de_002" }).error?.code, "FORBIDDEN");
  const device = api.listDevices({ tenantId: baseContext.tenantId, seed: baseContext.seed }).data?.items[0];
  assert.ok(device);
  assert.equal(api.controlDevice(device.id).error?.code, "FORBIDDEN");
  assert.equal(api.getDevice("dev_de_001").error?.code, "FORBIDDEN");
});

test("Mock API returns documented validation and offline errors", () => {
  const api = source.createMockApi(baseContext);
  assert.equal(api.listDevices({ tenantId: baseContext.tenantId, seed: baseContext.seed, page: 0 }).error?.code, "VALIDATION_ERROR");
  const offline = source.createMockApi({ ...baseContext, scenario: "offline" });
  const device = offline.listDevices({ tenantId: baseContext.tenantId, seed: baseContext.seed }).data?.items[0];
  assert.equal(offline.controlDevice(device.id).data?.status, "failed");
   assert.equal(offline.controlDevice(device.id).data?.reason, "DEVICE_OFFLINE");
  assert.equal(source.createMockApi({ ...baseContext, scenario: "partialFailure" }).getDashboard(query).error?.code, "PARTIAL_FAILURE");
  const empty = api.listDevices({ tenantId: baseContext.tenantId, seed: baseContext.seed, keyword: "does-not-exist" }).data;
  assert.deepEqual(empty?.items, []);
  assert.equal(empty?.total, 0);
  assert.equal(api.getDevice("unknown").error?.code, "NOT_FOUND");
});

test("Mock API covers product, rule, firmware, OTA and tenant service contracts", () => {
  const api = source.createMockApi(baseContext);
  const product = api.listProducts(baseContext.tenantId).data?.[0];
  assert.ok(product);
  assert.equal(api.saveDpRule(product.id, { identifier: "temperature", scale: 0, offset: 0, precision: 1 }).error?.code, "VALIDATION_ERROR");
  assert.equal(api.saveDpRule(product.id, { identifier: "temperature", scale: 0.1, offset: 0, precision: 1 }).data?.preview, 2.5);
  assert.equal(api.testRuleFlow(baseContext.tenantId, { temperature: 25 }).data?.status, "succeeded");
  const firmware = api.listFirmware(baseContext.tenantId).data?.[0];
  const target = api.listDevices({ tenantId: baseContext.tenantId, seed: baseContext.seed }).data?.items.find(item => item.productId === firmware?.productId);
  assert.ok(firmware && target);
  assert.equal(api.createOtaTask(baseContext.tenantId, firmware.id, [target.id]).data?.status, "queued");
  assert.equal(api.listTenants().error?.code, "FORBIDDEN");
  assert.equal(source.createMockApi({ ...baseContext, role: "platformAdmin" }).listTenants().data?.length, 2);
});

test("Firmware contracts validate metadata, uniqueness, checksum, compatibility, and OTA references", () => {
  const api = source.createMockApi(baseContext);
  const products = api.listProducts(baseContext.tenantId).data;
  const existing = api.listFirmware(baseContext.tenantId).data;
  const released = existing.find(item => item.status === "released");
  const invalid = existing.find(item => item.checksumStatus === "invalid");
  const compatibleDevice = api.listDevices({ tenantId: baseContext.tenantId, seed: baseContext.seed, productId: released.productId }).data.items[0];
  assert.equal(api.registerFirmware({ tenantId: baseContext.tenantId, productId: released.productId, version: released.version, fileName: "duplicate.bin", fileType: "application/octet-stream", sizeBytes: 1024, checksum: "b".repeat(64), description: "重复", compatibleProductIds: [released.productId] }).error?.code, "CONFLICT");
  assert.equal(api.registerFirmware({ tenantId: baseContext.tenantId, productId: released.productId, version: "2.0.0", fileName: "large.bin", fileType: "application/octet-stream", sizeBytes: 21 * 1024 * 1024, checksum: "b".repeat(64), description: "过大", compatibleProductIds: [released.productId] }).error?.code, "VALIDATION_ERROR");
  const created = api.registerFirmware({ tenantId: baseContext.tenantId, productId: released.productId, version: "2.0.0", fileName: "next.bin", fileType: "application/octet-stream", sizeBytes: 2048, checksum: "b".repeat(64), description: "新版", compatibleProductIds: [released.productId] }).data;
  assert.equal(created.checksumStatus, "valid");
  assert.equal(api.compareFirmwareVersions(released.productId).data[0].version, "2.0.0");
  assert.equal(api.createOtaTask(baseContext.tenantId, invalid.id, [compatibleDevice.id]).error?.code, "CHECKSUM_FAILED");
  assert.equal(api.deleteFirmware(released.id).error?.code, "FIRMWARE_IN_USE");
  assert.match(api.setFirmwareStatus(released.id, "archived").error?.message ?? "", /ota_active_001/);
  assert.equal(api.registerFirmware({ tenantId: baseContext.tenantId, productId: products[0].id, version: "2.1.0", fileName: "bad.bin", fileType: "application/octet-stream", sizeBytes: 1024, checksum: "b".repeat(64), description: "不兼容", compatibleProductIds: ["prd_foreign"] }).error?.code, "INCOMPATIBLE_PRODUCT");
  const viewer = source.createMockApi({ ...baseContext, role: "viewer" });
  assert.equal(viewer.deleteFirmware(released.id).error?.code, "FORBIDDEN");
});

test("OTA contracts sequence gray batches, pause above threshold, retain retries, and create immutable rollback", () => {
  const api = source.createMockApi(baseContext);
  const firmware = api.listFirmware(baseContext.tenantId).data.find(item => item.status === "released" && item.checksumStatus === "valid");
  const targets = api.listDevices({ tenantId: baseContext.tenantId, seed: baseContext.seed, productId: firmware.productId, pageSize: 100 }).data.items;
  const created = api.createOtaPlan({ tenantId: baseContext.tenantId, firmwareId: firmware.id, targetDeviceIds: targets.map(item => item.id), batchPercent: 10, failureThresholdPercent: 20 }).data;
  assert.equal(created.status, "queued");
  assert.ok(created.batches.length > 1);
  assert.equal(api.startOrContinueOta(created.id).data.status, "running");
  const paused = api.advanceOtaBatch(created.id, 100).data;
  assert.equal(paused.status, "paused");
  assert.match(paused.alertId, /threshold/);
  assert.equal(paused.batches[1].status, "pending");
  const failedProgress = paused.devices.find(item => item.stage === "failed");
  assert.equal(failedProgress.attempts.length, 1);
  const retried = api.retryFailedOtaDevices(created.id).data;
  assert.equal(retried.devices.find(item => item.deviceId === failedProgress.deviceId).attempts.length, 2);
  assert.equal(retried.devices.find(item => item.deviceId === failedProgress.deviceId).attempts[0].status, "failed");

  const originalBeforeRollback = JSON.stringify(api.getOtaTask(created.id).data);
  assert.equal(api.rollbackOtaTask(created.id, false).error?.code, "IMPACT_CONFIRMATION_REQUIRED");
  const rollback = api.rollbackOtaTask(created.id, true).data;
  assert.equal(rollback.status, "rolledBack");
  assert.equal(rollback.rollbackOfTaskId, created.id);
  assert.equal(rollback.devices[0].targetVersion, created.devices[0].previousVersion);
  assert.equal(JSON.stringify(api.getOtaTask(created.id).data), originalBeforeRollback);
  assert.equal(api.cancelOtaTask(created.id, false).error?.code, "IMPACT_CONFIRMATION_REQUIRED");

  const viewer = source.createMockApi({ ...baseContext, role: "viewer" });
  assert.equal(viewer.createOtaPlan({ tenantId: baseContext.tenantId, firmwareId: firmware.id, targetDeviceIds: [targets[0].id], batchPercent: 10, failureThresholdPercent: 20 }).error?.code, "FORBIDDEN");
});

test("Tenant contracts enforce isolation, member permissions, role previews, and hard quotas", () => {
  const admin = source.createMockApi({ ...baseContext, role: "platformAdmin" });
  const tenant = admin.getTenantDetail(baseContext.tenantId).data;
  assert.equal(tenant.id, baseContext.tenantId);
  assert.ok(tenant.members.length >= 3);
  assert.equal(tenant.quotas.find(item => item.resource === "devices").status, "exceeded");
  assert.ok(admin.listTenants().data.every(item => item.memberCount > 0 && item.quotaUsagePercent >= 0));
  assert.ok(admin.previewRole("viewer").data.permissions.includes("device.read"));
  assert.equal(admin.simulateCreateDevice(baseContext.tenantId).error?.code, "QUOTA_EXCEEDED");

  const viewer = source.createMockApi({ ...baseContext, actorId: "usr_003", role: "viewer" });
  assert.equal(viewer.inviteTenantMember(baseContext.tenantId, "新成员", "operator").error?.code, "FORBIDDEN");
  assert.equal(viewer.updateTenantMember("usr_002", { status: "disabled" }).error?.code, "FORBIDDEN");
  assert.equal(viewer.getTenantDetail("ten_de_002").error?.code, "FORBIDDEN");

  const tenantAdmin = source.createMockApi(baseContext);
  assert.equal(tenantAdmin.inviteTenantMember(baseContext.tenantId, "新成员", "operator").data?.role, "operator");
  assert.equal(tenantAdmin.updateTenantMember("usr_002", { status: "disabled" }).data?.status, "disabled");
});

test("Rule engine traces every node, rejects cycles, filters logs, and ignores disabled events", () => {
  const api = source.createMockApi(baseContext);
  const rule = api.listRules(baseContext.tenantId).data[0];
  const trace = api.testRuleFlow(baseContext.tenantId, { temperature: 27 }, rule.id).data;
  assert.equal(trace.status, "succeeded");
  assert.equal(trace.steps.length, rule.nodes.length);
  assert.ok(trace.steps.every(step => step.input !== undefined && step.output !== undefined && step.durationMs > 0));
  assert.equal(api.testRuleFlow(baseContext.tenantId, {}, rule.id).data.status, "failed");

  const cyclic = { ...rule, edges: [...rule.edges, { id: "edge_cycle", from: "storage", to: "trigger" }] };
  assert.equal(api.saveRuleFlow(cyclic).error?.code, "VALIDATION_ERROR");
  assert.match(api.saveRuleFlow(cyclic).error?.message ?? "", /环路/);

  const device = api.listDevices({ tenantId: baseContext.tenantId, seed: baseContext.seed }).data.items[0];
  assert.equal(api.consumeRuleEvent(rule.id, device.id, { temperature: 27 }).data.created, true);
  assert.equal(api.listRuleLogs({ tenantId: baseContext.tenantId, ruleId: rule.id, deviceId: device.id, status: "succeeded" }).data.length, 1);
  api.toggleRule(rule.id, false);
  assert.equal(api.consumeRuleEvent(rule.id, device.id, { temperature: 30 }).data.created, false);
  assert.equal(api.listRuleLogs({ tenantId: baseContext.tenantId }).data.length, 1);

  const viewer = source.createMockApi({ ...baseContext, role: "viewer" });
  assert.equal(viewer.testRuleFlow(baseContext.tenantId, { temperature: 27 }).error?.code, "FORBIDDEN");
  assert.equal(viewer.saveRuleFlow(rule).error?.code, "FORBIDDEN");
});

test("Product query supports deterministic search, filtering, pagination, and device counts", () => {
  const api = source.createMockApi(baseContext);
  const all = api.queryProducts({ tenantId: baseContext.tenantId, seed: baseContext.seed, page: 1, pageSize: 1 });
  assert.equal(all.data?.items.length, 1);
  assert.equal(all.data?.total, 2);
  assert.ok(all.data.items[0].deviceCount > 0);
  const filtered = api.queryProducts({ tenantId: baseContext.tenantId, seed: baseContext.seed, keyword: "env-sensor", status: "active" });
  assert.equal(filtered.data?.total, 1);
  assert.equal(api.queryProducts({ tenantId: baseContext.tenantId, seed: baseContext.seed, page: 0 }).error?.code, "VALIDATION_ERROR");
});

test("Thing model validates fields, uniqueness, conflicts, permissions, and impact confirmation", () => {
  const api = source.createMockApi(baseContext);
  const product = api.listProducts(baseContext.tenantId).data[0];
  const model = api.getThingModel(product.id).data;
  assert.equal(model.properties[0].identifier, "temperature");
  const invalid = api.saveThingModelProperty({ productId: product.id, expectedVersion: model.version, property: { identifier: "Temp!", name: "", dataType: "number", access: "read" } });
  assert.equal(invalid.error?.code, "VALIDATION_ERROR");
  const impact = api.saveThingModelProperty({ productId: product.id, expectedVersion: model.version, property: { identifier: "temperature", name: "温度文本", dataType: "string", access: "read" } });
  assert.equal(impact.error?.code, "IMPACT_CONFIRMATION_REQUIRED");
  const saved = api.saveThingModelProperty({ productId: product.id, expectedVersion: model.version, confirmImpact: true, property: { identifier: "temperature", name: "温度", dataType: "number", unit: "°C", access: "readWrite", min: -20, max: 100 } });
  assert.equal(saved.data?.version, model.version + 1);
  assert.equal(api.saveThingModelProperty({ productId: product.id, expectedVersion: model.version, property: saved.data.properties[0] }).error?.code, "CONFLICT");
  const viewer = source.createMockApi({ ...baseContext, role: "viewer" });
  assert.equal(viewer.saveThingModelProperty({ productId: product.id, expectedVersion: 1, property: model.properties[0] }).error?.code, "FORBIDDEN");
});

test("Thing model events, services, and advanced DP settings validate through the shared contract", () => {
  const api = source.createMockApi(baseContext); const product = api.listProducts(baseContext.tenantId).data[0]; let model = api.getThingModel(product.id).data;
  const event = api.saveThingModelEvent({ productId: product.id, expectedVersion: model.version, event: { identifier: "batteryLow", name: "电量低", severity: "warning" } });
  assert.equal(event.data.events.at(-1).identifier, "batteryLow"); model = event.data;
  const service = api.saveThingModelService({ productId: product.id, expectedVersion: model.version, service: { identifier: "reboot", name: "重启", input: [{ identifier: "delay", name: "延迟", dataType: "number", unit: "s", access: "write", min: 0, max: 60 }], output: [] } });
  assert.equal(service.data.services.at(-1).identifier, "reboot");
  assert.equal(api.saveThingModelEvent({ productId: product.id, expectedVersion: model.version, event: { identifier: "Bad!", name: "", severity: "warning" } }).error?.code, "CONFLICT");
  const transformed = api.testDpRule(product.id, { id: "dpr_advanced", productId: product.id, identifier: "temperature", scale: .1, offset: 1, precision: 1, dataType: "number", threshold: { min: 0, max: 100 }, expression: "value * 2" }, 250);
  assert.equal(transformed.data.finalValue, 52);
  assert.ok(transformed.data.steps.some(step => step.stage === "expression"));
  assert.equal(api.testDpRule(product.id, { id: "dpr_unsafe", productId: product.id, identifier: "temperature", scale: .1, offset: 0, precision: 1, dataType: "number", expression: "fetch('x')" }, 250).error?.code, "VALIDATION_ERROR");
  const viewer = source.createMockApi({ ...baseContext, role: "viewer" });
  assert.equal(viewer.saveThingModelEvent({ productId: product.id, expectedVersion: 1, event: { identifier: "batteryLow", name: "电量低", severity: "warning" } }).error?.code, "FORBIDDEN");
});

test("DP rule test returns conversion steps and rejects missing bindings or out-of-range values", () => {
  const api = source.createMockApi(baseContext);
  const product = api.listProducts(baseContext.tenantId).data[0];
  const rule = { id: "dpr_001", productId: product.id, identifier: "temperature", scale: 0.1, offset: 1, precision: 1, dataType: "number" };
  const result = api.testDpRule(product.id, rule, 250);
  assert.equal(result.data?.finalValue, 26);
  assert.deepEqual(result.data?.steps.map(step => step.stage), ["input", "scale", "offset", "precision", "range"]);
  assert.equal(api.testDpRule(product.id, { ...rule, identifier: "missing" }, 1).error?.code, "VALIDATION_ERROR");
  assert.equal(api.testDpRule(product.id, { ...rule, threshold: { max: 20 } }, 250).error?.code, "VALIDATION_ERROR");
});

test("Topology query keeps geographic filters, aggregates, and device details consistent", () => {
  const api = source.createMockApi(baseContext);
  const all = api.getTopology({ tenantId: baseContext.tenantId, seed: baseContext.seed });
  assert.ok(all.data);
  const continent = all.data.nodes[0].continent;
  const filtered = api.getTopology({ tenantId: baseContext.tenantId, seed: baseContext.seed, continent });
  assert.ok(filtered.data);
  assert.ok(filtered.data.nodes.every(node => node.continent === continent));
  assert.ok(filtered.data.nodes.every(node => Number.isFinite(node.location.latitude) && Number.isFinite(node.location.longitude)));
  assert.ok(filtered.data.nodes.every(node => node.location.latitude >= -90 && node.location.latitude <= 90 && node.location.longitude >= -180 && node.location.longitude <= 180));
  const visibleCount = filtered.data.devices.length + filtered.data.unlocatedDevices.length;
  assert.equal(filtered.data.nodes.reduce((sum, node) => sum + node.deviceCount, 0), visibleCount);
  for (const device of [...filtered.data.devices, ...filtered.data.unlocatedDevices]) {
    assert.deepEqual(api.getDevice(device.id).data, device);
  }
  assert.ok(filtered.data.devices.every(device => device.location));
  assert.ok(filtered.data.unlocatedDevices.every(device => !device.location));
});

test("Topology query supports node, product, status filters and tenant isolation", () => {
  const api = source.createMockApi(baseContext);
  const all = api.getTopology({ tenantId: baseContext.tenantId, seed: baseContext.seed }).data;
  assert.ok(all);
  const sample = [...all.devices, ...all.unlocatedDevices][0];
  const filtered = api.getTopology({
    tenantId: baseContext.tenantId,
    seed: baseContext.seed,
    nodeId: sample.nodeId,
    productId: sample.productId,
    status: sample.status,
  }).data;
  assert.ok(filtered);
  assert.ok([...filtered.devices, ...filtered.unlocatedDevices].every(device =>
    device.nodeId === sample.nodeId && device.productId === sample.productId && device.status === sample.status));
  assert.equal(api.getTopology({ tenantId: "ten_de_002", seed: baseContext.seed }).error?.code, "FORBIDDEN");
});

test("Device diagnostics support compound filters, missing telemetry, messages, alarms, and command states", () => {
  const api = source.createMockApi(baseContext);
  const all = api.listDevices({ tenantId: baseContext.tenantId, seed: baseContext.seed, pageSize: 100 }).data;
  const sample = all.items[0];
  const topology = api.getTopology(baseContext.tenantId).data;
  const region = topology.nodes.find(node => node.id === sample.nodeId).continent;
  const filtered = api.listDevices({ tenantId: baseContext.tenantId, seed: baseContext.seed, productId: sample.productId, status: sample.status, region, tags: sample.tags, activeBefore: sample.lastActiveAt, sortBy: "name", sortOrder: "asc", pageSize: 100 }).data;
  assert.ok(filtered.items.every(device => device.productId === sample.productId && device.status === sample.status && sample.tags.every(tag => device.tags.includes(tag))));
  const telemetry = api.queryTelemetrySeries({ deviceId: sample.id, metric: "temperature", from: query.from, to: query.to, granularity: "hour", seed: baseContext.seed }).data;
  assert.equal(telemetry.length, 12);
  assert.ok(telemetry.some(point => point.quality === "missing"));
  assert.equal(api.listDeviceMessages(sample.id).data.length, 8);
  assert.ok(api.listDeviceAlarms(sample.id).data.every(alarm => alarm.deviceId === sample.id));
  assert.equal(api.controlDevice(sample.id).data.status, "succeeded");
});
