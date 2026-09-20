import { describe, expect, it } from 'vitest';
import type { Context } from './dashboard';
import { DeviceEventService } from './device-events';
import { DeviceService, initialDeviceReport } from './devices';
import { ProductService } from './products';
import { RuleService } from './rules';
import { FirmwareService } from './firmware';
import { OtaService, type OtaInput } from './ota';
import { TenantService } from './tenants';

const admin: Context = { actorId: 'usr_202609_001', role: 'platformAdmin', tenantId: 'all', seed: 42, scenario: 'normal' };
const operator: Context = { ...admin, role: 'operator', tenantId: 'ten_202609_001' };
function storage(): Storage { const data = new Map<string, string>(); return { get length() { return data.size; }, clear: () => data.clear(), getItem: key => data.get(key) ?? null, key: index => [...data.keys()][index] ?? null, removeItem: key => { data.delete(key); }, setItem: (key, value) => { data.set(key, value); } }; }

describe('IOT-DEVICE-001 messages and alarm acknowledgement', () => {
  it('keeps the seed report unchanged after live attributes move forward', async () => {
    const store = storage(), current = new DeviceService(store, new ProductService()), events = new DeviceEventService(store, current);
    const seed = initialDeviceReport('dev_as_001');
    expect(seed).not.toBeNull();
    expect(await current.applyTelemetry(operator, 'dev_as_001', [{ deviceId: 'dev_as_001', metric: 'temperature', timestamp: '2026-09-16T13:00:00.000Z', value: 31.4, unit: '°C', quality: 'good' }])).toMatchObject({ data: { lastActiveAt: '2026-09-16T13:00:00.000Z' } });
    const listed = await events.listMessages(operator, 'dev_as_001');
    expect(listed).toMatchObject({ data: [{ id: 'msg_seed_dev_as_001', occurredAt: seed!.lastActiveAt, payload: { temperature: 24.5 } }] });
  });
  it('records valid live reports once and restores them from this app storage', async () => {
    const store = storage(), first = new DeviceEventService(store);
    const points = [{ deviceId: 'dev_as_001', metric: 'temperature', timestamp: '2026-09-16T13:00:00.000Z', value: 82, unit: '°C', quality: 'good' as const }];
    let notifications = 0;
    const changed = () => { notifications++; };
    window.addEventListener('iot-atlas-mock-changed', changed);
    expect(await first.recordTelemetry(operator, 'dev_as_001', points)).toMatchObject({ data: { payload: { temperature: 82 } } });
    expect(notifications).toBe(2);
    window.removeEventListener('iot-atlas-mock-changed', changed);
    await first.recordTelemetry(operator, 'dev_as_001', points);
    const listed = await new DeviceEventService(store).listMessages(operator, 'dev_as_001');
    if ('error' in listed) throw new Error(listed.error.message);
    expect(listed.data[0]).toMatchObject({ id: 'msg_dev_as_001_2026-09-16T13:00:00.000Z' });
    expect(listed.data).toHaveLength(2);
    expect(await first.recordTelemetry(operator, 'dev_as_001', [{ ...points[0], value: null, quality: 'missing' }])).toMatchObject({ data: null });
    expect(await first.recordTelemetry(operator, 'dev_as_001', [{ ...points[0], deviceId: 'dev_as_002' }])).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await first.listMessages(operator, 'dev_as_002')).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('consumes a new live report with enabled rules once and ignores disabled rules', async () => {
    const store = storage(), ruleService = new RuleService(store);
    const events = new DeviceEventService(store, undefined, undefined, ruleService);
    const point = { deviceId: 'dev_as_001', metric: 'temperature', timestamp: '2026-09-16T13:00:00.000Z', value: 82, unit: '°C', quality: 'good' as const };
    await events.recordTelemetry(operator, point.deviceId, [point]);
    await events.recordTelemetry(operator, point.deviceId, [point]);
    const logs = await ruleService.logsFor(operator, { tenantId: operator.tenantId, ruleId: 'rule_high_temp', page: 1, pageSize: 100, seed: operator.seed });
    if ('error' in logs) throw new Error(logs.error.message);
    expect(logs.data.items).toMatchObject([{ mode: 'event', alarmCreated: true, deviceId: point.deviceId }]);
    expect(await events.listAlarms(operator, point.deviceId)).toMatchObject({ data: expect.arrayContaining([expect.objectContaining({ source: 'rule' })]) });
    const other = { ...operator, tenantId: 'ten_202609_002' };
    const disabledPoint = { deviceId: 'dev_as_002', metric: 'voltage', timestamp: '2026-09-16T13:01:00.000Z', value: 220, unit: 'V', quality: 'good' as const };
    await events.recordTelemetry(other, disabledPoint.deviceId, [disabledPoint]);
    const disabledLogs = await ruleService.logsFor(other, { tenantId: other.tenantId, ruleId: 'rule_low_battery', page: 1, pageSize: 100, seed: other.seed });
    if ('error' in disabledLogs) throw new Error(disabledLogs.error.message);
    expect(disabledLogs.data.total).toBe(0);
    const viewerPoint = { ...point, timestamp: '2026-09-16T13:02:00.000Z' };
    await events.recordTelemetry({ ...operator, role: 'viewer' }, point.deviceId, [viewerPoint]);
    const afterViewer = await ruleService.logsFor(operator, { tenantId: operator.tenantId, ruleId: 'rule_high_temp', page: 1, pageSize: 100, seed: operator.seed });
    if ('error' in afterViewer) throw new Error(afterViewer.error.message);
    expect(afterViewer.data.total).toBe(1);
  });

  it('counts live messages against the tenant hard quota without charging duplicate reports', async () => {
    const store = storage(), tenants = new TenantService(store), ruleService = new RuleService(store), events = new DeviceEventService(store, undefined, undefined, ruleService);
    const current = await tenants.get(admin, 'ten_202609_001');
    if ('error' in current) throw new Error(current.error.message);
    const quota = { ...current.data.quota, messages: { limit: 6_801, warningAt: 80 } };
    expect(await tenants.updateQuota(admin, current.data.id, quota, current.data.revision)).toMatchObject({ data: { quota: { messages: { limit: 6_801 } } } });
    const point = { deviceId: 'dev_as_001', metric: 'temperature', timestamp: '2026-09-16T13:00:00.000Z', value: 82, unit: '°C', quality: 'good' as const };
    expect(await events.recordTelemetry(operator, point.deviceId, [point])).toMatchObject({ data: { id: `msg_${point.deviceId}_${point.timestamp}` } });
    expect(await events.recordTelemetry(operator, point.deviceId, [point])).toMatchObject({ data: { id: `msg_${point.deviceId}_${point.timestamp}` } });
    expect(await tenants.get(admin, current.data.id)).toMatchObject({ data: { usage: expect.arrayContaining([expect.objectContaining({ resource: 'messages', used: 6_801, health: 'exceeded' })]) } });
    expect(await events.recordTelemetry(operator, point.deviceId, [{ ...point, timestamp: '2026-09-16T13:01:00.000Z' }])).toMatchObject({ error: { code: 'CONFLICT', message: expect.stringContaining('6801/6801') } });
    expect(await events.listMessages(operator, point.deviceId)).toMatchObject({ data: expect.arrayContaining([expect.objectContaining({ id: `msg_${point.deviceId}_${point.timestamp}` })]) });
    const logs = await ruleService.logsFor(operator, { tenantId: operator.tenantId, ruleId: 'rule_high_temp', page: 1, pageSize: 100, seed: operator.seed });
    if ('error' in logs) throw new Error(logs.error.message);
    expect(logs.data.total).toBe(1);
  });

  it('allows only one concurrent new report for the last message slot', async () => {
    const store = storage(), tenants = new TenantService(store), events = new DeviceEventService(store);
    const current = await tenants.get(admin, 'ten_202609_001');
    if ('error' in current) throw new Error(current.error.message);
    await tenants.updateQuota(admin, current.data.id, { ...current.data.quota, messages: { limit: 6_801, warningAt: 80 } }, current.data.revision);
    const point = { deviceId: 'dev_as_001', metric: 'temperature', timestamp: '2026-09-16T13:00:00.000Z', value: 82, unit: '°C', quality: 'good' as const };
    const results = await Promise.all([events.recordTelemetry(operator, point.deviceId, [point]), events.recordTelemetry(operator, point.deviceId, [{ ...point, timestamp: '2026-09-16T13:01:00.000Z' }])]);
    expect(results.filter(result => 'data' in result)).toHaveLength(1);
    expect(results.filter(result => 'error' in result)).toMatchObject([{ error: { code: 'CONFLICT' } }]);
    expect(await tenants.get(admin, current.data.id)).toMatchObject({ data: { usage: expect.arrayContaining([expect.objectContaining({ resource: 'messages', used: 6_801 })]) } });
  });

  it('shows fault alarm, forbids viewer acknowledgement and persists authorized acknowledgement', async () => {
    const store = storage(), first = new DeviceEventService(store), id = 'alarm_fault_dev_na_001';
    expect(await first.listAlarms(operator, 'dev_na_001')).toMatchObject({ data: [{ id, status: 'open' }] });
    expect(await first.acknowledge({ ...operator, role: 'viewer' }, 'dev_na_001', id)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await first.acknowledge(operator, 'dev_na_001', 'missing')).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(await first.acknowledge(operator, 'dev_na_001', id)).toMatchObject({ data: { status: 'acknowledged', acknowledgedBy: operator.actorId } });
    expect(await new DeviceEventService(store).listAlarms(operator, 'dev_na_001')).toMatchObject({ data: [{ status: 'acknowledged' }] });
    expect(await first.listAlarms(operator, 'dev_eu_002')).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('includes alarms created by rule execution for the same device', async () => {
    const store = storage(), ruleService = new RuleService(store);
    const current = new DeviceEventService(store, undefined, undefined, ruleService);
    const sample = { deviceId: 'dev_as_001', productId: 'prod_as_001', occurredAt: '2026-09-16T14:00:00.000Z', properties: { temperature: 82, humidity: 40 } };
    expect(await ruleService.consumeEvent(operator, 'rule_high_temp', sample)).toMatchObject({ data: { alarmCreated: true } });
    const listed = await current.listAlarms(operator, sample.deviceId);
    if ('error' in listed) throw new Error(listed.error.message);
    expect(listed.data).toEqual(expect.arrayContaining([expect.objectContaining({ source: 'rule', description: expect.stringContaining('rule_high_temp') })]));
  });

  it('shows an OTA threshold alarm on the failed device and persists acknowledgement', async () => {
    const store = storage(), products = new ProductService(), firmware = new FirmwareService(store, products);
    const current = new DeviceService(store, products), ota = new OtaService(store, firmware, current);
    const events = new DeviceEventService(store, current, ota);
    const input: OtaInput = { tenantId: operator.tenantId, firmwareId: 'fw_as_001', productId: 'prod_as_001',
      targetSelector: { deviceIds: ['dev_as_001'], tags: [] }, batches: [100], failureThreshold: 0,
      failureModes: { dev_as_001: 'download' } };
    const created = await ota.create(admin, input);
    if ('error' in created) throw new Error(created.error.message);
    const before = await events.listAlarms(operator, 'dev_as_001');
    if ('error' in before) throw new Error(before.error.message);
    expect(before.data.filter(item => item.source === 'ota')).toEqual([]);
    expect(await ota.start(admin, created.data.id, created.data.revision)).toHaveProperty('data');
    await ota.advance(operator, created.data.id);
    await ota.advance(operator, created.data.id);
    const listed = await events.listAlarms(operator, 'dev_as_001');
    if ('error' in listed) throw new Error(listed.error.message);
    const otaAlarms = listed.data.filter(item => item.source === 'ota');
    expect(otaAlarms).toEqual([expect.objectContaining({ source: 'ota', severity: 'major', taskId: created.data.id, status: 'open' })]);
    const alarmId = otaAlarms[0].id;
    expect(await events.acknowledge(operator, 'dev_as_001', alarmId)).toMatchObject({ data: { status: 'acknowledged' } });
    const restored = await new DeviceEventService(store, current, new OtaService(store, firmware, current)).listAlarms(operator, 'dev_as_001');
    if ('error' in restored) throw new Error(restored.error.message);
    expect(restored.data.find(item => item.id === alarmId)).toMatchObject({ status: 'acknowledged' });
    expect(await events.listAlarms(operator, 'dev_as_002')).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });
});
