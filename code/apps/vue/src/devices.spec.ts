import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceService } from './devices';
import { ProductService } from './products';
import { TenantService } from './tenants';
import type { Context } from './dashboard';

const admin: Context = { actorId: 'usr_202609_001', role: 'platformAdmin', tenantId: 'all', seed: 42, scenario: 'normal' };
const tenant: Context = { ...admin, role: 'tenantAdmin', tenantId: 'ten_202609_001' };
const operator: Context = { ...tenant, role: 'operator' };
const viewer: Context = { ...tenant, role: 'viewer' };
const service = () => new DeviceService(null, new ProductService());
const times = { from: '2026-09-15T12:00:00.000Z', to: '2026-09-16T12:00:00.000Z' };
function storage(): Storage { const values = new Map<string, string>(); return { get length() { return values.size; }, clear: () => values.clear(), getItem: key => values.get(key) ?? null, key: index => [...values.keys()][index] ?? null, removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); } }; }
afterEach(() => vi.useRealTimers());

describe('IOT-DEVICE-001 device and telemetry contract', () => {
  it('enforces IOT-TENANT-001 hard device quotas in the create service', async () => {
    const store = storage(), quotas = new TenantService(store), current = new DeviceService(store, new ProductService(), quotas);
    const found = await quotas.get(admin, tenant.tenantId); if (!('data' in found)) throw new Error('missing tenant');
    const atLimit = { ...found.data.quota, devices: { limit: 6, warningAt: 80 } };
    expect(await quotas.updateQuota(admin, tenant.tenantId, atLimit, found.data.revision)).toMatchObject({ data: { quota: { devices: { limit: 6 } } } });
    const input = { tenantId: tenant.tenantId, productId: 'prod_as_001', name: '新设备', region: 'AS', countryCode: 'CN', location: null, tags: ['演示'] };
    expect(await current.create(tenant, input)).toMatchObject({ error: { code: 'CONFLICT', message: expect.stringContaining('已用 6/6') } });
    expect(await current.create(operator, input)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.create(tenant, { ...input, tenantId: 'ten_202609_002' })).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await quotas.updateQuota(admin, tenant.tenantId, { ...atLimit, devices: { limit: 7, warningAt: 80 } }, found.data.revision + 1)).toMatchObject({ data: { quota: { devices: { limit: 7 } } } });
    expect(await current.create(tenant, input)).toMatchObject({ data: { id: 'dev_new_001', status: 'unactivated' } });
    expect(await current.create(tenant, { ...input, name: '第二台' })).toMatchObject({ error: { code: 'CONFLICT', message: expect.stringContaining('已用 7/7') } });
    expect(await new DeviceService(store, new ProductService(), quotas).get(tenant, 'dev_new_001')).toMatchObject({ data: { name: '新设备' } });
  });
  it('filters, sorts and paginates stable device facts with tenant isolation', async () => {
    const current = service();
    const query = { tenantId: tenant.tenantId, seed: 42, page: 1, pageSize: 2 };
    expect(await current.list(tenant, query)).toMatchObject({ data: { total: 6, items: [{ id: 'dev_sa_001' }, { id: 'dev_as_001' }] } });
    expect(await current.list(tenant, { ...query, status: 'online', productId: 'prod_as_001' })).toMatchObject({ data: { total: 4 } });
    expect(await current.list(tenant, { ...query, region: 'EU', keyword: '柏林' })).toMatchObject({ data: { total: 1, items: [{ id: 'dev_eu_001' }] } });
    expect(await current.list(tenant, { ...query, page: 2 })).toMatchObject({ data: { total: 6, page: 2, items: [{ id: 'dev_oc_001' }, { id: 'dev_eu_001' }] } });
    expect(await current.list(viewer, { ...query, tenantId: 'all' })).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.get(viewer, 'dev_as_002')).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.list(admin, { ...query, tenantId: 'all', page: 0 })).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await current.list(tenant, { ...query, lastActiveFrom: '2026-02-30T11:57:00.000Z' })).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { lastActiveFrom: expect.any(String) } } });
  });

  it('compares two units and preserves explicit missing telemetry points', async () => {
    const current = service();
    const query = { deviceId: 'dev_as_001', ...times, metrics: ['temperature', 'humidity'], granularity: 'hour' as const, seed: 42 };
    const result = await current.queryTelemetry(tenant, query);
    expect(result).toMatchObject({ data: { metrics: [{ id: 'temperature', unit: '°C' }, { id: 'humidity', unit: '%RH' }] } });
    if ('error' in result) throw new Error(result.error.message);
    expect(result.data.points).toHaveLength(50);
    expect(result.data.points.filter(point => point.quality === 'missing')).toHaveLength(6);
    expect(result.data.missing).toHaveLength(3);
    expect(result.data.points.find(point => point.metric === 'temperature' && point.quality === 'missing')?.value).toBeNull();
    const offline = await current.queryTelemetry(tenant, { ...query, deviceId: 'dev_af_001' });
    if ('error' in offline) throw new Error(offline.error.message);
    expect(offline.data.points.at(-1)).toMatchObject({ quality: 'missing', value: null });
    expect(offline.data.points.some(point => point.quality === 'stale' && point.value !== null)).toBe(true);
    const beforeCreation = await current.queryTelemetry(tenant, { ...query, from: '2026-08-28T00:00:00.000Z', to: '2026-08-29T00:00:00.000Z' });
    expect(beforeCreation).toMatchObject({ data: { noData: true } });
    if ('data' in beforeCreation) expect(beforeCreation.data.points.every(point => point.value === null && point.quality === 'missing')).toBe(true);
    expect(await current.queryTelemetry(tenant, { ...query, from: query.to })).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await current.queryTelemetry(tenant, { ...query, from: '2026-09-31T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' })).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { range: expect.any(String) } } });
    expect(await current.queryTelemetry(tenant, { ...query, metrics: ['unknown'] })).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await current.queryTelemetry({ ...tenant, scenario: 'partialFailure' }, query)).toMatchObject({ error: { code: 'SCENARIO_TIMEOUT' } });
  });

  it('validates model-driven commands and records offline failure or online completion', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-16T12:00:00.000Z'));
    const current = service();
    expect(await current.writableItems(operator, 'dev_as_001')).toMatchObject({ data: [{ identifier: 'sampling_interval' }, { identifier: 'reboot' }] });
    expect(await current.executeCommand(viewer, 'dev_as_001', 'tm_sampling_interval', 100)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.executeCommand(operator, 'dev_as_001', 'tm_temperature', 25)).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await current.executeCommand(operator, 'dev_as_001', 'tm_sampling_interval', 1001)).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { value: expect.any(String) } } });
    expect(await current.executeCommand(operator, 'dev_af_001', 'tm_reboot', true)).toMatchObject({ data: { status: 'failed', reason: '设备离线或不可控制' } });
    expect(await current.executeCommand(operator, 'dev_as_001', 'tm_sampling_interval', 100)).toMatchObject({ data: { status: 'pending' } });
    vi.advanceTimersByTime(600);
    expect(await current.commandHistory(operator, 'dev_as_001')).toMatchObject({ data: [{ status: 'succeeded', value: 100 }] });
    expect(await current.get(operator, 'dev_as_001')).toMatchObject({ data: { attributes: { sampling_interval: 100 } } });
    expect(await current.executeCommand({ ...operator, scenario: 'offline' }, 'dev_as_001', 'tm_reboot', true)).toMatchObject({ error: { code: 'SCENARIO_TIMEOUT' } });
  });

  it('limits metadata changes to admins and rejects stale versions', async () => {
    const current = service();
    const input = { name: '上海试验设备', tags: ['试验', '传感器'] };
    expect(await current.updateMetadata(operator, 'dev_as_001', input, 1)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.updateMetadata(tenant, 'dev_as_001', input, 1)).toMatchObject({ data: { name: input.name, version: 2 } });
    expect(await current.updateMetadata(tenant, 'dev_as_001', input, 1)).toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('streams deterministic simulated points and stops after unsubscribe', () => {
    vi.useFakeTimers();
    const current = service();
    const events: unknown[] = [];
    const unsubscribe = current.subscribeTelemetry(tenant, 'dev_as_001', ['temperature', 'humidity'], 'hour', event => events.push(event));
    vi.advanceTimersByTime(5000);
    expect(events).toMatchObject([{ data: [{ metric: 'temperature', quality: 'good' }, { metric: 'humidity', quality: 'good' }] }]);
    unsubscribe();
    vi.advanceTimersByTime(10_000);
    expect(events).toHaveLength(1);
    const failures: unknown[] = [];
    current.subscribeTelemetry(tenant, 'dev_af_001', ['temperature'], 'hour', event => failures.push(event));
    expect(failures).toMatchObject([{ error: { code: 'DEVICE_OFFLINE' } }]);
  });

  it('persists metadata and completed commands across service instances', async () => {
    localStorage.removeItem('iot-atlas-devices-v1');
    localStorage.removeItem('iot-atlas-device-commands-v1');
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-16T12:00:00.000Z'));
    try {
      const first = new DeviceService(localStorage, new ProductService());
      const second = new DeviceService(localStorage, new ProductService());
      expect(await first.updateMetadata(tenant, 'dev_as_001', { name: '持久设备', tags: ['环境'] }, 1)).toMatchObject({ data: { version: 2 } });
      expect(await second.get(tenant, 'dev_as_001')).toMatchObject({ data: { name: '持久设备', version: 2 } });
      expect(await second.updateMetadata(tenant, 'dev_as_001', { name: '旧版本', tags: ['环境'] }, 1)).toMatchObject({ error: { code: 'CONFLICT' } });
      expect(await first.executeCommand(operator, 'dev_as_001', 'tm_sampling_interval', 120)).toMatchObject({ data: { status: 'pending' } });
      vi.advanceTimersByTime(600);
      expect(await second.commandHistory(operator, 'dev_as_001')).toMatchObject({ data: [{ status: 'succeeded' }] });
      expect(await new DeviceService(localStorage, new ProductService()).get(tenant, 'dev_as_001')).toMatchObject({ data: { attributes: { sampling_interval: 120 } } });
    } finally { localStorage.removeItem('iot-atlas-devices-v1'); localStorage.removeItem('iot-atlas-device-commands-v1'); }
  });
});
