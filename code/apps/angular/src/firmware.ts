// IOT-FIRMWARE-001 / IOT-DOMAIN-001. Each application owns its own Mock service.
import type { Context } from './dashboard';
import { products, type ProductService } from './products';
import { tenants, type TenantService } from './tenants';

export type FirmwareStatus = 'draft' | 'verified' | 'released' | 'archived';
export type Firmware = {
  id: string; tenantId: string; productId: string; compatibleProductIds: string[];
  name: string; version: string; description: string; fileName: string; sizeBytes: number;
  checksum: string; checksumValid: boolean; status: FirmwareStatus; createdBy: string;
  createdAt: string; updatedAt: string; revision: number;
  history: { at: string; actorId: string; action: string; detail: string }[];
};
export type FirmwareInput = Pick<Firmware, 'tenantId' | 'productId' | 'compatibleProductIds' | 'name' | 'version' | 'description' | 'fileName' | 'sizeBytes' | 'checksum' | 'checksumValid'>;
export type FirmwareQuery = { tenantId: string; seed: number; productId?: string; status?: FirmwareStatus; keyword?: string; page: number; pageSize: number };
export type FirmwareError = { error: { code: 'FORBIDDEN' | 'VALIDATION_ERROR' | 'CONFLICT' | 'NOT_FOUND' | 'SCENARIO_TIMEOUT'; message: string; fieldErrors?: Record<string, string>; retryable?: boolean } };
export type FirmwareResult<T> = { data: T; meta: { requestId: string; seed: number; generatedAt: string } } | FirmwareError;
export type FileInspection = { fileName: string; sizeBytes: number; checksum: string; checksumValid: boolean };

const FIXED_AT = '2026-09-16T12:00:00.000Z';
const STORAGE_KEY = 'iot-atlas-firmware-v1';
const OTA_KEY = 'iot-atlas-ota-v1';
const MAX_BYTES = 64 * 1024 * 1024;
const CHECKSUM = /^[a-f0-9]{64}$/i;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/i;
const clone = <T>(value: T): T => structuredClone(value);
const at = (n: number) => new Date(Date.parse(FIXED_AT) + n * 60_000).toISOString();
const seed: Firmware[] = [
  { id: 'fw_as_001', tenantId: 'ten_202609_001', productId: 'prod_as_001', compatibleProductIds: ['prod_as_001'], name: 'sensor-core', version: '2.4.1', description: '温湿度算法与稳定性演示版', fileName: 'sensor-core-2.4.1.bin', sizeBytes: 48_600_000, checksum: '32ac8c6d4e17a9c5b8e2d1f3a7c6e9d4b0a5c1d2e3f4a6b7c8d9e0f1a2b3c4d5', checksumValid: true, status: 'released', createdBy: 'usr_202609_001', createdAt: FIXED_AT, updatedAt: FIXED_AT, revision: 1, history: [{ at: FIXED_AT, actorId: 'usr_202609_001', action: 'released', detail: '演示种子固件已发布' }] },
  { id: 'fw_as_002', tenantId: 'ten_202609_001', productId: 'prod_as_001', compatibleProductIds: ['prod_as_001'], name: 'sensor-core', version: '2.3.0', description: '可用于回滚的上一版本', fileName: 'sensor-core-2.3.0.bin', sizeBytes: 47_900_000, checksum: '97b1ea3a9ed36d5df723a6b91a12672a9943921844911940134fa1acb2e72213', checksumValid: true, status: 'released', createdBy: 'usr_202609_001', createdAt: FIXED_AT, updatedAt: FIXED_AT, revision: 1, history: [{ at: FIXED_AT, actorId: 'usr_202609_001', action: 'released', detail: '演示种子固件已发布' }] },
  { id: 'fw_as_003', tenantId: 'ten_202609_002', productId: 'prod_as_002', compatibleProductIds: ['prod_as_002'], name: 'gateway-core', version: '1.5.2', description: '能源网关演示固件', fileName: 'gateway-core-1.5.2.bin', sizeBytes: 32_000_000, checksum: 'd42e6f3b8a9d1e2c4b5f60718293a4c5d6e7f8091a2b3c4d5e6f708192a3b4c5', checksumValid: true, status: 'released', createdBy: 'usr_202609_002', createdAt: FIXED_AT, updatedAt: FIXED_AT, revision: 1, history: [{ at: FIXED_AT, actorId: 'usr_202609_002', action: 'released', detail: '演示种子固件已发布' }] },
];
function error(code: FirmwareError['error']['code'], message: string, fieldErrors?: Record<string, string>): FirmwareError {
  return { error: { code, message, ...(fieldErrors ? { fieldErrors } : {}), retryable: code === 'SCENARIO_TIMEOUT' } };
}
function ok<T>(context: Context, data: T, key: string): FirmwareResult<T> { return { data: clone(data), meta: { requestId: `req_${context.seed}_${key}`, seed: context.seed, generatedAt: FIXED_AT } }; }
function access(context: Context, tenantId: string, write = false): FirmwareError | null {
  if (context.scenario === 'forbidden' || (write && context.role !== 'platformAdmin' && context.role !== 'tenantAdmin')) return error('FORBIDDEN', '无权管理固件');
  if (context.role !== 'platformAdmin' && (tenantId === 'all' || tenantId !== context.tenantId)) return error('FORBIDDEN', '无权访问该租户固件');
  if (write && tenantId === 'all') return error('VALIDATION_ERROR', '写入需要显式租户', { tenantId: '请选择目标租户' });
  if (context.scenario === 'offline') return error('SCENARIO_TIMEOUT', '模拟固件服务暂不可用');
  return null;
}
const slow = async (context: Context) => { if (context.scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 80)); };
function inspectMetadata(input: FirmwareInput): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!input.name?.trim() || input.name.length > 80) fields.name = '固件名称为 1–80 字符';
  if (!VERSION.test(input.version ?? '')) fields.version = '版本须为语义版本，如 2.4.1';
  if (!input.fileName || !/\.(bin|hex|ota)$/i.test(input.fileName)) fields.fileName = '只接受 .bin、.hex、.ota 文件';
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_BYTES) fields.sizeBytes = '文件大小须大于 0 且不超过 64 MiB';
  if (!CHECKSUM.test(input.checksum ?? '')) fields.checksum = 'SHA-256 须为 64 位十六进制文本';
  if (typeof input.checksumValid !== 'boolean') fields.checksumValid = '须提供校验结果';
  if (!Array.isArray(input.compatibleProductIds) || !input.compatibleProductIds.length || new Set(input.compatibleProductIds).size !== input.compatibleProductIds.length || !input.compatibleProductIds.includes(input.productId)) fields.compatibleProductIds = '适配产品至少包含固件所属产品，且不可重复';
  if (input.description?.length > 500) fields.description = '说明不能超过 500 字';
  return fields;
}

/** Reads bytes only for SHA-256. The file and its bytes are never persisted. */
export async function inspectFirmwareFile(file: File, onProgress?: (percent: number) => void): Promise<FileInspection | FirmwareError> {
  if (!/\.(bin|hex|ota)$/i.test(file.name)) return error('VALIDATION_ERROR', '文件类型不支持', { fileName: '只接受 .bin、.hex、.ota 文件' });
  if (file.size <= 0 || file.size > MAX_BYTES) return error('VALIDATION_ERROR', '文件大小不支持', { sizeBytes: '须大于 0 且不超过 64 MiB' });
  try {
    let bytes: ArrayBuffer;
    if (onProgress && typeof file.stream === 'function') {
      const reader = file.stream().getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0, reported = -1;
      onProgress(0);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); loaded += value.byteLength;
        const percent = Math.min(100, Math.floor(loaded / file.size * 100));
        if (percent !== reported) { onProgress(percent); reported = percent; }
      }
      if (loaded !== file.size) throw new Error('Incomplete file read');
      const combined = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
      bytes = combined.buffer;
    } else { bytes = await file.arrayBuffer(); onProgress?.(100); }
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const checksum = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return { fileName: file.name, sizeBytes: file.size, checksum, checksumValid: true };
  } catch { return error('VALIDATION_ERROR', '浏览器读取或校验文件失败，请重新选择', { fileName: '无法读取本地文件' }); }
}

export class FirmwareService {
  private records = clone(seed);
  constructor(private storage: Storage | null = null, private productService: ProductService = products, private tenantService: TenantService = tenants) { this.sync(); }
  private sync() {
    if (!this.storage) return;
    try { const saved = this.storage.getItem(STORAGE_KEY); if (!saved) return; const rows = JSON.parse(saved) as Firmware[];
      if (Array.isArray(rows) && rows.every(row => row && typeof row.id === 'string' && Number.isInteger(row.revision) && Array.isArray(row.history))) this.records = rows;
    } catch { /* Corrupt or unavailable demo storage leaves the current session usable. */ }
  }
  private commit() { try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.records)); } catch { /* Current session remains usable. */ } }
  async previewStorage(context: Context, tenantId: string, sizeBytes: number): Promise<FirmwareResult<{ used: number; projected: number; limit: number; warningAt: number; tenantStatus: 'active' | 'suspended' }>> {
    this.sync(); const denied = access(context, tenantId, true); if (denied) return denied;
    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) return error('VALIDATION_ERROR', '文件大小无效');
    const found = await this.tenantService.get(context, tenantId);
    if ('error' in found) return error(found.error.code, found.error.message);
    const row = found.data.usage.find(item => item.resource === 'storageMb');
    if (!row) return error('VALIDATION_ERROR', '租户存储配额不可用');
    const existingBytes = this.records.filter(item => item.tenantId === tenantId && item.id.startsWith('fw_new_')).reduce((sum, item) => sum + item.sizeBytes, 0);
    let persistedBytes = 0;
    try {
      const rows: unknown = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null');
      if (Array.isArray(rows)) persistedBytes = rows.filter(item => item && item.tenantId === tenantId && typeof item.id === 'string' && item.id.startsWith('fw_new_') && Number.isFinite(item.sizeBytes) && item.sizeBytes > 0).reduce((sum, item) => sum + item.sizeBytes, 0);
    } catch { /* A failed or unavailable write does not erase current-session quota use. */ }
    const projected = row.used + Math.ceil((existingBytes + sizeBytes) / (1024 * 1024)) - Math.ceil(persistedBytes / (1024 * 1024));
    return ok(context, { used: row.used, projected, limit: row.limit, warningAt: row.warningAt, tenantStatus: found.data.status }, `${tenantId}_storage_preview`);
  }
  private async storageCapacity(context: Context, tenantId: string, sizeBytes: number): Promise<FirmwareError | null> {
    const preview = await this.previewStorage(context, tenantId, sizeBytes);
    if ('error' in preview) return preview;
    const { projected, limit, tenantStatus } = preview.data;
    if (tenantStatus !== 'active') return error('CONFLICT', '租户已停用，无法创建资源');
    if (projected > limit) return error('CONFLICT', `存储配额不足：预计 ${projected}/${limit} MiB；请清理固件或申请提高配额`);
    return null;
  }
  private references(id: string): string[] {
    if (!this.storage) return [];
    try { const rows = JSON.parse(this.storage.getItem(OTA_KEY) ?? '[]') as { id: string; firmwareId: string; status: string }[];
      return Array.isArray(rows) ? rows.filter(row => row.firmwareId === id).map(row => row.id) : [];
    } catch { return []; }
  }
  async list(context: Context, query: FirmwareQuery): Promise<FirmwareResult<{ items: Firmware[]; total: number; page: number; pageSize: number }>> {
    this.sync(); const denied = access(context, query.tenantId); if (denied) return denied;
    if (query.seed !== context.seed || !Number.isInteger(query.seed) || !Number.isInteger(query.page) || query.page < 1 || !Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) return error('VALIDATION_ERROR', '查询条件无效');
    if (query.status && !['draft', 'verified', 'released', 'archived'].includes(query.status)) return error('VALIDATION_ERROR', '固件状态无效');
    await slow(context);
    const rows = this.records.filter(row => (query.tenantId === 'all' || row.tenantId === query.tenantId) && (!query.productId || row.productId === query.productId) && (!query.status || row.status === query.status) && (!query.keyword || `${row.name} ${row.version} ${row.fileName}`.toLowerCase().includes(query.keyword.toLowerCase())))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    return ok(context, { items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: rows.length, page: query.page, pageSize: query.pageSize }, `firmwares_${query.page}`);
  }
  async get(context: Context, id: string): Promise<FirmwareResult<Firmware & { referencedTaskIds: string[] }>> {
    this.sync(); const row = this.records.find(item => item.id === id); const denied = access(context, row?.tenantId ?? context.tenantId); if (denied) return denied;
    if (!row) return error('NOT_FOUND', '固件不存在'); await slow(context); return ok(context, { ...row, referencedTaskIds: this.references(id) }, id);
  }
  async create(context: Context, input: FirmwareInput): Promise<FirmwareResult<Firmware>> {
    this.sync(); const denied = access(context, input.tenantId, true); if (denied) return denied;
    const fields = inspectMetadata(input); if (Object.keys(fields).length) return error('VALIDATION_ERROR', '固件信息无效', fields);
    const own = await this.productService.get(context, input.productId);
    if ('error' in own) return own.error.code === 'FORBIDDEN' ? error('FORBIDDEN', '无权访问所属产品') : error('VALIDATION_ERROR', '所属产品不存在', { productId: '请选择有效产品' });
    if (own.data.tenantId !== input.tenantId) return error('VALIDATION_ERROR', '产品与租户不一致', { productId: '请选择同租户产品' });
    for (const id of input.compatibleProductIds) { const product = await this.productService.get(context, id); if ('error' in product || product.data.tenantId !== input.tenantId) return error('VALIDATION_ERROR', '适配产品不兼容', { compatibleProductIds: '所有适配产品须属于同一租户' }); }
    if (this.records.some(row => row.productId === input.productId && row.version === input.version)) return error('CONFLICT', '同产品版本已存在', { version: '请选择新版本' });
    const quotaError = await this.storageCapacity(context, input.tenantId, input.sizeBytes); if (quotaError) return quotaError;
    await slow(context); this.sync();
    if (this.records.some(row => row.productId === input.productId && row.version === input.version)) return error('CONFLICT', '同产品版本已存在', { version: '请选择新版本' });
    const latestQuotaError = await this.storageCapacity(context, input.tenantId, input.sizeBytes); if (latestQuotaError) return latestQuotaError;
    const nextNumber = Math.max(3, ...this.records.map(item => Number(item.id.slice(7)) || 0)) + 1;
    const id = `fw_new_${String(nextNumber).padStart(3, '0')}`, now = at(nextNumber);
    const row: Firmware = { ...clone(input), id, status: 'draft', createdBy: context.actorId, createdAt: now, updatedAt: now, revision: 1, history: [{ at: now, actorId: context.actorId, action: 'created', detail: '登记固件元数据；未存储文件内容' }] };
    this.records.push(row); this.commit(); return ok(context, row, id);
  }
  async transition(context: Context, id: string, action: 'verify' | 'release' | 'archive', expectedRevision: number): Promise<FirmwareResult<Firmware>> {
    this.sync(); const row = this.records.find(item => item.id === id); const denied = access(context, row?.tenantId ?? context.tenantId, true); if (denied) return denied;
    if (!row) return error('NOT_FOUND', '固件不存在');
    if (row.revision !== expectedRevision) return error('CONFLICT', '固件版本已变化，请刷新');
    const expected: Record<typeof action, FirmwareStatus> = { verify: 'draft', release: 'verified', archive: 'released' };
    if (row.status !== expected[action]) return error('CONFLICT', `当前状态 ${row.status} 不能执行 ${action}`);
    if (action === 'verify' && !row.checksumValid) return error('VALIDATION_ERROR', '校验失败的固件不可通过验证');
    if (action === 'archive' && this.references(id).length) return error('CONFLICT', `固件正被 OTA 任务引用：${this.references(id).join('、')}`);
    await slow(context); this.sync(); const latest = this.records.find(item => item.id === id);
    if (!latest || latest.revision !== expectedRevision) return error('CONFLICT', '固件版本已变化，请刷新');
    const now = at(this.records.length + latest.revision + 1), status: FirmwareStatus = action === 'verify' ? 'verified' : action === 'release' ? 'released' : 'archived';
    const next: Firmware = { ...latest, status, revision: latest.revision + 1, updatedAt: now, history: [...latest.history, { at: now, actorId: context.actorId, action, detail: `状态变为 ${status}` }] };
    this.records = this.records.map(item => item.id === id ? next : item); this.commit(); return ok(context, next, id);
  }
  async remove(context: Context, id: string, expectedRevision: number): Promise<FirmwareResult<{ id: string }>> {
    this.sync(); const row = this.records.find(item => item.id === id); const denied = access(context, row?.tenantId ?? context.tenantId, true); if (denied) return denied;
    if (!row) return error('NOT_FOUND', '固件不存在');
    if (row.revision !== expectedRevision) return error('CONFLICT', '固件版本已变化，请刷新');
    if (row.status === 'released') return error('CONFLICT', '已发布固件不能直接删除，请先归档');
    const refs = this.references(id); if (refs.length) return error('CONFLICT', `固件正被 OTA 任务引用：${refs.join('、')}`);
    this.records = this.records.filter(item => item.id !== id); this.commit(); return ok(context, { id }, id);
  }
  /** OTA calls this after its own tenant and device checks. */
  async eligible(context: Context, id: string, productId: string): Promise<FirmwareResult<Firmware>> {
    const found = await this.get(context, id); if ('error' in found) return found;
    const row = found.data;
    if (row.status !== 'released' || !row.checksumValid) return error('VALIDATION_ERROR', '仅已校验并发布的固件可用于 OTA');
    if (!row.compatibleProductIds.includes(productId)) return error('VALIDATION_ERROR', '固件与目标产品不兼容');
    return ok(context, row, id);
  }
}
function browserStorage(): Storage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
export const firmwares = new FirmwareService(browserStorage());
