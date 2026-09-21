import { describe, expect, it } from 'vitest';
import type { Context } from './dashboard';
import { DeviceService } from './devices';
import { FirmwareService } from './firmware';
import { OtaService, type OtaInput, type OtaTask } from './ota';
import { ProductService } from './products';
import { TenantService } from './tenants';

const admin: Context = { actorId: 'usr_test', role: 'tenantAdmin', tenantId: 'ten_202609_001', seed: 42, scenario: 'normal' };
const operator: Context = { ...admin, role: 'operator' }, viewer: Context = { ...admin, role: 'viewer' };
const input: OtaInput = { tenantId: 'ten_202609_001', firmwareId: 'fw_as_001', productId: 'prod_as_001',
  targetSelector: { deviceIds: ['dev_as_001', 'dev_eu_001', 'dev_oc_001', 'dev_sa_001'], tags: [] }, batches: [10, 90], failureThreshold: 0.2, failureModes: { dev_as_001: 'download' } };
function storage(): Storage { const data = new Map<string, string>(); return { get length() { return data.size; }, clear: () => data.clear(), getItem: key => data.get(key) ?? null, key: index => [...data.keys()][index] ?? null, removeItem: key => { data.delete(key); }, setItem: (key, value) => { data.set(key, value); } }; }
function setup() { const store = storage(); const products = new ProductService(); const firmware = new FirmwareService(store, products); const devices = new DeviceService(store, products); return { store, firmware, devices, ota: new OtaService(store, firmware, devices) }; }
function value<T>(response: { data: T } | { error: unknown }): T { if ('error' in response) throw new Error(JSON.stringify(response.error)); return response.data; }
async function ticks(ota: OtaService, id: string, count: number, context = operator): Promise<OtaTask> { let task: OtaTask | null = null; for (let i = 0; i < count; i++) task = value(await ota.advance(context, id)); return task!; }

describe('IOT-OTA-001 OTA lifecycle contract', () => {
  it('blocks concurrent OTA starts at the tenant hard quota', async () => {
    const { ota, store } = setup();
    const tenants = new TenantService(store);
    const tenant = value(await tenants.get(admin, admin.tenantId));
    value(await tenants.updateQuota({ ...admin, role: 'platformAdmin', tenantId: 'all' }, tenant.id, { ...tenant.quota, otaConcurrent: { limit: 1, warningAt: 80 } }, tenant.revision));
    const first = value(await ota.create(admin, { ...input, failureModes: {} }));
    const second = value(await ota.create(admin, { ...input, failureModes: {} }));
    const started = value(await ota.start(admin, first.id, first.revision));
    expect(await ota.start(admin, second.id, second.revision)).toMatchObject({ error: { code: 'CONFLICT', message: expect.stringContaining('已用 1/1') } });
    value(await ota.pause(operator, first.id, started.revision));
    expect(await ota.start(admin, second.id, second.revision)).toMatchObject({ data: { status: 'queued' } });
  });
  it('previews deterministic batches and rejects incompatible firmware, devices, percentages and roles', async () => {
    const { ota } = setup();
    expect(await ota.preview(admin, input)).toMatchObject({ data: { total: 4, batchCounts: [1, 3], offline: 0 } });
    expect(await ota.preview(viewer, input)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await ota.preview(operator, input)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await ota.preview(admin, { ...input, batches: [10, 80] })).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { batches: expect.any(String) } } });
    expect(await ota.preview(admin, { ...input, firmwareId: 'fw_as_003' })).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await ota.preview(admin, { ...input, targetSelector: { deviceIds: ['dev_as_002'], tags: [] } })).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await ota.preview(admin, { ...input, targetSelector: { deviceIds: ['dev_af_001'], tags: [] } })).toMatchObject({ data: { offline: 1, devices: [{ compatible: false, reason: expect.any(String) }] } });
  });

  it('auto pauses at the failed first batch, keeps later devices unstarted, then retries with immutable history', async () => {
    const { ota } = setup(); const seen: string[] = []; const unsubscribe = ota.subscribe(event => seen.push(event.id));
    const created = value(await ota.create(admin, input));
    expect(created.status).toBe('draft');
    expect(await ota.start(operator, created.id, 1)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    const started = value(await ota.start(admin, created.id, 1));
    expect(started.executions).toHaveLength(1);
    const paused = await ticks(ota, created.id, 2);
    expect(paused).toMatchObject({ status: 'paused', alarmCreated: true, currentBatch: 0, executions: [{ status: 'failed', reason: '模拟下载失败' }] });
    expect(paused.events.some(event => event.type === 'threshold.exceeded')).toBe(true);
    expect(await ota.advance(operator, created.id)).toMatchObject({ error: { code: 'CONFLICT' } });
    const retried = value(await ota.retry(operator, created.id, 'dev_as_001', paused.revision));
    expect(retried.executions).toHaveLength(2);
    expect(retried.executions.map(row => [row.attempt, row.status])).toEqual([[1, 'failed'], [2, 'queued']]);
    const next = await ticks(ota, created.id, 5);
    expect(next.currentBatch).toBe(1);
    expect(next.executions[0].status).toBe('failed');
    expect(next.executions[1].status).toBe('succeeded');
    const finished = await ticks(ota, created.id, 5);
    expect(finished.status).toBe('succeeded');
    expect(finished.executions.filter(row => row.status === 'succeeded')).toHaveLength(4);
    expect(new Set(seen).size).toBe(seen.length);
    unsubscribe();
  });

  it('creates a separate reverse task and preserves source task and device attempt history', async () => {
    const { ota } = setup(); const created = value(await ota.create(admin, { ...input, failureModes: {}, batches: [100] }));
    value(await ota.start(admin, created.id, 1)); const succeeded = await ticks(ota, created.id, 5);
    expect(succeeded.status).toBe('succeeded');
    const source = structuredClone(succeeded);
    const reversal = value(await ota.rollback(admin, created.id, succeeded.revision));
    expect(reversal).toMatchObject({ kind: 'rollback', sourceTaskId: created.id, firmwareId: 'fw_as_002', status: 'draft' });
    value(await ota.start(admin, reversal.id, 1));
    const rolled = await ticks(ota, reversal.id, 5);
    expect(rolled.status).toBe('rolledBack');
    expect(rolled.executions.every(row => row.fromVersion === '2.4.1' && row.toVersion === '2.3.0')).toBe(true);
    expect(value(await ota.get(admin, created.id))).toEqual(source);
    expect(await ota.historyForDevice(admin, 'dev_as_001')).toMatchObject({ data: [{ taskId: reversal.id }, { taskId: created.id }] });
  });

  it('guards task controls, tenant isolation and stale revisions', async () => {
    const { ota } = setup(); const created = value(await ota.create(admin, { ...input, failureModes: {} }));
    expect(await ota.cancel(viewer, created.id, 1)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await ota.pause(operator, created.id, 1)).toMatchObject({ error: { code: 'CONFLICT' } });
    const started = value(await ota.start(admin, created.id, 1));
    expect(await ota.start(admin, created.id, 1)).toMatchObject({ error: { code: 'CONFLICT' } });
    const paused = value(await ota.pause(operator, created.id, started.revision));
    expect(paused.status).toBe('paused');
    expect(await ota.resume(operator, created.id, started.revision)).toMatchObject({ error: { code: 'CONFLICT' } });
    const resumed = value(await ota.resume(operator, created.id, paused.revision));
    expect(resumed.status).toBe('queued');
    expect(await ota.cancel(operator, created.id, resumed.revision)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await ota.cancel(admin, created.id, resumed.revision)).toMatchObject({ data: { status: 'cancelled' } });
    const stranger = { ...admin, tenantId: 'ten_202609_002' };
    expect(await ota.get(stranger, created.id)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await ota.list(stranger, { tenantId: 'ten_202609_001', seed: 42, page: 1, pageSize: 10 })).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('persists tasks without replacing previous events or executing while disconnected', async () => {
    const { ota, store, firmware, devices } = setup();
    const created = value(await ota.create(admin, { ...input, failureModes: {} }));
    value(await ota.start(admin, created.id, 1));
    const reload = new OtaService(store, firmware, devices);
    expect(await reload.get(admin, created.id)).toMatchObject({ data: { status: 'queued', executions: [{ attempt: 1 }] } });
    expect(await reload.advance(viewer, created.id)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    const before = value(await reload.get(admin, created.id));
    expect(before.executions[0].status).toBe('queued');
    const after = value(await reload.advance(operator, created.id));
    expect(after.executions[0].status).toBe('downloading');
    expect(value(await ota.get(admin, created.id))).toEqual(after);
  });
});
