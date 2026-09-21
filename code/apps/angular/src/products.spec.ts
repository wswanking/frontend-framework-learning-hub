import { describe, expect, it } from 'vitest';
import { ProductService, type DpRule, type ProductInput, type ThingModelItem } from './products';
import type { Context } from './dashboard';
import { TenantService } from './tenants';
import { DeviceService } from './devices';

const admin: Context = { actorId: 'usr_202609_001', role: 'platformAdmin', tenantId: 'all', seed: 42, scenario: 'normal' };
const tenant: Context = { ...admin, role: 'tenantAdmin', tenantId: 'ten_202609_001' };
const viewer: Context = { ...admin, role: 'viewer', tenantId: 'ten_202609_001' };
const input: ProductInput = { tenantId: 'ten_202609_001', name: '新温度设备', productKey: 'new-temp-01', category: '工业传感器', protocol: 'MQTT', status: 'draft' };
const item: ThingModelItem = { id: 'tm_new', kind: 'property', identifier: 'temperature_new', name: '新温度', dataType: 'float', accessMode: 'read', unit: '°C', min: -40, max: 125 };
const rule: DpRule = { id: 'dp_new', itemId: 'tm_temperature', rawType: 'int16', scale: 0.1, offset: -40, precision: 1, enumMap: [], threshold: { min: -40, max: 125 }, expression: 'x' };
function storage(): Storage { const data = new Map<string, string>(); return { get length() { return data.size; }, clear: () => data.clear(), getItem: key => data.get(key) ?? null, key: index => [...data.keys()][index] ?? null, removeItem: key => { data.delete(key); }, setItem: (key, value) => { data.set(key, value); } }; }

describe('IOT-PRODUCT-001 product and DP contract', () => {
  it('uses current device inventory for product counts and impact previews', async () => {
    const store = storage(), tenants = new TenantService(store), products = new ProductService(store, tenants);
    const devices = new DeviceService(store, products, tenants);
    expect(await products.get(tenant, 'prod_as_001')).toMatchObject({ data: { deviceCount: 6 } });
    const added = await devices.create(tenant, { tenantId: tenant.tenantId, productId: 'prod_as_001', name: '新增探头', region: 'AS', countryCode: 'CN', location: null, tags: [] });
    if ('error' in added) throw new Error(added.error.message);
    expect(await products.get(tenant, 'prod_as_001')).toMatchObject({ data: { deviceCount: 7 } });
    expect(await products.saveModel(tenant, 'prod_as_001', { ...item, id: 'tm_temperature', dataType: 'int' }, 1))
      .toMatchObject({ error: { code: 'CONFLICT', message: expect.stringContaining('7 台设备') } });
    expect(await products.list(tenant, { tenantId: tenant.tenantId, page: 1, pageSize: 10, seed: 42 }))
      .toMatchObject({ data: { items: expect.arrayContaining([expect.objectContaining({ id: 'prod_as_001', deviceCount: 7 })]) } });
    expect(await devices.deleteBatch(tenant, [added.data.id, 'dev_as_001'], true)).toHaveProperty('data');
    expect(await products.get(tenant, 'prod_as_001')).toMatchObject({ data: { deviceCount: 5 } });
    expect(await products.get(admin, 'prod_as_002')).toMatchObject({ data: { deviceCount: 6 } });
  });
  it('isolates tenants, applies filters and pagination, and preserves deterministic initial data', async () => {
    const service = new ProductService();
    const all = await service.list(admin, { tenantId: 'all', page: 1, pageSize: 2, seed: 42 });
    expect(all).toMatchObject({ data: { total: 4, items: [{ id: 'prod_as_001' }, { id: 'prod_as_002' }] } });
    expect(all).toEqual(await new ProductService().list(admin, { tenantId: 'all', page: 1, pageSize: 2, seed: 42 }));
    expect(await service.list(tenant, { tenantId: 'ten_202609_001', keyword: 'water', page: 1, pageSize: 10, seed: 42 })).toMatchObject({ data: { total: 1, items: [{ id: 'prod_as_003' }] } });
    expect(await service.list(viewer, { tenantId: 'all', page: 1, pageSize: 10, seed: 42 })).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await service.get(viewer, 'prod_as_002')).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await service.list(admin, { tenantId: 'all', page: 0, pageSize: 10, seed: 42 })).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('enforces write permission, field validation, key uniqueness and version conflicts', async () => {
    const service = new ProductService();
    expect(await service.save(viewer, input)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await service.save(tenant, { ...input, productKey: 'BAD KEY' })).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { productKey: expect.any(String) } } });
    expect(await service.save(tenant, { ...input, productKey: 'temp-sense-pro' })).toMatchObject({ error: { code: 'CONFLICT', fieldErrors: { productKey: expect.any(String) } } });
    const created = await service.save(tenant, input);
    expect(created).toMatchObject({ data: { productKey: 'new-temp-01', version: 1, deviceCount: 0 } });
    if ('error' in created) throw new Error(created.error.message);
    expect(await service.save(tenant, { ...input, name: '改名' }, created.data.id, 0)).toMatchObject({ error: { code: 'CONFLICT', fieldErrors: { version: expect.any(String) } } });
    expect(await service.save(tenant, { ...input, name: '改名' }, created.data.id, 1)).toMatchObject({ data: { name: '改名', version: 2 } });
  });

  it('saves validated access metadata with tenant isolation, version checks and legacy storage migration', async () => {
    localStorage.removeItem('iot-atlas-products-v1');
    try {
      const first = new ProductService(localStorage);
      const original = await first.get(tenant, 'prod_as_001');
      if ('error' in original) throw new Error(original.error.message);
      const next = { ...original.data.accessConfig, uplinkPath: 'sensors/{deviceId}/telemetry', heartbeatSeconds: 120 };
      expect(await first.saveAccessConfig(viewer, original.data.id, next, original.data.version)).toMatchObject({ error: { code: 'FORBIDDEN' } });
      expect(await first.saveAccessConfig(tenant, 'prod_as_002', next, 1)).toMatchObject({ error: { code: 'FORBIDDEN' } });
      expect(await first.saveAccessConfig(tenant, original.data.id, { ...next, heartbeatSeconds: 1 }, original.data.version))
        .toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { heartbeatSeconds: expect.any(String) } } });
      expect(await first.saveAccessConfig(tenant, original.data.id, { ...next, uplinkPath: 'bad path' }, original.data.version))
        .toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { uplinkPath: expect.any(String) } } });
      expect(await first.saveAccessConfig(tenant, original.data.id, next, original.data.version)).toMatchObject({ data: { version: 2, accessConfig: next } });
      expect(await first.saveAccessConfig(tenant, original.data.id, next, original.data.version)).toMatchObject({ error: { code: 'CONFLICT' } });
      expect(await new ProductService(localStorage).get(tenant, original.data.id)).toMatchObject({ data: { accessConfig: next } });
      const saved = JSON.parse(localStorage.getItem('iot-atlas-products-v1')!);
      delete saved[0].accessConfig;
      localStorage.setItem('iot-atlas-products-v1', JSON.stringify(saved));
      expect(await new ProductService(localStorage).get(tenant, original.data.id)).toMatchObject({ data: { accessConfig: { payloadFormat: 'JSON', heartbeatSeconds: 60 } } });
    } finally { localStorage.removeItem('iot-atlas-products-v1'); }
  });

  it('previews protocol and linked Product Key changes before writing', async () => {
    const service = new ProductService();
    const linked = await service.get(tenant, 'prod_as_001');
    if ('error' in linked) throw new Error(linked.error.message);
    const linkedInput: ProductInput = { tenantId: linked.data.tenantId, name: linked.data.name, productKey: linked.data.productKey,
      category: linked.data.category, protocol: linked.data.protocol, status: linked.data.status };
    expect(await service.save(tenant, { ...linkedInput, productKey: 'new-linked-key' }, linked.data.id, linked.data.version))
      .toMatchObject({ error: { code: 'CONFLICT', fieldErrors: { confirmImpact: expect.any(String) } } });
    expect(await service.save(tenant, { ...linkedInput, productKey: 'new-linked-key' }, linked.data.id, linked.data.version, true))
      .toMatchObject({ data: { version: 2, productKey: 'new-linked-key', accessConfig: linked.data.accessConfig } });
    const draft = await service.get(tenant, 'prod_as_003');
    if ('error' in draft) throw new Error(draft.error.message);
    const draftInput: ProductInput = { tenantId: draft.data.tenantId, name: draft.data.name, productKey: draft.data.productKey,
      category: draft.data.category, protocol: 'HTTP', status: draft.data.status };
    expect(await service.save(tenant, draftInput, draft.data.id, draft.data.version))
      .toMatchObject({ error: { code: 'CONFLICT', fieldErrors: { confirmImpact: expect.any(String) } } });
    expect(await service.save(tenant, draftInput, draft.data.id, draft.data.version, true))
      .toMatchObject({ data: { protocol: 'HTTP', accessConfig: { uplinkPath: '/devices/{deviceId}/events' } } });
  });

  it('accepts a newly created tenant and rejects product creation at its hard quota', async () => {
    localStorage.removeItem('iot-atlas-products-v1'); localStorage.removeItem('iot-atlas-tenants-v1');
    try {
      const tenants = new TenantService(localStorage);
      const original = await tenants.get(admin, 'ten_202609_001');
      if ('error' in original) throw new Error(original.error.message);
      const changed = await tenants.updateQuota(admin, original.data.id, { ...original.data.quota, products: { limit: 2, warningAt: 80 } }, original.data.revision);
      expect(changed).toHaveProperty('data');
      const service = new ProductService(localStorage);
      expect(await service.save(admin, input)).toMatchObject({ error: { code: 'CONFLICT', message: expect.stringContaining('已用 2/2') } });
      const createdTenant = await tenants.save(admin, { ...original.data, name: '新租户', key: 'new-tenant', email: 'new@example.com', quota: { ...original.data.quota, products: { limit: 1, warningAt: 80 } } });
      if ('error' in createdTenant) throw new Error(createdTenant.error.message);
      const next = { ...input, tenantId: createdTenant.data.id, productKey: 'new-tenant-product' };
      expect(await service.save(admin, next)).toMatchObject({ data: { tenantId: createdTenant.data.id } });
      expect(await service.save(admin, { ...next, productKey: 'another-product' })).toMatchObject({ error: { code: 'CONFLICT', message: expect.stringContaining('已用 1/1') } });
    } finally { localStorage.removeItem('iot-atlas-products-v1'); localStorage.removeItem('iot-atlas-tenants-v1'); }
  });

  it('validates model constraints and requires impact confirmation for attached devices', async () => {
    const service = new ProductService();
    expect(await service.saveModel(tenant, 'prod_as_001', { ...item, unit: '' }, 1)).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { unit: expect.any(String) } } });
    expect(await service.saveModel(tenant, 'prod_as_001', { ...item, identifier: 'temperature' }, 1)).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { identifier: expect.any(String) } } });
    expect(await service.saveModel(tenant, 'prod_as_001', { ...item, dataType: 'enum', enumValues: ['on', 'off'] }, 1)).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { incompatibleFields: expect.any(String) } } });
    expect(await service.saveModel(tenant, 'prod_as_001', { ...item, id: 'tm_temperature', dataType: 'int' }, 1)).toMatchObject({ error: { code: 'CONFLICT', fieldErrors: { confirmImpact: expect.any(String) } } });
    expect(await service.saveModel(tenant, 'prod_as_001', { ...item, id: 'tm_temperature', dataType: 'int' }, 1, true)).toMatchObject({ data: { version: 2 } });
    expect(await service.removeModel(tenant, 'prod_as_001', 'tm_humidity', 2)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await service.removeModel(tenant, 'prod_as_001', 'tm_humidity', 2, true)).toMatchObject({ data: { version: 3 } });
  });

  it('does not overwrite an existing model when a new item repeats its identifier', async () => {
    const service = new ProductService();
    expect(await service.saveModel(tenant, 'prod_as_001', { ...item, id: '', identifier: 'temperature' }, 1))
      .toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { identifier: '同一产品内标识必须唯一' } } });
    expect(await service.get(tenant, 'prod_as_001')).toMatchObject({ data: { version: 1, model: expect.arrayContaining([expect.objectContaining({ id: 'tm_temperature', name: '温度' })]) } });
    const created = await service.saveModel(tenant, 'prod_as_001', { ...item, id: '' }, 1);
    expect(created).toMatchObject({ data: { version: 2, model: expect.arrayContaining([expect.objectContaining({ id: 'tm_temperature_new', identifier: 'temperature_new' })]) } });
    expect(await service.saveModel(tenant, 'prod_as_001', { ...item, id: '' }, 2))
      .toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { identifier: '同一产品内标识必须唯一' } } });
  });

  it('shows each DP conversion step, rejects bad expressions and data outside limits', async () => {
    const service = new ProductService();
    const converted = await service.testDpRule(tenant, 'prod_as_001', rule, '850');
    expect(converted).toMatchObject({ data: { value: '45', valid: true, steps: [{ label: '原始输入' }, { label: '倍率与偏移' }, { label: '表达式' }, { label: '精度' }, { label: '范围与类型校验' }] } });
    expect(await service.testDpRule(tenant, 'prod_as_001', rule, '3000')).toMatchObject({ data: { valid: false, error: '超出 DP 阈值' } });
    expect(await service.testDpRule(tenant, 'prod_as_001', { ...rule, expression: 'window.alert(1)' }, '850')).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { expression: expect.any(String) } } });
    expect(await service.testDpRule(tenant, 'prod_as_001', { ...rule, enumMap: [{ raw: '1', value: '2' }, { raw: '2', value: '1' }] }, '1')).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { enumMap: expect.any(String) } } });
    expect(await service.testDpRule(tenant, 'prod_as_001', { ...rule, enumMap: [{ raw: '1', value: '2' }, { raw: '2', value: '3' }, { raw: '3', value: '1' }] }, '1')).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { enumMap: expect.any(String) } } });
    expect(await service.testDpRule(tenant, 'prod_as_001', { ...rule, enumMap: {} as DpRule['enumMap'] }, '1')).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { enumMap: expect.any(String) } } });
    expect(await service.saveDpRule(viewer, 'prod_as_001', rule, 1)).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('converts boolean and string targets without executing user expressions', async () => {
    const service = new ProductService();
    const boolItem: ThingModelItem = { id: 'tm_enabled', kind: 'property', identifier: 'is_enabled', name: '开关', dataType: 'bool', accessMode: 'readWrite' };
    expect(await service.saveModel(tenant, 'prod_as_001', boolItem, 1)).toMatchObject({ data: { version: 2 } });
    expect(await service.testDpRule(tenant, 'prod_as_001', { ...rule, itemId: boolItem.id, scale: 1, offset: 0, threshold: undefined }, '1')).toMatchObject({ data: { value: 'true', valid: true } });
    const stringItem: ThingModelItem = { id: 'tm_code', kind: 'property', identifier: 'status_code', name: '状态码', dataType: 'string', accessMode: 'read' };
    expect(await service.saveModel(tenant, 'prod_as_001', stringItem, 2)).toMatchObject({ data: { version: 3 } });
    expect(await service.testDpRule(tenant, 'prod_as_001', { ...rule, itemId: stringItem.id, rawType: 'string' }, 'A-01')).toMatchObject({ data: { value: 'A-01', valid: true } });
  });

  it('validates mapped DP values against the numeric target and raw input type', async () => {
    const service = new ProductService();
    const mapped = { ...rule, enumMap: [{ raw: '1', value: '850' }, { raw: '2', value: '3000' }, { raw: '3', value: 'invalid' }] };
    expect(await service.testDpRule(tenant, 'prod_as_001', mapped, '1')).toMatchObject({ data: { value: '45', valid: true, steps: [{ label: '原始输入' }, { label: '枚举映射' }, { label: '倍率与偏移' }, { label: '表达式' }, { label: '精度' }, { label: '范围与类型校验' }] } });
    expect(await service.testDpRule(tenant, 'prod_as_001', mapped, '2')).toMatchObject({ data: { valid: false, error: '超出 DP 阈值' } });
    expect(await service.testDpRule(tenant, 'prod_as_001', mapped, '3')).toMatchObject({ data: { valid: false, error: '映射值与目标数据类型不匹配' } });
    expect(await service.testDpRule(tenant, 'prod_as_001', mapped, '1.5')).toMatchObject({ data: { valid: false, error: '原始值与数据类型不匹配' } });
  });

  it('provides retryable offline failure without changing saved data', async () => {
    const service = new ProductService();
    expect(await service.save({ ...tenant, scenario: 'offline' }, input)).toMatchObject({ error: { code: 'SCENARIO_TIMEOUT', retryable: true } });
    expect(await service.list(tenant, { tenantId: tenant.tenantId, page: 1, pageSize: 10, seed: 42 })).toMatchObject({ data: { total: 2 } });
  });

  it('persists browser Mock edits and detects a stale version from another instance', async () => {
    localStorage.removeItem('iot-atlas-products-v1');
    try {
      const first = new ProductService(localStorage);
      const created = await first.save(tenant, input);
      if ('error' in created) throw new Error(created.error.message);
      const second = new ProductService(localStorage);
      expect(await second.list(tenant, { tenantId: tenant.tenantId, page: 1, pageSize: 10, seed: 42 })).toMatchObject({ data: { total: 3 } });
      expect(await second.save(tenant, { ...input, name: '另一页修改' }, created.data.id, 1)).toMatchObject({ data: { version: 2 } });
      expect(await first.save(tenant, { ...input, name: '过期修改' }, created.data.id, 1)).toMatchObject({ error: { code: 'CONFLICT', fieldErrors: { version: expect.any(String) } } });
    } finally { localStorage.removeItem('iot-atlas-products-v1'); }
  });

  it('rechecks the version after simulated latency before committing', async () => {
    localStorage.removeItem('iot-atlas-products-v1');
    try {
      const slow = new ProductService(localStorage);
      const fast = new ProductService(localStorage);
      const original = { ...input, productKey: 'temp-sense-pro' };
      const pending = slow.save({ ...tenant, scenario: 'slow' }, { ...original, name: '缓慢修改' }, 'prod_as_001', 1);
      expect(await fast.save(tenant, { ...original, name: '先提交的修改' }, 'prod_as_001', 1)).toMatchObject({ data: { version: 2 } });
      expect(await pending).toMatchObject({ error: { code: 'CONFLICT', fieldErrors: { version: expect.any(String) } } });
      expect(await fast.get(tenant, 'prod_as_001')).toMatchObject({ data: { name: '先提交的修改', version: 2 } });
    } finally { localStorage.removeItem('iot-atlas-products-v1'); }
  });
});
