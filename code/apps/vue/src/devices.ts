// IOT-DEVICE-001 / IOT-DOMAIN-001. This file is owned independently by each app.
import type { Context } from './dashboard';
import { products, type ProductService, type ThingModelItem } from './products';
import { tenants, type TenantService } from './tenants';
import { DEVICE_INVENTORY_KEY } from './device-inventory';

export type DeviceStatus = 'unactivated' | 'online' | 'offline' | 'fault' | 'maintenance';
export type Device = {
  id: string; tenantId: string; productId: string; name: string; status: DeviceStatus;
  region: string; countryCode: string; location: [number, number] | null; tags: string[];
  lastActiveAt: string | null; createdAt: string; updatedAt: string; version: number;
  attributes: Record<string, number | string | boolean>; signalDbm: number | null;
};
export type DeviceInput = Pick<Device, 'tenantId' | 'productId' | 'name' | 'region' | 'countryCode' | 'location' | 'tags'>;
export type DeviceImportPreview = { count: number; tenants: { tenantId: string; before: number; after: number }[]; names: string[] };
export type DeviceListQuery = {
  tenantId: string; seed: number; productId?: string; status?: DeviceStatus; region?: string;
  tag?: string; keyword?: string; lastActiveFrom?: string; page: number; pageSize: number;
  sortBy?: 'lastActiveAt' | 'name' | 'status'; sortDirection?: 'asc' | 'desc';
};
export type TelemetryQuality = 'good' | 'stale' | 'invalid' | 'missing';
export type TelemetryPoint = { deviceId: string; metric: string; timestamp: string; value: number | null; unit: string; quality: TelemetryQuality };
export type TelemetryQuery = { deviceId: string; from: string; to: string; metrics: string[]; granularity: 'minute' | 'hour' | 'day'; seed: number };
export type Command = {
  id: string; deviceId: string; modelItemId: string; identifier: string; value: number | string | boolean;
  status: 'pending' | 'succeeded' | 'failed'; reason?: string; actorId: string; createdAt: string; finishedAt?: string; readyAt?: number;
};
export type DeviceShadow = { deviceId: string; lastActiveAt: string | null; entries: { identifier: string; reported: number | string | boolean; desired: number | string | boolean | null; desiredCommandId: string | null }[] };
export type DeviceError = { error: { code: 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT' | 'DEVICE_OFFLINE' | 'SCENARIO_TIMEOUT'; message: string; fieldErrors?: Record<string, string>; retryable?: boolean } };
export type DeviceResult<T> = { data: T; meta: { requestId: string; seed: number; generatedAt: string } } | DeviceError;

const FIXED_AT = '2026-09-16T12:00:00.000Z';
const STORAGE_KEY = 'iot-atlas-device-commands-v1';
const DAY = 86_400_000;
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const validUtc = (value: string) => UTC_ISO.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
const clone = <T>(value: T): T => structuredClone(value);
const base = Date.parse(FIXED_AT);
type SeedRow = [string, string, string, string, DeviceStatus, string, string, [number, number] | null, number | null];
const seeds: SeedRow[] = [
  ['dev_as_001', 'ten_202609_001', 'prod_as_001', '上海温湿度一号', 'online', 'AS', 'CN', [121.47, 31.23], 2],
  ['dev_eu_001', 'ten_202609_001', 'prod_as_001', '柏林温湿度二号', 'online', 'EU', 'DE', [13.41, 52.52], 4],
  ['dev_na_001', 'ten_202609_001', 'prod_as_001', '纽约温湿度三号', 'fault', 'NA', 'US', [-74.01, 40.71], 80],
  ['dev_sa_001', 'ten_202609_001', 'prod_as_001', '圣保罗温湿度四号', 'online', 'SA', 'BR', [-46.63, -23.55], 1],
  ['dev_af_001', 'ten_202609_001', 'prod_as_001', '约堡温湿度五号', 'offline', 'AF', 'ZA', [28.05, -26.2], 120],
  ['dev_oc_001', 'ten_202609_001', 'prod_as_001', '悉尼温湿度六号', 'online', 'OC', 'AU', [151.21, -33.87], 3],
  ['dev_as_002', 'ten_202609_002', 'prod_as_002', '东京能源网关', 'online', 'AS', 'JP', [139.69, 35.68], 5],
  ['dev_eu_002', 'ten_202609_002', 'prod_as_002', '巴黎能源网关', 'fault', 'EU', 'FR', [2.35, 48.86], 90],
  ['dev_na_002', 'ten_202609_002', 'prod_as_002', '多伦多能源网关', 'online', 'NA', 'CA', [-79.38, 43.65], 7],
  ['dev_sa_002', 'ten_202609_002', 'prod_as_002', '布宜能源网关', 'maintenance', 'SA', 'AR', [-58.38, -34.6], 70],
  ['dev_af_002', 'ten_202609_002', 'prod_as_002', '开罗能源网关', 'online', 'AF', 'EG', [31.24, 30.04], 6],
  ['dev_oc_002', 'ten_202609_002', 'prod_as_002', '奥克兰能源网关', 'online', 'OC', 'NZ', null, 8],
];
const seedDevices: Device[] = seeds.map(([id, tenantId, productId, name, status, region, countryCode, location, minutes]) => ({
  id, tenantId, productId, name, status: status === 'online' || status === 'offline' ? minutes !== null && minutes <= 15 ? 'online' : 'offline' : status,
  region, countryCode, location, tags: productId === 'prod_as_001' ? ['传感器', '环境'] : ['网关', '能源'],
  lastActiveAt: minutes === null ? null : new Date(base - minutes * 60_000).toISOString(),
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: FIXED_AT, version: 1,
  attributes: (productId === 'prod_as_001' ? { temperature: 24.5, humidity: 58.2, sampling_interval: 60 } : { voltage: 220.4, current: 3.2 }) as Record<string, number | string | boolean>,
  signalDbm: status === 'online' ? -67 : null,
}));
export function initialDeviceReport(id: string): { lastActiveAt: string; attributes: Device['attributes'] } | null {
  const seed = seedDevices.find(item => item.id === id);
  return seed?.lastActiveAt ? { lastActiveAt: seed.lastActiveAt, attributes: clone(seed.attributes) } : null;
}
function fail(code: DeviceError['error']['code'], message: string, fieldErrors?: Record<string, string>): DeviceError {
  return { error: { code, message, ...(fieldErrors ? { fieldErrors } : {}), retryable: code === 'SCENARIO_TIMEOUT' } };
}
function ok<T>(context: Context, data: T, key: string): DeviceResult<T> {
  return { data: clone(data), meta: { requestId: `req_${context.seed}_${key}`, seed: context.seed, generatedAt: FIXED_AT } };
}
function access(context: Context, tenantId: string, write = false): DeviceError | null {
  if (context.scenario === 'forbidden' || (write && context.role === 'viewer')) return fail('FORBIDDEN', '无权操作设备');
  if (context.role !== 'platformAdmin' && (tenantId === 'all' || context.tenantId !== tenantId)) return fail('FORBIDDEN', '无权访问该租户设备');
  if (context.scenario === 'offline') return fail('SCENARIO_TIMEOUT', '模拟设备服务暂不可用');
  return null;
}
function hash(value: string) { let h = 2166136261; for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 16777619); return h >>> 0; }
function validateValue(item: ThingModelItem, value: unknown): string | null {
  if (item.dataType === 'float' || item.dataType === 'int') {
    if (typeof value !== 'number' || !Number.isFinite(value) || (item.dataType === 'int' && !Number.isInteger(value))) return '参数必须为有效数值';
    if ((item.min !== undefined && value < item.min) || (item.max !== undefined && value > item.max)) return `参数须在 ${item.min}–${item.max} 之间`;
  } else if (item.dataType === 'bool' && typeof value !== 'boolean') return '参数必须为布尔值';
  else if (item.dataType === 'enum' && (typeof value !== 'string' || !item.enumValues?.includes(value))) return '参数不在模型枚举内';
  else if (item.dataType === 'string' && (typeof value !== 'string' || !value.trim())) return '参数必须为非空文本';
  return null;
}

export class DeviceService {
  private devices = clone(seedDevices);
  private commands: Command[] = [];
  constructor(private storage: Storage | null = null, private modelService: ProductService = products, private tenantService: TenantService = tenants) { this.sync(); }
  private sync() { if (!this.storage) return; try { const saved = this.storage.getItem(STORAGE_KEY); if (saved) { const rows = JSON.parse(saved) as Command[]; if (Array.isArray(rows)) this.commands = rows; } const deviceRows = this.storage.getItem(DEVICE_INVENTORY_KEY); if (deviceRows) { const rows = JSON.parse(deviceRows) as Device[]; if (Array.isArray(rows) && rows.every(item => item && typeof item.id === 'string' && typeof item.version === 'number' && item.attributes && Array.isArray(item.tags))) this.devices = rows; } } catch { /* Local demo stays usable. */ } }
  private commit() { try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.commands)); } catch { /* Local demo stays usable. */ } }
  private commitDevices() { try { this.storage?.setItem(DEVICE_INVENTORY_KEY, JSON.stringify(this.devices)); } catch { /* Local demo stays usable. */ } }
  async list(context: Context, query: DeviceListQuery): Promise<DeviceResult<{ items: Device[]; total: number; page: number; pageSize: number }>> {
    this.sync();
    const denied = access(context, query.tenantId); if (denied) return denied;
    if (query.seed !== context.seed || !Number.isInteger(query.seed)) return fail('VALIDATION_ERROR', 'seed 不一致', { seed: 'seed 必须与上下文一致' });
    if (!Number.isInteger(query.page) || query.page < 1 || !Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) return fail('VALIDATION_ERROR', '分页无效', { page: '页码从 1 开始，每页 1–100 条' });
    if (query.status && !['unactivated', 'online', 'offline', 'fault', 'maintenance'].includes(query.status)) return fail('VALIDATION_ERROR', '状态无效', { status: '未知状态' });
    if (query.lastActiveFrom && !validUtc(query.lastActiveFrom)) return fail('VALIDATION_ERROR', '时间无效', { lastActiveFrom: '请输入有效 UTC 时间' });
    if (context.scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 80));
    const direction = query.sortDirection === 'asc' ? 1 : -1;
    const key = query.sortBy ?? 'lastActiveAt';
    const rows = this.devices.filter(item => (query.tenantId === 'all' || item.tenantId === query.tenantId) && (!query.productId || item.productId === query.productId)
      && (!query.status || item.status === query.status) && (!query.region || item.region === query.region)
      && (!query.tag || item.tags.includes(query.tag)) && (!query.keyword || `${item.id} ${item.name} ${item.tags.join(' ')}`.toLowerCase().includes(query.keyword.toLowerCase()))
      && (!query.lastActiveFrom || !!item.lastActiveAt && item.lastActiveAt >= query.lastActiveFrom))
      .sort((a, b) => direction * String(a[key] ?? '').localeCompare(String(b[key] ?? '')) || a.id.localeCompare(b.id));
    return ok(context, { items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: rows.length, page: query.page, pageSize: query.pageSize }, `devices_${query.page}`);
  }
  async get(context: Context, id: string): Promise<DeviceResult<Device>> {
    this.sync();
    const device = this.devices.find(item => item.id === id);
    const denied = access(context, device?.tenantId ?? (context.role === 'platformAdmin' ? 'all' : context.tenantId)); if (denied) return denied;
    if (!device) return fail('NOT_FOUND', '设备不存在');
    return ok(context, device, id);
  }
  async create(context: Context, input: DeviceInput): Promise<DeviceResult<Device>> {
    this.sync(); const denied = access(context, input.tenantId, true); if (denied) return denied;
    if (context.role !== 'platformAdmin' && context.role !== 'tenantAdmin') return fail('FORBIDDEN', '无权创建设备');
    if (!input.name?.trim() || input.name.length > 80 || !/^[A-Z]{2}$/.test(input.countryCode ?? '') || !/^[A-Z]{2}$/.test(input.region ?? '') || !Array.isArray(input.tags) || input.tags.some(tag => !tag?.trim()) || input.location !== null && (!Array.isArray(input.location) || input.location.length !== 2 || input.location.some(value => !Number.isFinite(value)))) return fail('VALIDATION_ERROR', '设备信息无效');
    const product = await this.modelService.get(context, input.productId);
    if ('error' in product) return product.error.code === 'FORBIDDEN' ? fail('FORBIDDEN', '无权访问产品') : fail('VALIDATION_ERROR', '所属产品不存在');
    if (product.data.tenantId !== input.tenantId || product.data.status !== 'published') return fail('VALIDATION_ERROR', '设备须使用同租户已发布产品');
    const count = this.devices.filter(item => item.tenantId === input.tenantId).length;
    const capacity = await this.tenantService.checkCapacity(context, input.tenantId, 'devices', count);
    if ('error' in capacity) return capacity;
    if (context.scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 80));
    this.sync();
    const latestCount = this.devices.filter(item => item.tenantId === input.tenantId).length;
    const latestCapacity = await this.tenantService.checkCapacity(context, input.tenantId, 'devices', latestCount);
    if ('error' in latestCapacity) return latestCapacity;
    const nextId = Math.max(0, ...this.devices.filter(item => item.id.startsWith('dev_new_')).map(item => Number(item.id.slice(8)) || 0)) + 1;
    const id = `dev_new_${String(nextId).padStart(3, '0')}`;
    const row: Device = { ...clone(input), id, name: input.name.trim(), tags: [...new Set(input.tags.map(tag => tag.trim()))], status: 'unactivated', lastActiveAt: null, createdAt: FIXED_AT, updatedAt: FIXED_AT, version: 1, attributes: {}, signalDbm: null };
    this.devices.push(row); this.commitDevices(); return ok(context, row, id);
  }
  async previewImport(context: Context, inputs: DeviceInput[]): Promise<DeviceResult<DeviceImportPreview>> {
    this.sync();
    if (context.role !== 'platformAdmin' && context.role !== 'tenantAdmin') return fail('FORBIDDEN', '无权导入设备');
    if (!Array.isArray(inputs) || !inputs.length || inputs.length > 100) return fail('VALIDATION_ERROR', '一次只能导入 1–100 台设备');
    const tenants = [...new Set(inputs.map(item => item.tenantId))];
    for (const tenantId of tenants) { const denied = access(context, tenantId, true); if (denied) return denied; }
    const names = new Set<string>();
    for (const [index, input] of inputs.entries()) {
      if (!input.name?.trim() || input.name.length > 80 || !/^[A-Z]{2}$/.test(input.countryCode ?? '') || !/^[A-Z]{2}$/.test(input.region ?? '') || !Array.isArray(input.tags) || input.tags.some(tag => !tag?.trim()) || input.location !== null && (!Array.isArray(input.location) || input.location.length !== 2 || input.location.some(value => !Number.isFinite(value)))) return fail('VALIDATION_ERROR', `第 ${index + 1} 行设备信息无效`);
      const key = `${input.tenantId}:${input.name.trim()}`;
      if (names.has(key)) return fail('VALIDATION_ERROR', `第 ${index + 1} 行设备名称在本批次重复`);
      names.add(key);
      const product = await this.modelService.get(context, input.productId);
      if ('error' in product) return product.error.code === 'FORBIDDEN' ? fail('FORBIDDEN', '无权访问产品') : fail('VALIDATION_ERROR', `第 ${index + 1} 行产品不存在`);
      if (product.data.tenantId !== input.tenantId || product.data.status !== 'published') return fail('VALIDATION_ERROR', `第 ${index + 1} 行须使用同租户已发布产品`);
    }
    const summary: DeviceImportPreview = { count: inputs.length, names: inputs.map(item => item.name.trim()), tenants: [] };
    for (const tenantId of tenants) {
      const before = this.devices.filter(item => item.tenantId === tenantId).length;
      const after = before + inputs.filter(item => item.tenantId === tenantId).length;
      const capacity = await this.tenantService.checkCapacity(context, tenantId, 'devices', after - 1);
      if ('error' in capacity) return fail(capacity.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'CONFLICT', capacity.error.message);
      summary.tenants.push({ tenantId, before, after });
    }
    return ok(context, summary, 'import_preview');
  }
  async importBatch(context: Context, inputs: DeviceInput[], confirmed: boolean): Promise<DeviceResult<Device[]>> {
    const preview = await this.previewImport(context, inputs); if ('error' in preview) return preview;
    if (!confirmed) return fail('VALIDATION_ERROR', '导入前须确认预览结果');
    if (context.scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 80));
    this.sync();
    const latest = await this.previewImport(context, inputs); if ('error' in latest) return latest;
    let nextId = Math.max(0, ...this.devices.filter(item => item.id.startsWith('dev_new_')).map(item => Number(item.id.slice(8)) || 0));
    const created = inputs.map(input => ({ tenantId: input.tenantId, productId: input.productId, id: `dev_new_${String(++nextId).padStart(3, '0')}`, name: input.name.trim(), region: input.region, countryCode: input.countryCode,
      location: input.location ? [...input.location] as [number, number] : null, tags: [...new Set(input.tags.map(tag => tag.trim()))], status: 'unactivated' as const, lastActiveAt: null, createdAt: FIXED_AT, updatedAt: FIXED_AT, version: 1, attributes: {}, signalDbm: null }));
    this.devices.push(...created); this.commitDevices(); return ok(context, created, 'import_batch');
  }
  async deleteBatch(context: Context, ids: string[], confirmed: boolean): Promise<DeviceResult<{ deleted: string[] }>> {
    this.sync();
    if (context.role !== 'platformAdmin' && context.role !== 'tenantAdmin') return fail('FORBIDDEN', '无权删除设备');
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || new Set(ids).size !== ids.length) return fail('VALIDATION_ERROR', '请选择 1–100 台不同设备');
    for (const id of ids) {
      const device = this.devices.find(item => item.id === id);
      const denied = access(context, device?.tenantId ?? context.tenantId, true); if (denied) return denied;
      if (!device) return fail('NOT_FOUND', '待删除设备不存在');
    }
    if (!confirmed) return fail('CONFLICT', `删除 ${ids.length} 台设备需确认；历史规则和 OTA 记录会保留`);
    this.devices = this.devices.filter(item => !ids.includes(item.id)); this.commitDevices();
    return ok(context, { deleted: [...ids] }, 'delete_batch');
  }
  async updateMetadata(context: Context, id: string, input: { name: string; tags: string[] }, version: number): Promise<DeviceResult<Device>> {
    this.sync();
    const device = this.devices.find(item => item.id === id);
    const denied = access(context, device?.tenantId ?? context.tenantId, true); if (denied) return denied;
    if (context.role === 'operator') return fail('FORBIDDEN', '运维不可修改设备元数据');
    if (!device) return fail('NOT_FOUND', '设备不存在');
    if (version !== device.version) return fail('CONFLICT', '设备版本冲突', { version: '请刷新设备详情' });
    if (!input.name?.trim() || input.name.length > 80 || !Array.isArray(input.tags) || input.tags.some(tag => !tag?.trim())) return fail('VALIDATION_ERROR', '元数据无效', { name: '名称为 1–80 字符，标签不能为空' });
    const next = { ...device, name: input.name.trim(), tags: [...new Set(input.tags)], version: device.version + 1, updatedAt: FIXED_AT };
    this.devices = this.devices.map(item => item.id === id ? next : item);
    this.commitDevices();
    return ok(context, next, id);
  }
  async queryTelemetry(context: Context, query: TelemetryQuery): Promise<DeviceResult<{ points: TelemetryPoint[]; metrics: { id: string; unit: string }[]; missing: { from: string; to: string }[]; noData: boolean; updatedAt: string }>> {
    this.sync();
    const device = this.devices.find(item => item.id === query.deviceId);
    const denied = access(context, device?.tenantId ?? context.tenantId); if (denied) return denied;
    if (!device) return fail('NOT_FOUND', '设备不存在');
    const from = Date.parse(query.from), to = Date.parse(query.to);
    if (query.seed !== context.seed || !validUtc(query.from) || !validUtc(query.to) || from >= to || to - from > 30 * DAY) return fail('VALIDATION_ERROR', '时序查询范围无效', { range: '请使用不超过 30 天的有效 UTC 时间范围' });
    if (!['minute', 'hour', 'day'].includes(query.granularity)) return fail('VALIDATION_ERROR', '粒度无效', { granularity: '未知采样粒度' });
    if (!query.metrics.length || query.metrics.length > 4 || new Set(query.metrics).size !== query.metrics.length || query.metrics.some(metric => !(metric in device.attributes))) return fail('VALIDATION_ERROR', '指标无效', { metrics: '请选择 1–4 个设备指标' });
    if (context.scenario === 'partialFailure') return fail('SCENARIO_TIMEOUT', '模拟时序分区不可用');
    if (context.scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 80));
    const step = query.granularity === 'minute' ? 60_000 : query.granularity === 'hour' ? 3_600_000 : DAY;
    if ((to - from) / step > 500) return fail('VALIDATION_ERROR', '采样点过多', { granularity: '请增大采样粒度' });
    const product = await this.modelService.get(context, device.productId);
    if ('error' in product) return fail(product.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'SCENARIO_TIMEOUT', product.error.message);
    const metrics = query.metrics.map(id => ({ id, unit: product.data.model.find(item => item.identifier === id)?.unit ?? (id === 'voltage' ? 'V' : id === 'current' ? 'A' : '') }));
    const points: TelemetryPoint[] = [], missing: { from: string; to: string }[] = [];
    const count = Math.floor((to - from) / step) + 1;
    for (let i = 0; i < count; i++) {
      const timestamp = new Date(from + i * step).toISOString();
      const sampleTime = from + i * step;
      const unavailable = sampleTime < Date.parse(device.createdAt) || sampleTime > base || !device.lastActiveAt || sampleTime > Date.parse(device.lastActiveAt) + step;
      const gap = unavailable || i > 0 && i % 7 === 0;
      if (gap) missing.push({ from: timestamp, to: new Date(Math.min(to, from + (i + 1) * step)).toISOString() });
      for (const metric of metrics) {
        const center = Number(device.attributes[metric.id]);
        const value = gap || !Number.isFinite(center) ? null : Math.round((center + (hash(`${context.seed}:${device.id}:${metric.id}:${i}`) % 21 - 10) / 10) * 10) / 10;
        points.push({ deviceId: device.id, metric: metric.id, timestamp, value, unit: metric.unit, quality: gap ? 'missing' : device.status === 'online' ? 'good' : 'stale' });
      }
    }
    return ok(context, { points, metrics, missing, noData: points.every(point => point.value === null), updatedAt: FIXED_AT }, `${device.id}_telemetry`);
  }
  subscribeTelemetry(context: Context, id: string, metrics: string[], granularity: TelemetryQuery['granularity'], listener: (event: DeviceResult<TelemetryPoint[]>) => void): () => void {
    const device = this.devices.find(item => item.id === id);
    const denied = access(context, device?.tenantId ?? context.tenantId);
    if (denied) { listener(denied); return () => {}; }
    if (!device) { listener(fail('NOT_FOUND', '设备不存在')); return () => {}; }
    if (device.status !== 'online') { listener(fail('DEVICE_OFFLINE', '设备不在线，无法追加实时遥测')); return () => {}; }
    if (!metrics.length || metrics.some(metric => !(metric in device.attributes))) { listener(fail('VALIDATION_ERROR', '指标无效')); return () => {}; }
    const step = granularity === 'minute' ? 60_000 : granularity === 'hour' ? 3_600_000 : DAY;
    let sequence = 0;
    const timer = setInterval(() => {
      sequence++;
      const timestamp = new Date(base + sequence * step).toISOString();
      const gap = sequence % 7 === 0;
      const points: TelemetryPoint[] = metrics.map(metric => {
        const center = Number(device.attributes[metric]);
        const value = gap || !Number.isFinite(center) ? null : Math.round((center + (hash(`${context.seed}:${id}:${metric}:live:${sequence}`) % 21 - 10) / 10) * 10) / 10;
        return { deviceId: id, metric, timestamp, value, unit: metric === 'temperature' ? '°C' : metric === 'humidity' ? '%RH' : metric === 'sampling_interval' ? '秒' : metric === 'voltage' ? 'V' : metric === 'current' ? 'A' : '', quality: value === null ? 'missing' : 'good' };
      });
      listener(ok(context, points, `${id}_live_${sequence}`));
    }, 5000);
    return () => clearInterval(timer);
  }
  async writableItems(context: Context, id: string): Promise<DeviceResult<ThingModelItem[]>> {
    this.sync();
    const device = this.devices.find(item => item.id === id);
    const denied = access(context, device?.tenantId ?? context.tenantId); if (denied) return denied;
    if (!device) return fail('NOT_FOUND', '设备不存在');
    const product = await this.modelService.get(context, device.productId);
    if ('error' in product) return fail(product.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'SCENARIO_TIMEOUT', product.error.message);
    return ok(context, product.data.model.filter(item => item.accessMode === 'write' || item.accessMode === 'readWrite'), id);
  }
  async executeCommand(context: Context, id: string, modelItemId: string, value: unknown): Promise<DeviceResult<Command>> {
    this.sync();
    const device = this.devices.find(item => item.id === id);
    const denied = access(context, device?.tenantId ?? context.tenantId, true); if (denied) return denied;
    if (!device) return fail('NOT_FOUND', '设备不存在');
    const model = await this.writableItems(context, id);
    if ('error' in model) return model;
    const item = model.data.find(candidate => candidate.id === modelItemId);
    if (!item) return fail('VALIDATION_ERROR', '命令不属于可写物模型项', { modelItemId: '请选择可写属性或服务' });
    const invalid = validateValue(item, value); if (invalid) return fail('VALIDATION_ERROR', '命令参数无效', { value: invalid });
    const active = device.status === 'online';
    const next: Command = { id: `cmd_${id}_${String(this.commands.length + 1).padStart(3, '0')}`, deviceId: id, modelItemId, identifier: item.identifier,
      value: value as Command['value'], status: active ? 'pending' : 'failed', ...(active ? { readyAt: Date.now() + 600 } : { reason: '设备离线或不可控制' }),
      actorId: context.actorId, createdAt: FIXED_AT, ...(!active ? { finishedAt: FIXED_AT } : {}) };
    this.commands.unshift(next); this.commit();
    return ok(context, next, next.id);
  }
  async commandHistory(context: Context, id: string): Promise<DeviceResult<Command[]>> {
    this.sync();
    const device = this.devices.find(item => item.id === id);
    const denied = access(context, device?.tenantId ?? context.tenantId); if (denied) return denied;
    if (!device) return fail('NOT_FOUND', '设备不存在');
    let changed = false;
    for (const command of this.commands) if (command.deviceId === id && command.status === 'pending' && (command.readyAt ?? 0) <= Date.now()) {
      command.status = 'succeeded'; command.finishedAt = FIXED_AT; delete command.readyAt; changed = true;
      if (command.identifier in device.attributes) device.attributes[command.identifier] = command.value;
    }
    if (changed) { this.commit(); this.commitDevices(); }
    return ok(context, this.commands.filter(item => item.deviceId === id), `${id}_commands`);
  }
  async getShadow(context: Context, id: string): Promise<DeviceResult<DeviceShadow>> {
    const history = await this.commandHistory(context, id);
    if ('error' in history) return history;
    const device = this.devices.find(item => item.id === id);
    if (!device) return fail('NOT_FOUND', '设备不存在');
    const pending = new Map<string, Command>();
    for (const command of history.data) if (command.status === 'pending' && command.identifier in device.attributes && !pending.has(command.identifier)) pending.set(command.identifier, command);
    return ok(context, { deviceId: id, lastActiveAt: device.lastActiveAt,
      entries: Object.entries(device.attributes).map(([identifier, reported]) => ({ identifier, reported, desired: pending.get(identifier)?.value ?? null, desiredCommandId: pending.get(identifier)?.id ?? null })) }, `${id}_shadow`);
  }
  async applyTelemetry(context: Context, id: string, points: TelemetryPoint[]): Promise<DeviceResult<DeviceShadow>> {
    this.sync();
    const device = this.devices.find(item => item.id === id);
    const denied = access(context, device?.tenantId ?? context.tenantId); if (denied) return denied;
    if (!device) return fail('NOT_FOUND', '设备不存在');
    if (device.status !== 'online') return fail('DEVICE_OFFLINE', '设备不在线，无法更新影子');
    const occurredAt = points[0]?.timestamp;
    if (!occurredAt || !validUtc(occurredAt) || points.some(point => point.deviceId !== id || point.timestamp !== occurredAt || !(point.metric in device.attributes) || point.value !== null && !Number.isFinite(point.value))) return fail('VALIDATION_ERROR', '遥测点与设备不匹配');
    if (device.lastActiveAt && occurredAt <= device.lastActiveAt) return this.getShadow(context, id);
    const valid = points.filter(point => point.value !== null && point.quality !== 'invalid' && point.quality !== 'missing');
    if (!valid.length) return this.getShadow(context, id);
    for (const point of valid) device.attributes[point.metric] = point.value as number;
    device.lastActiveAt = occurredAt;
    device.updatedAt = occurredAt;
    this.commitDevices();
    return this.getShadow(context, id);
  }
}
function browserStorage(): Storage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
export const devices = new DeviceService(browserStorage());
