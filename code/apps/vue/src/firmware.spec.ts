import { describe, expect, it } from 'vitest';
import { FirmwareService, inspectFirmwareFile, type FirmwareInput } from './firmware';
import { ProductService } from './products';
import type { Context } from './dashboard';

const admin: Context = { actorId: 'usr_test', role: 'platformAdmin', tenantId: 'all', seed: 42, scenario: 'normal' };
const tenant: Context = { ...admin, role: 'tenantAdmin', tenantId: 'ten_202609_001' };
const viewer: Context = { ...tenant, role: 'viewer' };
const operator: Context = { ...tenant, role: 'operator' };
const input: FirmwareInput = {
  tenantId: 'ten_202609_001', productId: 'prod_as_001', compatibleProductIds: ['prod_as_001'],
  name: 'sensor-core', version: '2.5.0', description: '演示版本', fileName: 'sensor-core-2.5.0.bin',
  sizeBytes: 2048, checksum: 'a'.repeat(64), checksumValid: true,
};
function storage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null, removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); } };
}
function service(store: Storage | null = null) { return new FirmwareService(store, new ProductService()); }

describe('IOT-FIRMWARE-001 firmware contract', () => {
  it('filters, pages, isolates tenants and rejects invalid queries', async () => {
    const mock = service();
    expect(await mock.list(admin, { tenantId: 'all', seed: 42, page: 1, pageSize: 2 })).toMatchObject({ data: { total: 3, items: [{ id: 'fw_as_001' }, { id: 'fw_as_002' }] } });
    expect(await mock.list(tenant, { tenantId: 'ten_202609_001', seed: 42, page: 1, pageSize: 10, keyword: '2.3.0' })).toMatchObject({ data: { total: 1, items: [{ id: 'fw_as_002' }] } });
    expect(await mock.list(viewer, { tenantId: 'all', seed: 42, page: 1, pageSize: 10 })).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await mock.get(viewer, 'fw_as_003')).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await mock.list(admin, { tenantId: 'all', seed: 41, page: 1, pageSize: 10 })).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('enforces admin rights, file policy, product compatibility and unique version', async () => {
    const mock = service();
    expect(await mock.create(operator, input)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await mock.create(viewer, input)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await mock.create(tenant, { ...input, fileName: 'bad.zip' })).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { fileName: expect.any(String) } } });
    expect(await mock.create(tenant, { ...input, sizeBytes: 65 * 1024 * 1024 })).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { sizeBytes: expect.any(String) } } });
    expect(await mock.create(tenant, { ...input, version: '2.4.1' })).toMatchObject({ error: { code: 'CONFLICT', fieldErrors: { version: expect.any(String) } } });
    expect(await mock.create(tenant, { ...input, compatibleProductIds: ['prod_as_001', 'prod_as_002'] })).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { compatibleProductIds: expect.any(String) } } });
    expect(await mock.create(tenant, { ...input, productId: 'prod_as_002', compatibleProductIds: ['prod_as_002'] })).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('verifies, releases, archives, and preserves immutable released metadata', async () => {
    const mock = service();
    const created = await mock.create(tenant, input);
    expect(created).toMatchObject({ data: { status: 'draft', revision: 1, createdBy: 'usr_test' } });
    if (!('data' in created)) throw new Error('create failed');
    const id = created.data.id;
    expect(await mock.eligible(tenant, id, input.productId)).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await mock.transition(tenant, id, 'release', 1)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await mock.transition(tenant, id, 'verify', 1)).toMatchObject({ data: { status: 'verified', revision: 2 } });
    expect(await mock.transition(tenant, id, 'verify', 1)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await mock.transition(tenant, id, 'release', 2)).toMatchObject({ data: { status: 'released', revision: 3 } });
    expect(await mock.eligible(tenant, id, input.productId)).toMatchObject({ data: { id } });
    expect(await mock.remove(tenant, id, 3)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await mock.transition(tenant, id, 'archive', 3)).toMatchObject({ data: { status: 'archived', revision: 4, history: [{ action: 'created' }, { action: 'verify' }, { action: 'release' }, { action: 'archive' }] } });
    expect(await mock.eligible(tenant, id, input.productId)).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('keeps failed checksum draft out of OTA and blocks referenced deletion or archive', async () => {
    const store = storage(); const mock = service(store);
    const failed = await mock.create(tenant, { ...input, version: '2.5.1', checksumValid: false });
    if (!('data' in failed)) throw new Error('create failed');
    expect(await mock.transition(tenant, failed.data.id, 'verify', 1)).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await mock.eligible(tenant, failed.data.id, input.productId)).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    store.setItem('iot-atlas-ota-v1', JSON.stringify([{ id: 'ota_demo_001', firmwareId: 'fw_as_001', status: 'queued' }, { id: 'ota_demo_002', firmwareId: failed.data.id, status: 'cancelled' }]));
    expect(await mock.transition(tenant, 'fw_as_001', 'archive', 1)).toMatchObject({ error: { code: 'CONFLICT', message: expect.stringContaining('ota_demo_001') } });
    expect(await mock.remove(tenant, failed.data.id, 1)).toMatchObject({ error: { code: 'CONFLICT', message: expect.stringContaining('ota_demo_002') } });
    expect(await mock.get(tenant, 'fw_as_001')).toMatchObject({ data: { referencedTaskIds: ['ota_demo_001'] } });
  });

  it('persists metadata without binary bytes and reloads before a stale revision write', async () => {
    const store = storage(), first = service(store), second = service(store);
    const created = await first.create(tenant, input);
    if (!('data' in created)) throw new Error('create failed');
    expect(store.getItem('iot-atlas-firmware-v1')).not.toContain('arrayBuffer');
    expect(await second.get(tenant, created.data.id)).toMatchObject({ data: { version: '2.5.0' } });
    await first.transition(tenant, created.data.id, 'verify', 1);
    expect(await second.transition(tenant, created.data.id, 'release', 1)).toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('uses browser SHA-256 and explains rejected files', async () => {
    const file = new File(['abc'], 'sensor.bin');
    expect(await inspectFirmwareFile(file)).toEqual({ fileName: 'sensor.bin', sizeBytes: 3, checksum: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', checksumValid: true });
    expect(await inspectFirmwareFile(new File(['abc'], 'sensor.zip'))).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await inspectFirmwareFile(new File([], 'empty.bin'))).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
  it('reports bytes actually read before completing the SHA-256 check', async () => {
    const progress: number[] = [];
    const file = { name: 'sensor.bin', size: 3, stream: () => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([97])); controller.enqueue(new Uint8Array([98, 99])); controller.close(); } }) } as unknown as File;
    expect(await inspectFirmwareFile(file, percent => progress.push(percent))).toMatchObject({ checksum: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' });
    expect(progress).toEqual([0, 33, 100]);
  });
});
