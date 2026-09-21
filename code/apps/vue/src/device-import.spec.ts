import { describe, expect, it } from 'vitest';
import type { Context } from './dashboard';
import { DeviceService, type DeviceInput } from './devices';
import { parseDeviceCsv } from './device-import';
import { ProductService } from './products';
import { TenantService } from './tenants';

const tenant: Context = { actorId: 'usr_202609_001', role: 'tenantAdmin', tenantId: 'ten_202609_001', seed: 42, scenario: 'normal' };
const input = (name: string): DeviceInput => ({ tenantId: tenant.tenantId, productId: 'prod_as_001', name, region: 'AS', countryCode: 'CN', location: null, tags: ['演示'] });
function storage(): Storage { const data = new Map<string, string>(); return { get length() { return data.size; }, clear: () => data.clear(), getItem: key => data.get(key) ?? null, key: index => [...data.keys()][index] ?? null, removeItem: key => { data.delete(key); }, setItem: (key, value) => { data.set(key, value); } }; }
const service = (store: Storage) => new DeviceService(store, new ProductService(), new TenantService(store));

describe('IOT-DEVICE-001 atomic CSV import and delete', () => {
  it('parses quoted CSV and rejects missing or malformed columns', () => {
    expect(parseDeviceCsv('name,region,countryCode,tags\n"上海,一号",AS,CN,环境|演示', tenant.tenantId, 'prod_as_001')).toMatchObject({ rows: [{ name: '上海,一号', tags: ['环境', '演示'] }] });
    expect(parseDeviceCsv('name,region,countryCode\n设备,AS,CN', tenant.tenantId, 'prod_as_001')).toMatchObject({ error: expect.any(String) });
    expect(parseDeviceCsv('name,region,countryCode,tags\n"设备,AS,CN,演示', tenant.tenantId, 'prod_as_001')).toMatchObject({ error: expect.any(String) });
  });

  it('previews, imports and deletes as one confirmed operation with persistence', async () => {
    const store = storage(), current = service(store), rows = [input('批量一号'), input('批量二号')];
    expect(await current.previewImport(tenant, rows)).toMatchObject({ data: { count: 2, tenants: [{ before: 6, after: 8 }] } });
    expect(await current.importBatch(tenant, rows, false)).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await current.importBatch(tenant, rows, true)).toMatchObject({ data: [{ id: 'dev_new_001' }, { id: 'dev_new_002' }] });
    expect(await service(store).list(tenant, { tenantId: tenant.tenantId, seed: 42, page: 1, pageSize: 20 })).toMatchObject({ data: { total: 8 } });
    expect(await current.deleteBatch(tenant, ['dev_new_001', 'dev_new_002'], false)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await current.deleteBatch(tenant, ['dev_new_001', 'dev_new_002'], true)).toMatchObject({ data: { deleted: ['dev_new_001', 'dev_new_002'] } });
    expect(await service(store).list(tenant, { tenantId: tenant.tenantId, seed: 42, page: 1, pageSize: 20 })).toMatchObject({ data: { total: 6 } });
  });

  it('rejects over quota, invalid product, duplicates, observer and cross tenant batches without writes', async () => {
    const store = storage(), current = service(store), rows = Array.from({ length: 5 }, (_, index) => input(`容量${index}`));
    expect(await current.previewImport(tenant, rows)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await current.importBatch(tenant, rows, true)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await current.previewImport(tenant, [input('重复'), input('重复')])).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await current.previewImport(tenant, [{ ...input('错产品'), productId: 'prod_as_002' }])).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.previewImport({ ...tenant, role: 'viewer' }, [input('观察')])).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.deleteBatch(tenant, ['dev_as_002'], true)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.deleteBatch(tenant, ['dev_as_001', 'dev_as_002'], true)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.list(tenant, { tenantId: tenant.tenantId, seed: 42, page: 1, pageSize: 20 })).toMatchObject({ data: { total: 6 } });
  });

  it('does not reuse a live device ID after deleting an earlier imported row', async () => {
    const current = service(storage());
    await current.importBatch(tenant, [input('首台'), input('保留')], true);
    await current.deleteBatch(tenant, ['dev_new_001'], true);
    expect(await current.create(tenant, input('后续'))).toMatchObject({ data: { id: 'dev_new_003' } });
    expect(await current.get(tenant, 'dev_new_002')).toMatchObject({ data: { name: '保留' } });
  });

  it('returns a success result for reactive array inputs after the mutation', async () => {
    const current = service(storage()), rows = new Proxy([new Proxy(input('响应式设备'), {})], {});
    expect(await current.importBatch(tenant, rows, true)).toMatchObject({ data: [{ id: 'dev_new_001' }] });
    expect(await current.deleteBatch(tenant, new Proxy(['dev_new_001'], {}), true)).toMatchObject({ data: { deleted: ['dev_new_001'] } });
  });
});
