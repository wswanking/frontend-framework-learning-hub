// IOT-PRODUCT-001 / IOT-DOMAIN-001. Each application owns an independent service copy.
import type { Context } from './dashboard';
import { TenantService } from './tenants';
import { readProductDeviceCounts } from './device-inventory';

export type ProductStatus = 'draft' | 'published' | 'disabled';
export type ItemKind = 'property' | 'event' | 'service';
export type DataType = 'float' | 'int' | 'enum' | 'bool' | 'string';
export type AccessMode = 'read' | 'write' | 'readWrite';
export type ThingModelItem = { id: string; kind: ItemKind; identifier: string; name: string; dataType: DataType; accessMode: AccessMode; unit?: string; min?: number; max?: number; enumValues?: string[]; description?: string };
export type DpRule = { id: string; itemId: string; rawType: 'int16' | 'float' | 'string'; scale: number; offset: number; precision: number; enumMap: { raw: string; value: string }[]; threshold?: { min: number; max: number }; expression: string };
export type AccessConfig = { uplinkPath: string; downlinkPath: string; payloadFormat: 'JSON' | 'Binary'; heartbeatSeconds: number };
export type Product = { id: string; tenantId: string; name: string; productKey: string; category: string; protocol: 'MQTT' | 'CoAP' | 'HTTP'; status: ProductStatus; updatedAt: string; deviceCount: number; version: number; accessConfig: AccessConfig; model: ThingModelItem[]; dpRules: DpRule[] };
export type ProductListQuery = { tenantId: string; keyword?: string; category?: string; status?: ProductStatus; page: number; pageSize: number; seed: number };
export type ProductInput = Pick<Product, 'tenantId' | 'name' | 'productKey' | 'category' | 'protocol' | 'status'>;
export type ProductError = { error: { code: 'FORBIDDEN' | 'VALIDATION_ERROR' | 'CONFLICT' | 'NOT_FOUND' | 'SCENARIO_TIMEOUT'; message: string; fieldErrors?: Record<string, string>; retryable?: boolean } };
export type ProductSuccess<T> = { data: T; meta: { requestId: string; seed: number; generatedAt: string } };
export type ProductResult<T> = ProductSuccess<T> | ProductError;
export type ConversionStep = { label: string; input: string; output: string };
export type Conversion = { steps: ConversionStep[]; value: string; valid: boolean; error?: string };

const FIXED_AT = '2026-09-16T00:00:00.000Z';
const STORAGE_KEY = 'iot-atlas-products-v1';
const updateTime = (version: number) => new Date(Date.parse(FIXED_AT) + version * 60_000).toISOString();
const IDENTIFIER = /^[a-z][a-z0-9_]{2,63}$/;
const PRODUCT_KEY = /^[a-z0-9-]{3,64}$/;
const clone = <T>(value: T): T => structuredClone(value);
export function defaultAccessConfig(protocol: Product['protocol']): AccessConfig {
  return { uplinkPath: protocol === 'MQTT' ? 'devices/{deviceId}/up' : '/devices/{deviceId}/events',
    downlinkPath: protocol === 'MQTT' ? 'devices/{deviceId}/down' : '/devices/{deviceId}/commands', payloadFormat: 'JSON', heartbeatSeconds: 60 };
}
function validateAccessConfig(input: AccessConfig): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of ['uplinkPath', 'downlinkPath'] as const) {
    if (typeof input?.[key] !== 'string' || !/^[^\s?#]{1,128}$/.test(input[key])) errors[key] = '路径为 1–128 位且不能含空白、? 或 #';
  }
  if (!['JSON', 'Binary'].includes(input?.payloadFormat)) errors.payloadFormat = '报文格式无效';
  if (!Number.isInteger(input?.heartbeatSeconds) || input.heartbeatSeconds < 10 || input.heartbeatSeconds > 3600) errors.heartbeatSeconds = '心跳间隔须为 10–3600 秒';
  return errors;
}
const seedProducts: Product[] = [
  { id: 'prod_as_001', tenantId: 'ten_202609_001', name: '工业温湿度传感器', productKey: 'temp-sense-pro', category: '工业传感器', protocol: 'MQTT', status: 'published', updatedAt: FIXED_AT, deviceCount: 6, version: 1, accessConfig: defaultAccessConfig('MQTT'),
    model: [
      { id: 'tm_temperature', kind: 'property', identifier: 'temperature', name: '温度', dataType: 'float', accessMode: 'read', unit: '°C', min: -40, max: 125 },
      { id: 'tm_humidity', kind: 'property', identifier: 'humidity', name: '湿度', dataType: 'float', accessMode: 'read', unit: '%RH', min: 0, max: 100 },
      { id: 'tm_sampling_interval', kind: 'property', identifier: 'sampling_interval', name: '采样间隔', dataType: 'int', accessMode: 'readWrite', unit: '秒', min: 10, max: 1000 },
      { id: 'tm_reboot', kind: 'service', identifier: 'reboot', name: '重启设备', dataType: 'bool', accessMode: 'write' },
    ], dpRules: [{ id: 'dp_temperature', itemId: 'tm_temperature', rawType: 'int16', scale: 0.1, offset: -40, precision: 1, enumMap: [], threshold: { min: -40, max: 125 }, expression: 'x' }] },
  { id: 'prod_as_002', tenantId: 'ten_202609_002', name: '能源网关', productKey: 'energy-gateway', category: '能源设备', protocol: 'MQTT', status: 'published', updatedAt: FIXED_AT, deviceCount: 6, version: 1, accessConfig: defaultAccessConfig('MQTT'), model: [], dpRules: [] },
  { id: 'prod_as_003', tenantId: 'ten_202609_001', name: '水质探头', productKey: 'water-sensor', category: '水务设备', protocol: 'CoAP', status: 'draft', updatedAt: FIXED_AT, deviceCount: 0, version: 1, accessConfig: defaultAccessConfig('CoAP'), model: [], dpRules: [] },
  { id: 'prod_as_004', tenantId: 'ten_202609_002', name: '门禁控制器', productKey: 'access-controller', category: '安防设备', protocol: 'HTTP', status: 'disabled', updatedAt: FIXED_AT, deviceCount: 0, version: 1, accessConfig: defaultAccessConfig('HTTP'), model: [], dpRules: [] },
];
function failure(code: ProductError['error']['code'], message: string, fieldErrors?: Record<string, string>): ProductError { return { error: { code, message, ...(fieldErrors ? { fieldErrors } : {}), retryable: code === 'SCENARIO_TIMEOUT' } }; }
function result<T>(context: Context, value: T, key: string): ProductSuccess<T> { return { data: clone(value), meta: { requestId: `req_${context.seed}_${key}`, seed: context.seed, generatedAt: FIXED_AT } }; }
function common(context: Context, tenantId: string, write: boolean): ProductError | null {
  if (context.scenario === 'forbidden' || (write && !['platformAdmin', 'tenantAdmin'].includes(context.role))) return failure('FORBIDDEN', '无权修改产品数据');
  if (context.role !== 'platformAdmin' && (tenantId === 'all' || tenantId !== context.tenantId)) return failure('FORBIDDEN', '无权访问该租户数据');
  if (write && tenantId === 'all') return failure('VALIDATION_ERROR', '写入需要显式租户', { tenantId: '请选择目标租户' });
  if (context.scenario === 'offline') return failure('SCENARIO_TIMEOUT', '模拟产品服务暂不可用');
  return null;
}
async function delay(context: Context) { if (context.scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 80)); }
function validSeed(context: Context, seed: number): ProductError | null { return Number.isInteger(seed) && seed === context.seed ? null : failure('VALIDATION_ERROR', 'seed 不一致', { seed: 'seed 必须与请求上下文一致' }); }
function validateProduct(input: ProductInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim() || input.name.trim().length > 80) errors.name = '名称长度为 1–80 字符';
  if (!PRODUCT_KEY.test(input.productKey)) errors.productKey = 'Product Key 为 3–64 位小写字母、数字或 -';
  if (!input.category.trim()) errors.category = '请选择类别';
  if (!['MQTT', 'CoAP', 'HTTP'].includes(input.protocol)) errors.protocol = '接入协议无效';
  if (!['draft', 'published', 'disabled'].includes(input.status)) errors.status = '产品状态无效';
  return errors;
}
export function modelIdentifierError(identifier: string, id: string, others: ThingModelItem[]): string | null {
  if (typeof identifier !== 'string' || !IDENTIFIER.test(identifier)) return '标识为 3–64 位小写字母、数字或下划线，须以字母开头';
  if (others.some(other => other.id !== id && other.identifier === identifier)) return '同一产品内标识必须唯一';
  return null;
}
function validateItem(item: ThingModelItem, others: ThingModelItem[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const identifierError = modelIdentifierError(item.identifier, item.id, others);
  if (identifierError) errors.identifier = identifierError;
  if (typeof item.name !== 'string' || !item.name.trim()) errors.name = '名称不能为空';
  if (!['property', 'event', 'service'].includes(item.kind)) errors.kind = '类型无效';
  if (!['float', 'int', 'enum', 'bool', 'string'].includes(item.dataType)) errors.dataType = '数据类型无效';
  if (!['read', 'write', 'readWrite'].includes(item.accessMode)) errors.accessMode = '读写权限无效';
  if (item.dataType === 'float' || item.dataType === 'int') {
    if (typeof item.unit !== 'string' || !item.unit.trim()) errors.unit = '数值类型必须填写单位';
    if (!Number.isFinite(item.min) || !Number.isFinite(item.max) || item.min! >= item.max!) errors.range = '数值范围必须有有效的最小值和最大值';
    if (item.enumValues !== undefined && (!Array.isArray(item.enumValues) || item.enumValues.length > 0)) errors.incompatibleFields = '数值类型不能保留枚举值';
  } else if ((typeof item.unit === 'string' && item.unit.trim()) || item.min !== undefined || item.max !== undefined) {
    errors.incompatibleFields = '非数值类型不能保留单位或数值范围';
  }
  if (item.dataType === 'enum' && (!Array.isArray(item.enumValues) || !item.enumValues.length || item.enumValues.some(value => typeof value !== 'string' || !value.trim()) || new Set(item.enumValues).size !== item.enumValues.length)) errors.enumValues = '枚举值不能为空或重复';
  if (item.dataType !== 'enum' && item.enumValues !== undefined && (!Array.isArray(item.enumValues) || item.enumValues.length > 0)) errors.incompatibleFields = '非枚举类型不能保留枚举值';
  return errors;
}
function validateRule(rule: DpRule, item: ThingModelItem): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!['int16', 'float', 'string'].includes(rule.rawType)) errors.rawType = '原始类型无效';
  if (!Number.isFinite(rule.scale) || rule.scale === 0) errors.scale = '倍率必须为非零有限数';
  if (!Number.isFinite(rule.offset)) errors.offset = '偏移必须为有限数';
  if (!Number.isInteger(rule.precision) || rule.precision < 0 || rule.precision > 6) errors.precision = '精度为 0–6 位整数';
  if (rule.threshold && (!Number.isFinite(rule.threshold.min) || !Number.isFinite(rule.threshold.max) || rule.threshold.min >= rule.threshold.max)) errors.threshold = '阈值范围无效';
  if (!Array.isArray(rule.enumMap) || rule.enumMap.some(entry => !entry || typeof entry.raw !== 'string' || typeof entry.value !== 'string')) errors.enumMap = '枚举映射必须是原始值与目标值数组';
  else {
    const keys = rule.enumMap.map(entry => entry.raw), values = rule.enumMap.map(entry => entry.value);
    if (new Set(keys).size !== keys.length || new Set(values).size !== values.length) errors.enumMap = '枚举映射键和值均不可重复';
    const graph = new Map(rule.enumMap.map(entry => [entry.raw, entry.value]));
    for (const start of graph.keys()) {
      const seen = new Set<string>(); let current: string | undefined = start;
      while (current && graph.has(current)) {
        if (seen.has(current)) { errors.enumMap = '枚举映射不可循环'; break; }
        seen.add(current); current = graph.get(current);
      }
      if (errors.enumMap) break;
    }
    if (item.dataType === 'enum' && !rule.enumMap.length) errors.enumMap = '枚举目标必须配置映射';
  }
  if (typeof rule.expression !== 'string' || !/^(x|abs\(x\)|round\(x\)|x\s*[+*-]\s*-?\d+(?:\.\d+)?)$/.test(rule.expression.trim())) errors.expression = '表达式仅支持 x、abs(x)、round(x) 或 x 与常数的加减乘';
  return errors;
}
function expressionValue(expression: string, value: number): number {
  const source = expression.trim();
  if (source === 'x') return value;
  if (source === 'abs(x)') return Math.abs(value);
  if (source === 'round(x)') return Math.round(value);
  const parts = /^x\s*([+*-])\s*(-?\d+(?:\.\d+)?)$/.exec(source)!;
  const constant = Number(parts[2]);
  return parts[1] === '+' ? value + constant : parts[1] === '-' ? value - constant : value * constant;
}

export class ProductService {
  private products = clone(seedProducts);
  constructor(private storage: Storage | null = null, private tenantService = new TenantService(storage)) { this.sync(); }
  private sync() {
    try {
      const saved = this.storage?.getItem(STORAGE_KEY);
      if (saved) {
        const rows = JSON.parse(saved) as Product[];
        if (Array.isArray(rows) && rows.every(row => row && typeof row.id === 'string' && typeof row.version === 'number' && Array.isArray(row.model) && Array.isArray(row.dpRules))) this.products = rows.map(row => ({ ...row, accessConfig: row.accessConfig ?? defaultAccessConfig(row.protocol) }));
      }
    } catch { /* Ignore unavailable or malformed local demo storage. */ }
    const counts = readProductDeviceCounts(this.storage);
    if (counts) this.products = this.products.map(product => ({ ...product, deviceCount: counts.get(`${product.tenantId}:${product.id}`) ?? 0 }));
  }
  private commit() { try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.products)); } catch { /* Keep the current session usable. */ } }
  async list(context: Context, query: ProductListQuery): Promise<ProductResult<{ items: Product[]; total: number; page: number; pageSize: number }>> {
    this.sync();
    const denied = common(context, query.tenantId, false) ?? validSeed(context, query.seed);
    if (denied) return denied;
    if (!Number.isInteger(query.page) || query.page < 1 || !Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) return failure('VALIDATION_ERROR', '分页条件无效', { page: '页码从 1 开始，每页 1–100 条' });
    await delay(context);
    const matched = this.products.filter(product => (query.tenantId === 'all' || product.tenantId === query.tenantId) && (!query.keyword || `${product.name} ${product.productKey}`.toLowerCase().includes(query.keyword.toLowerCase())) && (!query.category || product.category === query.category) && (!query.status || product.status === query.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    return result(context, { items: matched.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: matched.length, page: query.page, pageSize: query.pageSize }, `products_${query.page}`);
  }
  async get(context: Context, id: string): Promise<ProductResult<Product>> {
    this.sync();
    const product = this.products.find(candidate => candidate.id === id);
    const denied = common(context, product?.tenantId ?? (context.role === 'platformAdmin' ? 'all' : context.tenantId), false);
    if (denied) return denied;
    if (!product) return failure('NOT_FOUND', '产品不存在');
    await delay(context); return result(context, product, id);
  }
  async save(context: Context, input: ProductInput, id?: string, expectedVersion?: number, confirmImpact = false): Promise<ProductResult<Product>> {
    this.sync();
    const existing = id ? this.products.find(candidate => candidate.id === id) : undefined;
    const denied = common(context, existing?.tenantId ?? input.tenantId, true);
    if (denied) return denied;
    if (id && !existing) return failure('NOT_FOUND', '产品不存在');
    if (existing && input.tenantId !== existing.tenantId) return failure('VALIDATION_ERROR', '不能迁移产品租户', { tenantId: '租户不可修改' });
    const errors = validateProduct(input);
    if (Object.keys(errors).length) return failure('VALIDATION_ERROR', '产品信息无效', errors);
    const tenant = await this.tenantService.get(context, input.tenantId);
    if ('error' in tenant) return failure(tenant.error.code === 'NOT_FOUND' ? 'VALIDATION_ERROR' : tenant.error.code, tenant.error.message, tenant.error.code === 'NOT_FOUND' ? { tenantId: '未知租户' } : undefined);
    if (this.products.some(product => product.tenantId === input.tenantId && product.productKey === input.productKey && product.id !== id)) return failure('CONFLICT', 'Product Key 已存在', { productKey: '本租户内必须唯一' });
    if (existing && expectedVersion !== existing.version) return failure('CONFLICT', '产品已被其他版本修改，请刷新', { version: '版本冲突' });
    if (existing && !confirmImpact && input.protocol !== existing.protocol) return failure('CONFLICT', `切换接入协议将重置上下行路径，并可能影响 ${existing.deviceCount} 台关联设备、规则与 OTA`, { confirmImpact: '请确认影响后重试' });
    if (existing && !confirmImpact && input.productKey !== existing.productKey && existing.deviceCount > 0) return failure('CONFLICT', `修改 Product Key 可能影响 ${existing.deviceCount} 台关联设备的接入标识`, { confirmImpact: '请确认影响后重试' });
    await delay(context);
    this.sync();
    if (this.products.some(product => product.tenantId === input.tenantId && product.productKey === input.productKey && product.id !== id)) return failure('CONFLICT', 'Product Key 已存在', { productKey: '本租户内必须唯一' });
    const current = existing ? this.products.find(product => product.id === id) : undefined;
    if (existing && current?.version !== expectedVersion) return failure('CONFLICT', '产品已被其他版本修改，请刷新', { version: '版本冲突' });
    if (current && !confirmImpact && input.productKey !== current.productKey && current.deviceCount > 0) return failure('CONFLICT', `修改 Product Key 可能影响 ${current.deviceCount} 台关联设备的接入标识`, { confirmImpact: '请确认影响后重试' });
    if (!existing) {
      const capacity = await this.tenantService.checkCapacity(context, input.tenantId, 'products', this.products.filter(product => product.tenantId === input.tenantId).length);
      if ('error' in capacity) return failure(capacity.error.code, capacity.error.message, capacity.error.fieldErrors);
    }
    const nextVersion = current ? current.version + 1 : 1;
    const updatedAt = updateTime(nextVersion);
    const next: Product = current ? { ...current, ...input, accessConfig: input.protocol === current.protocol ? current.accessConfig : defaultAccessConfig(input.protocol), version: nextVersion, updatedAt } : { ...input, id: `prod_as_${String(this.products.length + 1).padStart(3, '0')}`, version: 1, updatedAt, deviceCount: 0, accessConfig: defaultAccessConfig(input.protocol), model: [], dpRules: [] };
    if (current) this.products = this.products.map(product => product.id === id ? next : product); else this.products.push(next);
    this.commit();
    return result(context, next, next.id);
  }
  async saveAccessConfig(context: Context, productId: string, input: AccessConfig, expectedVersion: number): Promise<ProductResult<Product>> {
    this.sync();
    const product = this.products.find(candidate => candidate.id === productId);
    const denied = common(context, product?.tenantId ?? context.tenantId, true);
    if (denied) return denied;
    if (!product) return failure('NOT_FOUND', '产品不存在');
    if (expectedVersion !== product.version) return failure('CONFLICT', '产品已被其他版本修改，请刷新', { version: '版本冲突' });
    const errors = validateAccessConfig(input);
    if (Object.keys(errors).length) return failure('VALIDATION_ERROR', '接入配置无效', errors);
    await delay(context); this.sync();
    const latest = this.products.find(candidate => candidate.id === productId);
    if (!latest || latest.version !== expectedVersion) return failure('CONFLICT', '产品已被其他版本修改，请刷新', { version: '版本冲突' });
    const next = { ...latest, accessConfig: clone(input), version: latest.version + 1, updatedAt: updateTime(latest.version + 1) };
    this.products = this.products.map(candidate => candidate.id === productId ? next : candidate);
    this.commit();
    return result(context, next, productId);
  }
  async saveModel(context: Context, productId: string, item: ThingModelItem, expectedVersion: number, confirmImpact = false): Promise<ProductResult<Product>> {
    this.sync();
    const product = this.products.find(candidate => candidate.id === productId);
    const denied = common(context, product?.tenantId ?? context.tenantId, true);
    if (denied) return denied;
    if (!product) return failure('NOT_FOUND', '产品不存在');
    if (expectedVersion !== product.version) return failure('CONFLICT', '版本冲突，请刷新', { version: '版本冲突' });
    const errors = validateItem(item, product.model);
    if (Object.keys(errors).length) return failure('VALIDATION_ERROR', '物模型字段无效', errors);
    let nextId = item.id || `tm_${item.identifier}`;
    if (!item.id) for (let suffix = 2; product.model.some(candidate => candidate.id === nextId); suffix++) nextId = `tm_${item.identifier}_${suffix}`;
    const normalized = { ...item, id: nextId };
    const previous = product.model.find(candidate => candidate.id === item.id);
    if (previous && previous.dataType !== item.dataType && product.deviceCount > 0 && !confirmImpact) return failure('CONFLICT', `修改数据类型将影响 ${product.deviceCount} 台设备、关联规则与 OTA`, { confirmImpact: '请确认影响后重试' });
    const next = { ...product, version: product.version + 1, updatedAt: updateTime(product.version + 1), model: [...product.model.filter(candidate => candidate.id !== normalized.id), clone(normalized)] };
    this.products = this.products.map(candidate => candidate.id === productId ? next : candidate);
    this.commit();
    return result(context, next, productId);
  }
  async removeModel(context: Context, productId: string, itemId: string, expectedVersion: number, confirmImpact = false): Promise<ProductResult<Product>> {
    this.sync();
    const product = this.products.find(candidate => candidate.id === productId);
    const denied = common(context, product?.tenantId ?? context.tenantId, true);
    if (denied) return denied;
    if (!product) return failure('NOT_FOUND', '产品不存在');
    if (expectedVersion !== product.version) return failure('CONFLICT', '版本冲突，请刷新', { version: '版本冲突' });
    if (!product.model.some(item => item.id === itemId)) return failure('NOT_FOUND', '物模型项不存在');
    if (product.deviceCount > 0 && !confirmImpact) return failure('CONFLICT', `删除将影响 ${product.deviceCount} 台设备、关联规则与 OTA`, { confirmImpact: '请确认影响后重试' });
    const next = { ...product, version: product.version + 1, updatedAt: updateTime(product.version + 1), model: product.model.filter(item => item.id !== itemId), dpRules: product.dpRules.filter(rule => rule.itemId !== itemId) };
    this.products = this.products.map(candidate => candidate.id === productId ? next : candidate);
    this.commit();
    return result(context, next, productId);
  }
  async testDpRule(context: Context, productId: string, rule: DpRule, raw: string): Promise<ProductResult<Conversion>> {
    this.sync();
    const product = this.products.find(candidate => candidate.id === productId);
    const denied = common(context, product?.tenantId ?? context.tenantId, false);
    if (denied) return denied;
    if (!product) return failure('NOT_FOUND', '产品不存在');
    const item = product.model.find(candidate => candidate.id === rule.itemId);
    if (!item) return failure('VALIDATION_ERROR', 'DP 必须绑定物模型项', { itemId: '物模型项不存在' });
    const errors = validateRule(rule, item);
    if (Object.keys(errors).length) return failure('VALIDATION_ERROR', 'DP 规则无效', errors);
    const steps: ConversionStep[] = [{ label: '原始输入', input: raw, output: raw }];
    if (item.dataType === 'string' && rule.rawType === 'string' && !rule.enumMap.length) {
      steps.push({ label: '目标类型校验', input: raw, output: '通过' });
      return result(context, { steps, value: raw, valid: true }, productId);
    }
    if (rule.rawType === 'int16' && (!raw.trim() || !Number.isInteger(Number(raw)) || Number(raw) < -32768 || Number(raw) > 32767)) return result(context, { steps, value: '', valid: false, error: '原始值与数据类型不匹配' }, productId);
    if (rule.rawType === 'float' && (!raw.trim() || !Number.isFinite(Number(raw)))) return result(context, { steps, value: '', valid: false, error: '原始值与数据类型不匹配' }, productId);
    let convertedRaw = raw;
    if (rule.enumMap.length) {
      const mapped = rule.enumMap.find(entry => entry.raw === raw);
      if (!mapped) return result(context, { steps, value: '', valid: false, error: '原始值无枚举映射' }, productId);
      steps.push({ label: '枚举映射', input: raw, output: mapped.value });
      if (item.dataType === 'enum' && !item.enumValues?.includes(mapped.value)) return result(context, { steps, value: mapped.value, valid: false, error: '映射值不在物模型枚举内' }, productId);
      if (item.dataType === 'enum' || item.dataType === 'string') {
        steps.push({ label: '目标类型校验', input: mapped.value, output: '通过' });
        return result(context, { steps, value: mapped.value, valid: true }, productId);
      }
      convertedRaw = mapped.value;
    }
    const numeric = Number(convertedRaw);
    if (!convertedRaw.trim() || !Number.isFinite(numeric)) return result(context, { steps, value: convertedRaw, valid: false, error: rule.enumMap.length ? '映射值与目标数据类型不匹配' : '原始值与数据类型不匹配' }, productId);
    const scaled = numeric * rule.scale + rule.offset;
    steps.push({ label: '倍率与偏移', input: convertedRaw, output: String(scaled) });
    const expressed = expressionValue(rule.expression, scaled);
    steps.push({ label: '表达式', input: String(scaled), output: String(expressed) });
    const rounded = Number(expressed.toFixed(rule.precision));
    steps.push({ label: '精度', input: String(expressed), output: String(rounded) });
    const inThreshold = !rule.threshold || (rounded >= rule.threshold.min && rounded <= rule.threshold.max);
    const inRange = (item.min === undefined || rounded >= item.min) && (item.max === undefined || rounded <= item.max);
    const typeValid = item.dataType === 'float' || (item.dataType === 'int' && Number.isInteger(rounded)) || (item.dataType === 'bool' && (rounded === 0 || rounded === 1));
    const valid = Number.isFinite(rounded) && inThreshold && inRange && typeValid;
    steps.push({ label: '范围与类型校验', input: String(rounded), output: valid ? '通过' : '不通过' });
    return result(context, { steps, value: item.dataType === 'bool' && valid ? String(Boolean(rounded)) : String(rounded), valid, ...(valid ? {} : { error: !inThreshold ? '超出 DP 阈值' : !inRange ? '超出物模型范围' : '目标数据类型不匹配' }) }, productId);
  }
  async saveDpRule(context: Context, productId: string, rule: DpRule, expectedVersion: number): Promise<ProductResult<Product>> {
    this.sync();
    const product = this.products.find(candidate => candidate.id === productId);
    const denied = common(context, product?.tenantId ?? context.tenantId, true);
    if (denied) return denied;
    if (!product) return failure('NOT_FOUND', '产品不存在');
    if (expectedVersion !== product.version) return failure('CONFLICT', '版本冲突，请刷新', { version: '版本冲突' });
    const item = product.model.find(candidate => candidate.id === rule.itemId);
    if (!item) return failure('VALIDATION_ERROR', 'DP 必须绑定物模型项', { itemId: '物模型项不存在' });
    const errors = validateRule(rule, item);
    if (typeof rule.id !== 'string' || !rule.id.trim()) errors.id = 'DP 规则 ID 不能为空';
    if (Object.keys(errors).length) return failure('VALIDATION_ERROR', 'DP 规则无效', errors);
    if (product.dpRules.some(candidate => candidate.id === rule.id && candidate.itemId !== rule.itemId)) return failure('CONFLICT', 'DP 规则 ID 已绑定其他物模型项', { id: '同一产品内规则 ID 必须唯一' });
    const next = { ...product, version: product.version + 1, updatedAt: updateTime(product.version + 1), dpRules: [...product.dpRules.filter(candidate => candidate.id !== rule.id), clone(rule)] };
    this.products = this.products.map(candidate => candidate.id === productId ? next : candidate);
    this.commit();
    return result(context, next, productId);
  }
}
function browserStorage(): Storage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
export const products = new ProductService(browserStorage());
