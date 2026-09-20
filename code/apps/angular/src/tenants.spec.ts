import { describe, expect, it } from 'vitest';
import { TenantService, type TenantInput } from './tenants';
import type { Context } from './dashboard';

const admin: Context = { actorId: 'usr_test', role: 'platformAdmin', tenantId: 'all', seed: 42, scenario: 'normal' };
const tenant: Context = { ...admin, role: 'tenantAdmin', tenantId: 'ten_202609_001' };
const viewer: Context = { ...tenant, role: 'viewer' };
function storage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null, removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); } };
}
const query = { tenantId: 'all', seed: 42, page: 1, pageSize: 10 };

function tenantInput(): TenantInput {
  return { name: '测试租户', key: 'test-tenant', status: 'active', plan: 'standard', contact: '测试人', email: 'test@example.com', description: '演示', quota: {
    devices: { limit: 8, warningAt: 80 }, products: { limit: 5, warningAt: 80 }, messages: { limit: 100, warningAt: 80 }, storageMb: { limit: 256, warningAt: 80 }, otaConcurrent: { limit: 2, warningAt: 80 },
  } };
}

describe('IOT-TENANT-001 tenant and quota contract', () => {
  it('lists only permitted tenants, supports filters, and returns quota and member summaries', async () => {
    const service = new TenantService();
    expect(await service.list(admin, query)).toMatchObject({ data: { total: 2, items: [{ id: 'ten_202609_001', memberCount: 3 }, { id: 'ten_202609_002', memberCount: 1 }] } });
    expect(await service.list(tenant, { ...query, tenantId: tenant.tenantId })).toMatchObject({ data: { total: 1, items: [{ id: tenant.tenantId }] } });
    expect(await service.list(tenant, query)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await service.get(tenant, 'ten_202609_002')).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await service.list(viewer, { ...query, tenantId: viewer.tenantId })).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await service.list(admin, { ...query, keyword: 'global-energy', plan: 'professional' })).toMatchObject({ data: { total: 1, items: [{ id: 'ten_202609_002' }] } });
    expect(await service.list(admin, { ...query, seed: 41 })).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await service.get(tenant, tenant.tenantId)).toMatchObject({ data: { members: [{ role: 'tenantAdmin' }, { role: 'operator' }, { role: 'viewer' }] } });
  });

  it('creates tenant records with validation, unique keys and stale revision rejection', async () => {
    const service = new TenantService(), input = tenantInput();
    expect(await service.save(tenant, input)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await service.save(admin, { ...input, email: 'bad', quota: { ...input.quota, devices: { limit: 0, warningAt: 80 } } })).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { email: expect.any(String), 'quota.devices': expect.any(String) } } });
    const created = await service.save(admin, input);
    expect(created).toMatchObject({ data: { id: 'ten_202609_003', revision: 1 } });
    expect(await service.get(admin, 'ten_202609_003')).toMatchObject({ data: { memberCount: 1, members: [{ role: 'tenantAdmin', email: 'test@example.com' }] } });
    expect(await service.save(admin, input)).toMatchObject({ error: { code: 'CONFLICT', fieldErrors: { key: expect.any(String) } } });
    expect(await service.save(admin, { ...input, name: '改名' }, 'ten_202609_003', 0)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await service.save(admin, { ...input, name: '改名' }, 'ten_202609_003', 1)).toMatchObject({ data: { name: '改名', revision: 2 } });
  });

  it('previews warning, blocks lower than used quotas, and rejects creation at a hard device limit', async () => {
    const service = new TenantService();
    const found = await service.get(admin, 'ten_202609_001'); if (!('data' in found)) throw new Error('missing tenant');
    const warning = { ...found.data.quota, devices: { limit: 7, warningAt: 80 } };
    const preview = await service.previewQuota(admin, found.data.id, warning);
    expect(preview).toMatchObject({ data: { blocked: [] } });
    if (!('data' in preview)) throw new Error('missing preview');
    expect(preview.data.usage[0]).toMatchObject({ resource: 'devices', used: 6, health: 'warning' });
    expect(await service.updateQuota(admin, found.data.id, warning, 1)).toMatchObject({ data: { revision: 2, quota: { devices: { limit: 7 } } } });
    expect(await service.checkCapacity(tenant, found.data.id, 'devices', 6)).toMatchObject({ data: { health: 'warning', used: 6, limit: 7 } });
    expect(await service.checkCapacity(tenant, found.data.id, 'devices', 7)).toMatchObject({ error: { code: 'CONFLICT', message: expect.stringContaining('已用 7/7') } });
    expect(await service.updateQuota(admin, found.data.id, { ...warning, devices: { limit: 5, warningAt: 80 } }, 2)).toMatchObject({ error: { code: 'CONFLICT', message: expect.stringContaining('devices 6/5') } });
    expect(await service.checkCapacity(viewer, found.data.id, 'devices', 1)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await service.checkCapacity(tenant, 'ten_202609_002', 'devices', 1)).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('reads live usage from its own browser storage and persists across service instances', async () => {
    const store = storage(), first = new TenantService(store), second = new TenantService(store);
    store.setItem('iot-atlas-devices-v1', JSON.stringify([{ tenantId: 'ten_202609_001' }]));
    store.setItem('iot-atlas-products-v1', JSON.stringify([{ tenantId: 'ten_202609_002' }, { tenantId: 'ten_202609_002' }]));
    store.setItem('iot-atlas-device-messages-v1', JSON.stringify([{ id: 'msg_new_1', tenantId: 'ten_202609_001' }, { id: 'msg_seed_dev_as_001', tenantId: 'ten_202609_001' }, { id: 'msg_new_2', tenantId: 'ten_202609_002' }, null, { tenantId: 'ten_202609_001' }]));
    const found = await first.get(admin, 'ten_202609_001');
    if (!('data' in found)) throw new Error('missing tenant');
    expect(found.data.usage.slice(0, 2)).toMatchObject([{ resource: 'devices', used: 1 }, { resource: 'products', used: 0 }]);
    expect(found.data.usage.find(item => item.resource === 'messages')).toMatchObject({ used: 6_801 });
    expect(await second.get(admin, 'ten_202609_002')).toMatchObject({ data: { usage: expect.arrayContaining([{ resource: 'messages', used: 2_401, limit: 10_000, warningAt: 80, percent: 24, health: 'normal' }]) } });
    const input = tenantInput();
    expect(await first.save(admin, input)).toMatchObject({ data: { id: 'ten_202609_003' } });
    expect(await second.get(admin, 'ten_202609_003')).toMatchObject({ data: { key: 'test-tenant' } });
  });

  it('blocks creation for a suspended tenant and returns scenario errors', async () => {
    const service = new TenantService();
    const found = await service.get(admin, 'ten_202609_001'); if (!('data' in found)) throw new Error('missing tenant');
    expect(await service.save(admin, { ...found.data, status: 'suspended' }, found.data.id, found.data.revision)).toMatchObject({ data: { status: 'suspended' } });
    expect(await service.checkCapacity(tenant, found.data.id, 'devices', 0)).toMatchObject({ error: { code: 'CONFLICT', message: expect.stringContaining('已停用') } });
    expect(await service.list({ ...admin, scenario: 'offline' }, query)).toMatchObject({ error: { code: 'SCENARIO_TIMEOUT', retryable: true } });
    expect(await service.get({ ...admin, scenario: 'forbidden' }, found.data.id)).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('invites and edits members, prevents duplicate email and preserves a tenant administrator', async () => {
    const service = new TenantService(), id = 'ten_202609_001';
    const input = { name: '新成员', email: 'new@example.com', role: 'viewer' as const, status: 'active' as const };
    expect(await service.inviteMember(tenant, id, input)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await service.inviteMember(admin, id, input)).toMatchObject({ data: { id: 'mem_005', role: 'viewer' } });
    expect(await service.inviteMember(admin, id, { ...input, email: 'NEW@example.com' })).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await service.updateMember(admin, id, 'mem_005', { ...input, role: 'operator' }, 1)).toMatchObject({ data: { role: 'operator', revision: 2 } });
    expect(await service.updateMember(admin, id, 'mem_005', input, 1)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await service.updateMember(admin, id, 'mem_001', { ...input, email: 'zhangsan@example.com', role: 'viewer' }, 1)).toMatchObject({ error: { code: 'CONFLICT', message: expect.stringContaining('至少一名') } });
    expect(await service.removeMember(admin, id, 'mem_001', 1)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await service.removeMember(admin, id, 'mem_005', 2)).toMatchObject({ data: { id: 'mem_005' } });
    expect(await service.get(admin, id)).toMatchObject({ data: { memberCount: 3 } });
  });
});
