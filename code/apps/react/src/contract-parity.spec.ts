// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { getSummary, type Context, type DashboardQuery } from './dashboard';
import { getTopology, type GeoQuery } from './geography';
import { ProductService } from './products';
import { DeviceService } from './devices';
import { DeviceEventService } from './device-events';
import { RuleService, type RuleInput } from './rules';
import { FirmwareService, type FirmwareInput } from './firmware';
import { OtaService, type OtaInput } from './ota';
import { otaTrend } from './ota-trend';
import { TenantService, type TenantInput } from './tenants';
import { DeliveryService, type DeliveryIssue, type DeliveryRecord, type DeliveryRelease } from './delivery';

// IOT-DOMAIN-001 / IOT-DASH-001 / IOT-GEO-001: this app exports its own DTOs.
const context: Context = { actorId: 'usr_202609_001', role: 'tenantAdmin', tenantId: 'ten_202609_001', seed: 42, scenario: 'normal' };
const query: DashboardQuery = { tenantId: 'ten_202609_001', from: '2026-09-10T00:00:00.000Z', to: '2026-09-17T00:00:00.000Z', seed: 42 };
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() { return items.size; }, clear() { items.clear(); }, getItem(key) { return items.get(key) ?? null; },
    key(index) { return [...items.keys()][index] ?? null; }, removeItem(key) { items.delete(key); }, setItem(key, value) { items.set(key, value); },
  };
}

async function snapshots() {
  const platform: Context = { ...context, role: 'platformAdmin' };
  const dashboard = {
    all: await getSummary(platform, { ...query, tenantId: 'all' }),
    tenant: await getSummary(context, query),
    regionProduct: await getSummary(context, { ...query, region: 'AS', productId: 'prod_as_001' }),
    empty: await getSummary(context, { ...query, region: 'unknown' }),
    partialFailure: await getSummary({ ...context, scenario: 'partialFailure' }, query),
    forbidden: await getSummary(context, { ...query, tenantId: 'ten_202609_002', from: 'invalid' }),
    offline: await getSummary({ ...context, scenario: 'offline' }, query),
    invalidUtcDate: await getSummary(context, { ...query, from: '2026-09-31T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' }),
  };
  const geography = {
    global: await getTopology(context, query),
    continent: await getTopology(context, { ...query, level: 'continent', parentId: 'AS' }),
    country: await getTopology(context, { ...query, level: 'country', parentId: 'CN' }),
    node: await getTopology(context, { ...query, level: 'node', parentId: 'node_cn_001' }),
    empty: await getTopology(context, { ...query, continent: 'EU', level: 'continent', parentId: 'EU' }),
    partialFailure: await getTopology({ ...context, scenario: 'partialFailure' }, query),
    forbidden: await getTopology(context, { ...query, tenantId: 'ten_202609_002', from: 'invalid' } as GeoQuery),
    offline: await getTopology({ ...context, scenario: 'offline' }, query),
    invalidUtcDate: await getTopology(context, { ...query, from: '2026-09-31T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' }),
  };
  const catalog = {
    products: new ProductService(), devices: new DeviceService(), rules: new RuleService(),
    firmware: new FirmwareService(), ota: new OtaService(), tenants: new TenantService(),
  };
  const ownPage = { tenantId: context.tenantId, seed: 42, page: 1, pageSize: 2 };
  const otherPage = { ...ownPage, tenantId: 'ten_202609_002' };
  const offline = { ...context, scenario: 'offline' as const };
  const domain = {
    products: {
      list: await catalog.products.list(context, ownPage), filtered: await catalog.products.list(context, { ...ownPage, status: 'published' }),
      get: await catalog.products.get(context, 'prod_as_001'), forbidden: await catalog.products.list(context, otherPage),
      foreignGet: await catalog.products.get(context, 'prod_as_002'),
      offline: await catalog.products.list(offline, ownPage),
    },
    devices: {
      list: await catalog.devices.list(context, ownPage), filtered: await catalog.devices.list(context, { ...ownPage, region: 'AS' }),
      get: await catalog.devices.get(context, 'dev_as_001'), forbidden: await catalog.devices.list(context, otherPage),
      foreignGet: await catalog.devices.get(context, 'dev_as_002'),
      offline: await catalog.devices.list(offline, ownPage),
    },
    rules: {
      list: await catalog.rules.list(context, ownPage), filtered: await catalog.rules.list(context, { ...ownPage, enabled: true }),
      get: await catalog.rules.get(context, 'rule_high_temp'), forbidden: await catalog.rules.list(context, otherPage),
      foreignGet: await catalog.rules.get(context, 'rule_low_battery'),
      offline: await catalog.rules.list(offline, ownPage),
    },
    firmware: {
      list: await catalog.firmware.list(context, ownPage), filtered: await catalog.firmware.list(context, { ...ownPage, status: 'released' }),
      get: await catalog.firmware.get(context, 'fw_as_001'), forbidden: await catalog.firmware.list(context, otherPage),
      foreignGet: await catalog.firmware.get(context, 'fw_as_003'),
      offline: await catalog.firmware.list(offline, ownPage),
    },
    ota: {
      list: await catalog.ota.list(context, ownPage), filtered: await catalog.ota.list(context, { ...ownPage, status: 'queued' }),
      get: await catalog.ota.get(context, 'missing'), forbidden: await catalog.ota.list(context, otherPage),
      offline: await catalog.ota.list(offline, ownPage),
    },
    tenants: {
      list: await catalog.tenants.list(context, ownPage), filtered: await catalog.tenants.list(context, { ...ownPage, status: 'active' }),
      get: await catalog.tenants.get(context, context.tenantId), forbidden: await catalog.tenants.list(context, otherPage),
      foreignGet: await catalog.tenants.get(context, 'ten_202609_002'),
      offline: await catalog.tenants.list(offline, ownPage),
    },
  };
  const storage = memoryStorage();
  const tenantService = new TenantService(storage);
  const productService = new ProductService(storage, tenantService);
  const deviceService = new DeviceService(storage, productService, tenantService);
  const productInput = { tenantId: context.tenantId, name: '契约温度探头', productKey: 'contract-temp-probe', category: '工业传感器', protocol: 'MQTT' as const, status: 'draft' as const };
  const deviceInput = { tenantId: context.tenantId, productId: 'prod_as_001', name: '契约测试设备', region: 'AS', countryCode: 'CN', location: [121.47, 31.23] as [number, number], tags: ['契约'] };
  const createdProduct = await productService.save(context, productInput);
  const duplicateProduct = await productService.save(context, productInput);
  const productId = 'data' in createdProduct ? createdProduct.data.id : 'missing';
  const productAfterCreate = await productService.get(context, productId);
  const viewer: Context = { ...context, role: 'viewer' };
  const deniedProduct = await productService.save(viewer, { ...productInput, productKey: 'contract-viewer-probe' });
  const createdDevice = await deviceService.create(context, deviceInput);
  const deviceId = 'data' in createdDevice ? createdDevice.data.id : 'missing';
  const unconfirmedDelete = await deviceService.deleteBatch(context, [deviceId], false);
  const updatedDevice = await deviceService.updateMetadata(context, deviceId, { name: '契约测试设备更新', tags: ['契约', '更新'] }, 1);
  const staleDevice = await deviceService.updateMetadata(context, deviceId, { name: '过期修改', tags: ['契约'] }, 1);
  const deviceAfterUpdate = await deviceService.get(context, deviceId);
  const deletedDevice = await deviceService.deleteBatch(context, [deviceId], true);
  const deviceAfterDelete = await deviceService.get(context, deviceId);
  const ruleService = new RuleService(memoryStorage());
  const ruleInput: RuleInput = {
    tenantId: context.tenantId, productId: 'prod_as_001', name: '契约高温规则', versionNote: '初版',
    nodes: [
      { id: 't', kind: 'trigger', name: '触发', x: 0, y: 0, config: { field: 'temperature' } },
      { id: 'c', kind: 'condition', name: '判断', x: 100, y: 0, config: { join: 'AND', clauses: [{ field: 'temperature', operator: '>', threshold: 75 }] } },
      { id: 'a', kind: 'alarm', name: '告警', x: 200, y: 0, config: { severity: 'critical', message: '温度过高' } },
    ], edges: [{ id: 'e1', from: 't', to: 'c' }, { id: 'e2', from: 'c', to: 'a' }],
  };
  const createdRule = await ruleService.save(context, ruleInput);
  const ruleId = 'data' in createdRule ? createdRule.data.id : 'missing';
  const operator: Context = { ...context, role: 'operator' };
  const deniedToggle = await ruleService.toggle(operator, ruleId, true, 1);
  const enabledRule = await ruleService.toggle(context, ruleId, true, 1);
  const staleRule = await ruleService.save(context, ruleInput, ruleId, 1);
  const ruleSample = { deviceId: 'dev_as_001', productId: 'prod_as_001', occurredAt: '2026-09-16T12:00:00.000Z', properties: { temperature: 82.4, humidity: 41.2 } };
  const ruleEvent = await ruleService.consumeEvent(operator, ruleId, ruleSample);
  const ruleLogs = await ruleService.logsFor(context, { tenantId: context.tenantId, ruleId, page: 1, pageSize: 10, seed: 42 });
  const firmwareService = new FirmwareService(memoryStorage(), new ProductService());
  const firmwareInput: FirmwareInput = {
    tenantId: context.tenantId, productId: 'prod_as_001', compatibleProductIds: ['prod_as_001'], name: 'sensor-core',
    version: '2.5.0', description: '契约版本', fileName: 'sensor-core-2.5.0.bin', sizeBytes: 2048,
    checksum: 'a'.repeat(64), checksumValid: true,
  };
  const createdFirmware = await firmwareService.create(context, firmwareInput);
  const firmwareId = 'data' in createdFirmware ? createdFirmware.data.id : 'missing';
  const prematureRelease = await firmwareService.transition(context, firmwareId, 'release', 1);
  const verifiedFirmware = await firmwareService.transition(context, firmwareId, 'verify', 1);
  const staleFirmware = await firmwareService.transition(context, firmwareId, 'release', 1);
  const releasedFirmware = await firmwareService.transition(context, firmwareId, 'release', 2);
  const eligibleFirmware = await firmwareService.eligible(context, firmwareId, 'prod_as_001');
  const archivedFirmware = await firmwareService.transition(context, firmwareId, 'archive', 3);
  const quotaStore = memoryStorage();
  const quotaTenants = new TenantService(quotaStore);
  const quotaFirmwares = new FirmwareService(quotaStore, new ProductService(quotaStore, quotaTenants), quotaTenants);
  const quotaTenant = await quotaTenants.get(platform, context.tenantId);
  const quotaConfig = 'data' in quotaTenant ? { ...quotaTenant.data.quota, storageMb: { limit: 321, warningAt: 80 } } : null;
  const quotaSet = quotaConfig ? await quotaTenants.updateQuota(platform, context.tenantId, quotaConfig, 1) : quotaTenant;
  const quotaPreviewBefore = await quotaFirmwares.previewStorage(context, context.tenantId, 256 * 1024);
  const quotaFirst = await quotaFirmwares.create(context, { ...firmwareInput, sizeBytes: 256 * 1024 });
  const quotaPreviewSharedMiB = await quotaFirmwares.previewStorage(context, context.tenantId, 256 * 1024);
  const quotaSecond = await quotaFirmwares.create(context, { ...firmwareInput, version: '2.5.1', sizeBytes: 256 * 1024 });
  const quotaPreviewOver = await quotaFirmwares.previewStorage(context, context.tenantId, 768 * 1024);
  const quotaDenied = await quotaFirmwares.create(context, { ...firmwareInput, version: '2.5.2', sizeBytes: 768 * 1024 });
  const quotaAfter = await quotaTenants.get(platform, context.tenantId);
  const tenantMutationService = new TenantService(memoryStorage());
  const platformContext: Context = { ...context, role: 'platformAdmin', tenantId: 'all' };
  const tenantInput: TenantInput = { name: '契约租户', key: 'contract-tenant', status: 'active', plan: 'standard', contact: '测试人', email: 'contract@example.com', description: '契约', quota: {
    devices: { limit: 8, warningAt: 80 }, products: { limit: 5, warningAt: 80 }, messages: { limit: 100, warningAt: 80 },
    storageMb: { limit: 256, warningAt: 80 }, otaConcurrent: { limit: 2, warningAt: 80 },
  } };
  const deniedTenant = await tenantMutationService.save(context, tenantInput);
  const createdTenant = await tenantMutationService.save(platformContext, tenantInput);
  const duplicateTenant = await tenantMutationService.save(platformContext, tenantInput);
  const tenantId = 'data' in createdTenant ? createdTenant.data.id : 'missing';
  const invitedMember = await tenantMutationService.inviteMember(platformContext, tenantId, { name: '契约成员', email: 'member@example.com', role: 'viewer', status: 'active' });
  const memberId = 'data' in invitedMember ? invitedMember.data.id : 'missing';
  const updatedMember = await tenantMutationService.updateMember(platformContext, tenantId, memberId, { name: '契约成员', email: 'member@example.com', role: 'operator', status: 'active' }, 1);
  const tenantAfterMember = await tenantMutationService.get(platformContext, tenantId);
  const otaStore = memoryStorage();
  const otaProductService = new ProductService(otaStore);
  const otaDeviceService = new DeviceService(otaStore, otaProductService);
  const otaFirmwareService = new FirmwareService(otaStore, otaProductService);
  const otaService = new OtaService(otaStore, otaFirmwareService, otaDeviceService);
  const otaInput: OtaInput = { tenantId: context.tenantId, firmwareId: 'fw_as_001', productId: 'prod_as_001',
    targetSelector: { deviceIds: ['dev_as_001', 'dev_eu_001', 'dev_oc_001', 'dev_sa_001'], tags: [] },
    batches: [100], failureThreshold: 0.2, failureModes: {} };
  const otaPreview = await otaService.preview(context, otaInput);
  const createdOta = await otaService.create(context, otaInput);
  const otaId = 'data' in createdOta ? createdOta.data.id : 'missing';
  const deniedOtaStart = await otaService.start(operator, otaId, 1);
  const startedOta = await otaService.start(context, otaId, 1);
  const staleOtaStart = await otaService.start(context, otaId, 1);
  const pausedOta = await otaService.pause(operator, otaId, 'data' in startedOta ? startedOta.data.revision : 1);
  const resumedOta = await otaService.resume(operator, otaId, 'data' in pausedOta ? pausedOta.data.revision : 1);
  const cancelledOta = await otaService.cancel(context, otaId, 'data' in resumedOta ? resumedOta.data.revision : 1);
  const otaAfterCancel = await otaService.get(context, otaId);
  const foreignOta = await otaService.create(platform, {
    ...otaInput, tenantId: 'ten_202609_002', firmwareId: 'fw_as_003', productId: 'prod_as_002',
    targetSelector: { deviceIds: ['dev_as_002'], tags: [] },
  });
  const foreignOtaGet = await otaService.get(context, 'data' in foreignOta ? foreignOta.data.id : 'missing');
  const rollbackStore = memoryStorage();
  const rollbackProducts = new ProductService(rollbackStore);
  const rollbackDevices = new DeviceService(rollbackStore, rollbackProducts);
  const rollbackFirmware = new FirmwareService(rollbackStore, rollbackProducts);
  const rollbackService = new OtaService(rollbackStore, rollbackFirmware, rollbackDevices);
  const rollbackSourceCreated = await rollbackService.create(context, otaInput);
  const sourceId = 'data' in rollbackSourceCreated ? rollbackSourceCreated.data.id : 'missing';
  const rollbackSourceStarted = await rollbackService.start(context, sourceId, 1);
  let rollbackSourceFinished = rollbackSourceStarted;
  for (let step = 0; step < 5; step++) rollbackSourceFinished = await rollbackService.advance(operator, sourceId);
  const rollbackCreated = await rollbackService.rollback(context, sourceId, 'data' in rollbackSourceFinished ? rollbackSourceFinished.data.revision : 1);
  const rollbackId = 'data' in rollbackCreated ? rollbackCreated.data.id : 'missing';
  const rollbackStarted = await rollbackService.start(context, rollbackId, 1);
  let rollbackFinished = rollbackStarted;
  for (let step = 0; step < 5; step++) rollbackFinished = await rollbackService.advance(operator, rollbackId);
  const sourceAfterRollback = await rollbackService.get(context, sourceId);
  const deviceOtaHistory = await rollbackService.historyForDevice(context, 'dev_as_001');
  const reloadedOta = new OtaService(rollbackStore, rollbackFirmware, rollbackDevices);
  const reloadedSource = await reloadedOta.get(context, sourceId);
  const reloadedRollback = await reloadedOta.get(context, rollbackId);
  const retryStore = memoryStorage();
  const retryProducts = new ProductService(retryStore);
  const retryDevices = new DeviceService(retryStore, retryProducts);
  const retryFirmware = new FirmwareService(retryStore, retryProducts);
  const retryService = new OtaService(retryStore, retryFirmware, retryDevices);
  const observedEventIds: string[] = [];
  const unsubscribeRetry = retryService.subscribe(event => observedEventIds.push(event.id));
  const retryInput: OtaInput = { ...otaInput, batches: [10, 90], failureModes: { dev_as_001: 'download' } };
  const retryCreated = await retryService.create(context, retryInput);
  const retryId = 'data' in retryCreated ? retryCreated.data.id : 'missing';
  const retryStarted = await retryService.start(context, retryId, 1);
  await retryService.advance(operator, retryId);
  const retryPaused = await retryService.advance(operator, retryId);
  const retryBlockedAdvance = await retryService.advance(operator, retryId);
  const retryQueued = await retryService.retry(operator, retryId, 'dev_as_001', 'data' in retryPaused ? retryPaused.data.revision : 1);
  let retryFinished = retryQueued;
  for (let step = 0; step < 10; step++) retryFinished = await retryService.advance(operator, retryId);
  unsubscribeRetry();
  expect(observedEventIds.length).toBeGreaterThan(0);
  expect(new Set(observedEventIds).size).toBe(observedEventIds.length);
  const retryHistory = await retryService.historyForDevice(context, 'dev_as_001');
  const retryReloaded = await new OtaService(retryStore, retryFirmware, retryDevices).get(context, retryId);
  const eventStore = memoryStorage(), eventRules = new RuleService(eventStore);
  const eventService = new DeviceEventService(eventStore, undefined, undefined, eventRules);
  const livePoint = { deviceId: 'dev_as_001', metric: 'temperature', timestamp: '2026-09-16T13:00:00.000Z', value: 82, unit: '°C', quality: 'good' as const };
  const liveRecorded = await eventService.recordTelemetry(operator, livePoint.deviceId, [livePoint]);
  const liveDuplicate = await eventService.recordTelemetry(operator, livePoint.deviceId, [livePoint]);
  const liveLogs = await eventRules.logsFor(context, { tenantId: context.tenantId, ruleId: 'rule_high_temp', page: 1, pageSize: 100, seed: 42 });
  const liveAlarms = await eventService.listAlarms(context, livePoint.deviceId);
  const otherTenant: Context = { ...operator, tenantId: 'ten_202609_002' };
  const disabledPoint = { deviceId: 'dev_as_002', metric: 'voltage', timestamp: '2026-09-16T13:01:00.000Z', value: 220, unit: 'V', quality: 'good' as const };
  const disabledRecorded = await eventService.recordTelemetry(otherTenant, disabledPoint.deviceId, [disabledPoint]);
  const disabledLogs = await eventRules.logsFor(otherTenant, { tenantId: otherTenant.tenantId, ruleId: 'rule_low_battery', page: 1, pageSize: 100, seed: 42 });
  const commandStore = memoryStorage();
  const commandService = new DeviceService(commandStore, new ProductService(commandStore));
  const command = {
    viewerDenied: await commandService.executeCommand(viewer, 'dev_as_001', 'tm_sampling_interval', 100),
    tenantDenied: await commandService.executeCommand(otherTenant, 'dev_as_001', 'tm_sampling_interval', 100),
    missingDevice: await commandService.executeCommand(operator, 'missing', 'tm_sampling_interval', 100),
    readOnlyItem: await commandService.executeCommand(operator, 'dev_as_001', 'tm_temperature', 25),
    invalidRange: await commandService.executeCommand(operator, 'dev_as_001', 'tm_sampling_interval', 1001),
    disconnected: await commandService.executeCommand({ ...operator, scenario: 'offline' }, 'dev_as_001', 'tm_reboot', true),
    historyAfterRejections: await commandService.commandHistory(operator, 'dev_as_001'),
    offlineDevice: await commandService.executeCommand(operator, 'dev_af_001', 'tm_reboot', true),
    offlineHistory: await commandService.commandHistory(operator, 'dev_af_001'),
  };
  const historyStore = memoryStorage();
  const historyDevices = new DeviceService(historyStore, new ProductService(historyStore));
  const historyEvents = new DeviceEventService(historyStore, historyDevices);
  const historyPoint = { deviceId: 'dev_as_001', metric: 'temperature', timestamp: '2026-09-16T13:00:00.000Z', value: 82, unit: '°C', quality: 'good' as const };
  const alarmId = 'alarm_fault_dev_na_001';
  const eventHistory = {
    seedMessages: await historyEvents.listMessages(operator, historyPoint.deviceId),
    missingReport: await historyEvents.recordTelemetry(operator, historyPoint.deviceId, [{ ...historyPoint, value: null, quality: 'missing' }]),
    wrongDevice: await historyEvents.recordTelemetry(operator, historyPoint.deviceId, [{ ...historyPoint, deviceId: 'dev_as_002' }]),
    recorded: await historyEvents.recordTelemetry(operator, historyPoint.deviceId, [historyPoint]),
    duplicate: await historyEvents.recordTelemetry(operator, historyPoint.deviceId, [historyPoint]),
    messages: await historyEvents.listMessages(operator, historyPoint.deviceId),
    restoredMessages: await new DeviceEventService(historyStore, historyDevices).listMessages(operator, historyPoint.deviceId),
    foreignMessages: await historyEvents.listMessages(operator, 'dev_as_002'),
    faultBefore: await historyEvents.listAlarms(operator, 'dev_na_001'),
    viewerAck: await historyEvents.acknowledge(viewer, 'dev_na_001', alarmId),
    missingAck: await historyEvents.acknowledge(operator, 'dev_na_001', 'missing'),
    acknowledged: await historyEvents.acknowledge(operator, 'dev_na_001', alarmId),
    restoredAlarms: await new DeviceEventService(historyStore, historyDevices).listAlarms(operator, 'dev_na_001'),
  };
  const mutations = {
    products: { created: createdProduct, duplicate: duplicateProduct, afterCreate: productAfterCreate, viewerDenied: deniedProduct },
    devices: { created: createdDevice, unconfirmedDelete, updated: updatedDevice, stale: staleDevice, afterUpdate: deviceAfterUpdate, deleted: deletedDevice, afterDelete: deviceAfterDelete },
    rules: { created: createdRule, deniedToggle, enabled: enabledRule, stale: staleRule, event: ruleEvent, logs: ruleLogs },
    telemetryRule: { recorded: liveRecorded, duplicate: liveDuplicate, logs: liveLogs, alarms: liveAlarms, disabledRecorded, disabledLogs },
    command,
    eventHistory,
    firmware: { created: createdFirmware, prematureRelease, verified: verifiedFirmware, stale: staleFirmware, released: releasedFirmware, eligible: eligibleFirmware, archived: archivedFirmware },
    storageQuota: { quotaSet, previewBefore: quotaPreviewBefore, first: quotaFirst, previewSharedMiB: quotaPreviewSharedMiB, second: quotaSecond, previewOver: quotaPreviewOver, denied: quotaDenied, after: quotaAfter },
    tenants: { denied: deniedTenant, created: createdTenant, duplicate: duplicateTenant, invited: invitedMember, updatedMember, afterMember: tenantAfterMember },
    ota: { preview: otaPreview, created: createdOta, deniedStart: deniedOtaStart, started: startedOta, staleStart: staleOtaStart, paused: pausedOta, resumed: resumedOta, cancelled: cancelledOta, afterCancel: otaAfterCancel, foreignCreated: foreignOta, foreignGet: foreignOtaGet,
      cancelTrend: { data: 'data' in otaAfterCancel ? otaTrend(otaAfterCancel.data) : [] } },
    rollback: { sourceCreated: rollbackSourceCreated, sourceStarted: rollbackSourceStarted, sourceFinished: rollbackSourceFinished,
      created: rollbackCreated, started: rollbackStarted, finished: rollbackFinished, sourceAfter: sourceAfterRollback,
      deviceHistory: deviceOtaHistory, reloadedSource, reloadedRollback },
    retry: { created: retryCreated, started: retryStarted, paused: retryPaused, blockedAdvance: retryBlockedAdvance,
      queued: retryQueued, finished: retryFinished, trend: { data: 'data' in retryFinished ? otaTrend(retryFinished.data) : [] }, history: retryHistory, reloaded: retryReloaded },
  };
  const deliveryService = new DeliveryService();
  const highIssueResult = deliveryService.get('ISSUE-20260920-001');
  if (!('data' in highIssueResult) || highIssueResult.data.kind !== 'issue') throw new Error('Expected seeded high issue');
  const highIssue = highIssueResult.data as DeliveryIssue;
  const releaseInput = { environment: 'production' as const, version: 'v0.1.0', previousVersion: 'v0.0.1', changeSummary: '演示变更', testEvidence: ['本地测试'], rollbackSteps: '恢复上一版本' };
  const scopeService = new DeliveryService();
  const reviewResult = scopeService.decideReview({ id: 'tech-lead', role: 'techLead' }, 'REVIEW-003', 'approved', '模拟首轮审核', 1);
  if (!('data' in reviewResult)) throw new Error('Expected review approval');
  const originalResult = scopeService.get('IOT-TENANT-001');
  if (!('data' in originalResult)) throw new Error('Expected requirement');
  const original = originalResult.data as DeliveryRecord;
  const approvedResult = scopeService.save({ id: 'product-lead', role: 'productOwner' }, { ...original, status: 'approved', owner: 'product-lead', acceptance: ['旧范围'] }, original.revision);
  if (!('data' in approvedResult)) throw new Error('Expected requirement approval');
  const approved = approvedResult.data as DeliveryRecord;
  const deniedScopeChange = scopeService.save({ id: 'ai', role: 'contributor' }, { ...approved, description: '越权修改' }, approved.revision);
  const changedScope = scopeService.save({ id: 'product-lead', role: 'productOwner' }, { ...approved, description: '新范围' }, approved.revision);
  const scopeAfterChange = { deniedScopeChange, changedScope, review: scopeService.get('REVIEW-003'), trace: scopeService.trace('IOT-TENANT-001'), release: { data: scopeService.checkRelease({ ...releaseInput, requirementIds: ['IOT-TENANT-001'] }) } };
  const amendService = new DeliveryService();
  const amendInput: Omit<DeliveryRelease, 'id' | 'kind' | 'revision' | 'updatedAt' | 'publishedAt'> = { title: '模拟发布', status: 'draft', priority: 'P1', phase: '发布', owner: 'release-lead', requirementIds: ['IOT-TENANT-001'], description: '本地模拟', acceptance: [], evidence: [], risk: '', history: [], environment: 'production', version: 'v0.2.0', previousVersion: '', changeSummary: '', testEvidence: [], rollbackSteps: '', knownRisks: [] };
  const amendCreated = amendService.createRelease({ id: 'release-lead', role: 'releaseLead' }, amendInput);
  if (!('data' in amendCreated)) throw new Error('Expected blocked release');
  const amendDenied = amendService.updateRelease({ id: 'ai', role: 'contributor' }, amendCreated.data.id, { ...amendInput, previousVersion: 'v0.1.0' }, amendCreated.data.revision);
  const amendSaved = amendService.updateRelease({ id: 'release-lead', role: 'releaseLead' }, amendCreated.data.id, { ...amendInput, previousVersion: 'v0.1.0', changeSummary: '补齐', testEvidence: ['本地测试'], rollbackSteps: '恢复上一版' }, amendCreated.data.revision);
  const amendStale = amendService.updateRelease({ id: 'release-lead', role: 'releaseLead' }, amendCreated.data.id, amendInput, amendCreated.data.revision);
  const delivery = {
    reviews: deliveryService.list({ kind: 'review', status: 'pending', page: 1, pageSize: 10 }),
    dashboardTrace: deliveryService.trace('IOT-DASH-001'),
    labTrace: deliveryService.trace('IOT-LEARNING-001'),
    dashboardRelease: { data: deliveryService.checkRelease({ ...releaseInput, requirementIds: ['IOT-DASH-001'] }) },
    productRelease: { data: deliveryService.checkRelease({ ...releaseInput, requirementIds: ['IOT-PRODUCT-001'] }) },
    unreviewedRelease: { data: deliveryService.checkRelease({ ...releaseInput, requirementIds: ['IOT-QUALITY-001'] }) },
    deniedIssueClose: deliveryService.save({ id: 'ai', role: 'contributor' }, { ...highIssue, status: 'done', resolution: '自行关闭' }, highIssue.revision),
    deniedIssueDowngrade: deliveryService.save({ id: 'ai', role: 'contributor' }, { ...highIssue, severity: 'medium' }, highIssue.revision),
    scopeAfterChange,
    releaseAmend: { denied: amendDenied, saved: amendSaved, stale: amendStale },
  };
  vi.useFakeTimers();
  let telemetrySubscription: ReturnType<DeviceService['subscribeTelemetry']> | undefined;
  let subscription: { beforeTick: unknown[]; firstTick: unknown[]; afterCancel: unknown[]; offline: unknown[]; invalidMetric: unknown[]; foreign: unknown[] };
  try {
    const subscriptionService = new DeviceService(memoryStorage(), new ProductService());
    const live: unknown[] = [], offlineEvents: unknown[] = [], invalidEvents: unknown[] = [], foreignEvents: unknown[] = [];
    telemetrySubscription = subscriptionService.subscribeTelemetry(operator, 'dev_as_001', ['temperature', 'humidity'], 'hour', event => live.push(event));
    const beforeTick = structuredClone(live);
    vi.advanceTimersByTime(5000);
    const firstTick = structuredClone(live);
    telemetrySubscription(); telemetrySubscription = undefined;
    vi.advanceTimersByTime(10_000);
    subscriptionService.subscribeTelemetry(operator, 'dev_af_001', ['temperature'], 'hour', event => offlineEvents.push(event))();
    subscriptionService.subscribeTelemetry(operator, 'dev_as_001', ['missing'], 'hour', event => invalidEvents.push(event))();
    subscriptionService.subscribeTelemetry(otherTenant, 'dev_as_001', ['temperature'], 'hour', event => foreignEvents.push(event))();
    subscription = { beforeTick, firstTick, afterCancel: structuredClone(live), offline: offlineEvents, invalidMetric: invalidEvents, foreign: foreignEvents };
  } finally { telemetrySubscription?.(); vi.useRealTimers(); }
  return { dashboard, geography, domain, mutations, delivery, subscription };
}

describe('IOT-DOMAIN-001 cross-framework contract export', () => {
  it('writes deterministic actual DTOs for the outer parity gate', async () => {
    const first = await snapshots();
    expect(await snapshots()).toEqual(first);
    expect(first.dashboard.all).toHaveProperty('data');
    expect(first.dashboard.tenant).toHaveProperty('data');
    expect(first.dashboard.partialFailure).toHaveProperty('data');
    expect(first.dashboard.forbidden).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.dashboard.offline).toMatchObject({ error: { code: 'SCENARIO_TIMEOUT' } });
    expect(first.delivery.reviews).toMatchObject({ data: { total: 5 } });
    expect(first.delivery.dashboardRelease.data.blocked.join(' ')).toContain('REVIEW-002');
    expect(first.delivery.productRelease.data.blocked.join(' ')).toContain('REVIEW-003');
    expect(first.delivery.productRelease.data.blocked.join(' ')).toContain('REVIEW-005');
    expect(first.delivery.unreviewedRelease.data.blocked.join(' ')).toContain('关联需求缺少审核：IOT-QUALITY-001');
    expect(first.delivery.deniedIssueClose).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.delivery.deniedIssueDowngrade).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.delivery.scopeAfterChange.deniedScopeChange).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.delivery.scopeAfterChange.changedScope).toMatchObject({ data: { status: 'pending' } });
    expect(first.delivery.scopeAfterChange.review).toMatchObject({ data: { status: 'pending' } });
    expect(first.delivery.scopeAfterChange.trace).toMatchObject({ data: { related: expect.arrayContaining([expect.objectContaining({ kind: 'change' })]) } });
    expect(first.delivery.scopeAfterChange.release.data.blocked.join(' ')).toContain('关联需求未批准');
    expect(first.delivery.releaseAmend.denied).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.delivery.releaseAmend.saved).toMatchObject({ data: { status: 'blocked', revision: 2 } });
    expect(first.delivery.releaseAmend.stale).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(first.geography.global).toHaveProperty('data');
    expect(first.geography.partialFailure).toHaveProperty('data');
    expect(first.geography.forbidden).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.geography.offline).toMatchObject({ error: { code: 'SCENARIO_TIMEOUT' } });
    for (const values of Object.values(first.domain)) {
      expect(values.list).toHaveProperty('data');
      expect(values.filtered).toHaveProperty('data');
      expect(values.forbidden).toMatchObject({ error: { code: 'FORBIDDEN' } });
      expect(values.offline).toMatchObject({ error: { code: 'SCENARIO_TIMEOUT' } });
    }
    for (const values of [first.domain.products, first.domain.devices, first.domain.rules, first.domain.firmware, first.domain.tenants]) {
      expect(values.get).toHaveProperty('data');
      expect(values.foreignGet).toMatchObject({ error: { code: 'FORBIDDEN' } });
      expect(values.foreignGet).not.toHaveProperty('data');
    }
    expect(first.domain.ota.get).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(first.mutations.ota.foreignCreated).toHaveProperty('data');
    expect(first.mutations.ota.foreignGet).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.mutations.ota.foreignGet).not.toHaveProperty('data');
    expect(first.mutations.products.created).toHaveProperty('data');
    expect(first.mutations.products.duplicate).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(first.mutations.products.afterCreate).toHaveProperty('data');
    if ('data' in first.mutations.products.created && 'data' in first.mutations.products.afterCreate) {
      expect(first.mutations.products.afterCreate.data).toEqual(first.mutations.products.created.data);
    }
    expect(first.mutations.products.viewerDenied).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.mutations.devices.created).toHaveProperty('data');
    expect(first.mutations.devices.unconfirmedDelete).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(first.mutations.devices.updated).toHaveProperty('data');
    expect(first.mutations.devices.stale).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(first.mutations.devices.afterUpdate).toHaveProperty('data');
    if ('data' in first.mutations.devices.created && 'data' in first.mutations.devices.afterUpdate) {
      expect(first.mutations.devices.afterUpdate.data).toMatchObject({
        id: first.mutations.devices.created.data.id, name: '契约测试设备更新', tags: ['契约', '更新'], version: 2,
      });
    }
    expect(first.mutations.devices.deleted).toHaveProperty('data');
    expect(first.mutations.devices.afterDelete).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(first.mutations.command.viewerDenied).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.mutations.command.tenantDenied).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.mutations.command.missingDevice).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(first.mutations.command.readOnlyItem).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { modelItemId: expect.any(String) } } });
    expect(first.mutations.command.invalidRange).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { value: expect.any(String) } } });
    expect(first.mutations.command.disconnected).toMatchObject({ error: { code: 'SCENARIO_TIMEOUT' } });
    expect(first.mutations.command.historyAfterRejections).toMatchObject({ data: [] });
    expect(first.mutations.command.offlineDevice).toMatchObject({ data: { status: 'failed', reason: '设备离线或不可控制' } });
    expect(first.mutations.command.offlineHistory).toMatchObject({ data: [expect.objectContaining({ status: 'failed', reason: '设备离线或不可控制' })] });
    expect(first.mutations.eventHistory.seedMessages).toMatchObject({ data: [expect.objectContaining({ id: 'msg_seed_dev_as_001' })] });
    expect(first.mutations.eventHistory.missingReport).toMatchObject({ data: null });
    expect(first.mutations.eventHistory.wrongDevice).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(first.mutations.eventHistory.recorded).toMatchObject({ data: { payload: { temperature: 82 } } });
    expect(first.mutations.eventHistory.duplicate).toEqual(first.mutations.eventHistory.recorded);
    expect(first.mutations.eventHistory.messages).toMatchObject({ data: [expect.objectContaining({ id: 'msg_dev_as_001_2026-09-16T13:00:00.000Z' }), expect.objectContaining({ id: 'msg_seed_dev_as_001' })] });
    expect(first.mutations.eventHistory.restoredMessages).toEqual(first.mutations.eventHistory.messages);
    expect(first.mutations.eventHistory.foreignMessages).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.mutations.eventHistory.faultBefore).toMatchObject({ data: [{ id: 'alarm_fault_dev_na_001', status: 'open' }] });
    expect(first.mutations.eventHistory.viewerAck).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.mutations.eventHistory.missingAck).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(first.mutations.eventHistory.acknowledged).toMatchObject({ data: { id: 'alarm_fault_dev_na_001', status: 'acknowledged', acknowledgedBy: context.actorId } });
    expect(first.mutations.eventHistory.restoredAlarms).toMatchObject({ data: [{ id: 'alarm_fault_dev_na_001', status: 'acknowledged', acknowledgedBy: context.actorId }] });
    expect(first.subscription.beforeTick).toEqual([]);
    expect(first.subscription.firstTick).toMatchObject([{ data: [{ metric: 'temperature', quality: 'good' }, { metric: 'humidity', quality: 'good' }] }]);
    expect(first.subscription.afterCancel).toEqual(first.subscription.firstTick);
    expect(first.subscription.offline).toMatchObject([{ error: { code: 'DEVICE_OFFLINE' } }]);
    expect(first.subscription.invalidMetric).toMatchObject([{ error: { code: 'VALIDATION_ERROR' } }]);
    expect(first.subscription.foreign).toMatchObject([{ error: { code: 'FORBIDDEN' } }]);
    expect(first.mutations.rules.created).toMatchObject({ data: { enabled: false, version: 1 } });
    expect(first.mutations.rules.deniedToggle).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.mutations.rules.enabled).toMatchObject({ data: { enabled: true, version: 2 } });
    expect(first.mutations.rules.stale).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(first.mutations.rules.event).toMatchObject({ data: { status: 'succeeded', alarmCreated: true } });
    expect(first.mutations.rules.logs).toMatchObject({ data: { total: 1 } });
    expect(first.mutations.telemetryRule.logs).toMatchObject({ data: { total: 1, items: [{ mode: 'event', alarmCreated: true }] } });
    expect(first.mutations.telemetryRule.alarms).toMatchObject({ data: expect.arrayContaining([expect.objectContaining({ source: 'rule' })]) });
    expect(first.mutations.telemetryRule.disabledLogs).toMatchObject({ data: { total: 0 } });
    expect(first.mutations.firmware.created).toMatchObject({ data: { status: 'draft', revision: 1 } });
    expect(first.mutations.firmware.prematureRelease).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(first.mutations.firmware.verified).toMatchObject({ data: { status: 'verified', revision: 2 } });
    expect(first.mutations.firmware.stale).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(first.mutations.firmware.released).toMatchObject({ data: { status: 'released', revision: 3 } });
    expect(first.mutations.firmware.eligible).toHaveProperty('data');
    expect(first.mutations.storageQuota.quotaSet).toMatchObject({ data: { quota: { storageMb: { limit: 321 } } } });
    expect(first.mutations.storageQuota.previewBefore).toMatchObject({ data: { used: 320, projected: 321, limit: 321 } });
    expect(first.mutations.storageQuota.first).toHaveProperty('data');
    expect(first.mutations.storageQuota.previewSharedMiB).toMatchObject({ data: { used: 321, projected: 321, limit: 321 } });
    expect(first.mutations.storageQuota.second).toHaveProperty('data');
    expect(first.mutations.storageQuota.previewOver).toMatchObject({ data: { used: 321, projected: 322, limit: 321 } });
    expect(first.mutations.storageQuota.denied).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(first.mutations.storageQuota.after).toMatchObject({ data: { usage: expect.arrayContaining([expect.objectContaining({ resource: 'storageMb', used: 321 })]) } });
    expect(first.mutations.firmware.archived).toMatchObject({ data: { status: 'archived', revision: 4 } });
    expect(first.mutations.tenants.denied).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.mutations.tenants.created).toMatchObject({ data: { revision: 1 } });
    expect(first.mutations.tenants.duplicate).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(first.mutations.tenants.invited).toMatchObject({ data: { role: 'viewer', revision: 1 } });
    expect(first.mutations.tenants.updatedMember).toMatchObject({ data: { role: 'operator', revision: 2 } });
    expect(first.mutations.tenants.afterMember).toMatchObject({ data: { memberCount: 2 } });
    expect(first.mutations.ota.preview).toMatchObject({ data: { total: 4 } });
    expect(first.mutations.ota.created).toMatchObject({ data: { status: 'draft', revision: 1 } });
    expect(first.mutations.ota.deniedStart).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(first.mutations.ota.started).toMatchObject({ data: { status: 'queued' } });
    expect(first.mutations.ota.staleStart).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(first.mutations.ota.paused).toMatchObject({ data: { status: 'paused' } });
    expect(first.mutations.ota.resumed).toMatchObject({ data: { status: 'queued' } });
    expect(first.mutations.ota.cancelled).toMatchObject({ data: { status: 'cancelled' } });
    expect(first.mutations.ota.afterCancel).toMatchObject({ data: { status: 'cancelled' } });
    expect(first.mutations.rollback.sourceFinished).toMatchObject({ data: { status: 'succeeded' } });
    if ('data' in first.mutations.rollback.sourceFinished) {
      expect(first.mutations.rollback.sourceFinished.data.executions).toHaveLength(4);
      expect(first.mutations.rollback.sourceFinished.data.executions.every(row => row.status === 'succeeded')).toBe(true);
    }
    expect(first.mutations.rollback.created).toMatchObject({ data: { kind: 'rollback', status: 'draft' } });
    expect(first.mutations.rollback.finished).toMatchObject({ data: { status: 'rolledBack' } });
    expect(first.mutations.rollback.sourceAfter).toEqual(first.mutations.rollback.sourceFinished);
    expect(first.mutations.rollback.reloadedSource).toEqual(first.mutations.rollback.sourceFinished);
    expect(first.mutations.rollback.reloadedRollback).toEqual(first.mutations.rollback.finished);
    expect(first.mutations.rollback.deviceHistory).toMatchObject({ data: [{ taskStatus: 'rolledBack' }, { taskStatus: 'succeeded' }] });
    expect(first.mutations.retry.created).toMatchObject({ data: { status: 'draft' } });
    expect(first.mutations.retry.paused).toMatchObject({ data: { status: 'paused', alarmCreated: true } });
    expect(first.mutations.retry.blockedAdvance).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(first.mutations.retry.queued).toMatchObject({ data: { status: 'queued' } });
    expect(first.mutations.retry.finished).toMatchObject({ data: { status: 'succeeded' } });
    expect(first.mutations.retry.reloaded).toEqual(first.mutations.retry.finished);
    if ('data' in first.mutations.retry.finished) {
      const attempts = first.mutations.retry.finished.data.executions.filter(row => row.deviceId === 'dev_as_001');
      expect(attempts.map(row => [row.attempt, row.status])).toEqual([[1, 'failed'], [2, 'succeeded']]);
    }
    expect(first.mutations.retry.history).toMatchObject({ data: [{ execution: { attempt: 2 } }, { execution: { attempt: 1 } }] });
    await mkdir('reports', { recursive: true });
    await writeFile('reports/contract-parity.json', `${JSON.stringify(first, null, 2)}\n`);
  });
});
