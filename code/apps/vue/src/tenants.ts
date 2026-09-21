// IOT-TENANT-001 / IOT-DOMAIN-001. This application owns its tenant Mock.
import type { Context } from './dashboard';

export type TenantStatus = 'active' | 'suspended';
export type TenantPlan = 'standard' | 'professional' | 'enterprise';
export type QuotaResource = 'devices' | 'products' | 'messages' | 'storageMb' | 'otaConcurrent';
export type Quota = Record<QuotaResource, { limit: number; warningAt: number }>;
export type Tenant = {
  id: string; name: string; key: string; status: TenantStatus; plan: TenantPlan;
  contact: string; email: string; description: string; quota: Quota;
  createdAt: string; updatedAt: string; revision: number;
};
export type TenantInput = Pick<Tenant, 'name' | 'key' | 'status' | 'plan' | 'contact' | 'email' | 'description' | 'quota'>;
export type MemberRole = 'tenantAdmin' | 'operator' | 'viewer';
export type Member = { id: string; tenantId: string; name: string; email: string; role: MemberRole; status: 'active' | 'disabled'; invitedAt: string; revision: number };
export type MemberInput = Pick<Member, 'name' | 'email' | 'role' | 'status'>;
export const memberPermissions: Record<MemberRole, string[]> = {
  tenantAdmin: ['查看本租户', '管理产品与设备', '编辑规则与固件', '创建 OTA'],
  operator: ['查看本租户', '设备控制', '规则试运行', '暂停与重试 OTA'],
  viewer: ['查看本租户'],
};
export type TenantQuery = { tenantId: string; seed: number; page: number; pageSize: number; keyword?: string; status?: TenantStatus; plan?: TenantPlan; health?: 'normal' | 'warning' | 'exceeded' };
export type Usage = Record<QuotaResource, number>;
export type UsageRow = { resource: QuotaResource; used: number; limit: number; warningAt: number; percent: number; health: 'normal' | 'warning' | 'exceeded' };
export type TenantSummary = Tenant & { memberCount: number; usage: UsageRow[]; health: UsageRow['health'] };
export type TenantError = { error: { code: 'FORBIDDEN' | 'VALIDATION_ERROR' | 'CONFLICT' | 'NOT_FOUND' | 'SCENARIO_TIMEOUT'; message: string; fieldErrors?: Record<string, string>; retryable?: boolean } };
export type TenantResult<T> = { data: T; meta: { requestId: string; seed: number; generatedAt: string } } | TenantError;

const AT = '2026-09-16T12:00:00.000Z';
const KEY = 'iot-atlas-tenants-v1';
const RESOURCES: QuotaResource[] = ['devices', 'products', 'messages', 'storageMb', 'otaConcurrent'];
const quota = (devices: number, products: number): Quota => ({ devices: { limit: devices, warningAt: 80 }, products: { limit: products, warningAt: 80 }, messages: { limit: 10_000, warningAt: 80 }, storageMb: { limit: 512, warningAt: 80 }, otaConcurrent: { limit: 5, warningAt: 80 } });
const seeds: Tenant[] = [
  { id: 'ten_202609_001', name: '华东智联', key: 'east-smart', status: 'active', plan: 'enterprise', contact: '张三', email: 'zhangsan@example.com', description: '工业传感与能源设备演示租户', quota: quota(10, 10), createdAt: '2026-09-01T00:00:00.000Z', updatedAt: AT, revision: 1 },
  { id: 'ten_202609_002', name: '全球能源', key: 'global-energy', status: 'active', plan: 'professional', contact: '李四', email: 'lisi@example.com', description: '全球网关演示租户', quota: quota(8, 8), createdAt: '2026-09-02T00:00:00.000Z', updatedAt: AT, revision: 1 },
];
const memberSeeds: Member[] = [
  { id: 'mem_001', tenantId: 'ten_202609_001', name: '张三', email: 'zhangsan@example.com', role: 'tenantAdmin', status: 'active', invitedAt: AT, revision: 1 },
  { id: 'mem_002', tenantId: 'ten_202609_001', name: '王五', email: 'wangwu@example.com', role: 'operator', status: 'active', invitedAt: AT, revision: 1 },
  { id: 'mem_003', tenantId: 'ten_202609_001', name: '赵六', email: 'zhaoliu@example.com', role: 'viewer', status: 'active', invitedAt: AT, revision: 1 },
  { id: 'mem_004', tenantId: 'ten_202609_002', name: '李四', email: 'lisi@example.com', role: 'tenantAdmin', status: 'active', invitedAt: AT, revision: 1 },
];
const clone = <T>(value: T): T => structuredClone(value);
const error = (code: TenantError['error']['code'], message: string, fieldErrors?: Record<string, string>): TenantError => ({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}), retryable: code === 'SCENARIO_TIMEOUT' } });
const ok = <T>(context: Context, data: T, key: string): TenantResult<T> => ({ data: clone(data), meta: { requestId: `req_${context.seed}_${key}`, seed: context.seed, generatedAt: AT } });
const admin = (context: Context) => context.role === 'platformAdmin';
function access(context: Context, tenantId: string, write = false): TenantError | null {
  if (context.scenario === 'forbidden' || (write && !admin(context)) || (!admin(context) && (context.role !== 'tenantAdmin' || tenantId !== context.tenantId))) return error('FORBIDDEN', '无权访问租户信息');
  if (write && tenantId === 'all') return error('VALIDATION_ERROR', '写入必须指定租户');
  if (context.scenario === 'offline') return error('SCENARIO_TIMEOUT', '模拟租户服务暂不可用');
  return null;
}
const wait = async (context: Context) => { if (context.scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 80)); };
function validate(input: TenantInput): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!input.name?.trim() || input.name.length > 80) fields.name = '名称须为 1–80 字符';
  if (!/^[a-z][a-z0-9-]{2,63}$/.test(input.key ?? '')) fields.key = '标识须为 3–64 位小写字母、数字或 -';
  if (!['active', 'suspended'].includes(input.status)) fields.status = '状态无效';
  if (!['standard', 'professional', 'enterprise'].includes(input.plan)) fields.plan = '套餐无效';
  if (!input.contact?.trim()) fields.contact = '联系人不能为空';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email ?? '')) fields.email = '邮箱格式无效';
  if ((input.description ?? '').length > 500) fields.description = '描述不能超过 500 字';
  for (const key of RESOURCES) {
    const row = input.quota?.[key];
    if (!row || !Number.isInteger(row.limit) || row.limit < 1 || !Number.isInteger(row.warningAt) || row.warningAt < 1 || row.warningAt > 100) fields[`quota.${key}`] = '上限须为正整数，预警百分比须为 1–100';
  }
  return fields;
}
function parseRows<T>(storage: Storage | null, key: string): T[] | null {
  if (!storage) return null;
  try { const rows: unknown = JSON.parse(storage.getItem(key) ?? 'null'); return Array.isArray(rows) ? rows as T[] : null; } catch { return null; }
}
function usageRows(tenant: Tenant, used: Usage): UsageRow[] {
  return RESOURCES.map(resource => {
    const { limit, warningAt } = tenant.quota[resource], count = used[resource], percent = Math.round(count / limit * 100);
    return { resource, used: count, limit, warningAt, percent, health: count >= limit ? 'exceeded' : percent >= warningAt ? 'warning' : 'normal' };
  });
}

export class TenantService {
  private tenants = clone(seeds);
  private members = clone(memberSeeds);
  constructor(private storage: Storage | null = null) { this.sync(); }
  private sync() {
    if (!this.storage) return;
    try { const saved: unknown = JSON.parse(this.storage.getItem(KEY) ?? 'null');
      if (!saved || typeof saved !== 'object') return;
      const state = saved as { tenants?: Tenant[]; members?: Member[] };
      if (Array.isArray(state.tenants) && Array.isArray(state.members) && state.tenants.every(row => row && typeof row.id === 'string' && Number.isInteger(row.revision)) && state.members.every(row => row && typeof row.id === 'string' && Number.isInteger(row.revision))) { this.tenants = state.tenants; this.members = state.members; }
    } catch { /* Current session remains usable. */ }
  }
  private commit() { try { this.storage?.setItem(KEY, JSON.stringify({ tenants: this.tenants, members: this.members })); } catch { /* Current session remains usable. */ } }
  private usage(tenantId: string): Usage {
    const deviceRows = parseRows<{ tenantId: string }>(this.storage, 'iot-atlas-devices-v1');
    const productRows = parseRows<{ tenantId: string }>(this.storage, 'iot-atlas-products-v1');
    const otaRows = parseRows<{ tenantId: string; status: string }>(this.storage, 'iot-atlas-ota-v1');
    const messageRows = parseRows<{ tenantId: string; id: string }>(this.storage, 'iot-atlas-device-messages-v1');
    const firmwareRows = parseRows<{ id: string; tenantId: string; sizeBytes: number }>(this.storage, 'iot-atlas-firmware-v1');
    const base = tenantId === 'ten_202609_001' || tenantId === 'ten_202609_002';
    return {
      devices: deviceRows ? deviceRows.filter(row => row.tenantId === tenantId).length : base ? 6 : 0,
      products: productRows ? productRows.filter(row => row.tenantId === tenantId).length : base ? 2 : 0,
      messages: (tenantId === 'ten_202609_001' ? 6_800 : tenantId === 'ten_202609_002' ? 2_400 : 0) + (messageRows?.filter(row => row && row.tenantId === tenantId && typeof row.id === 'string' && !row.id.startsWith('msg_seed_')).length ?? 0),
      storageMb: (tenantId === 'ten_202609_001' ? 320 : tenantId === 'ten_202609_002' ? 120 : 0) + Math.ceil((firmwareRows?.filter(row => row && row.tenantId === tenantId && row.id.startsWith('fw_new_') && Number.isFinite(row.sizeBytes) && row.sizeBytes > 0).reduce((sum, row) => sum + row.sizeBytes, 0) ?? 0) / (1024 * 1024)),
      otaConcurrent: otaRows ? otaRows.filter(row => row.tenantId === tenantId && !['draft', 'paused', 'succeeded', 'failed', 'cancelled', 'rolledBack'].includes(row.status)).length : 0,
    };
  }
  private summary(tenant: Tenant): TenantSummary {
    const usage = usageRows(tenant, this.usage(tenant.id));
    const health = usage.some(row => row.health === 'exceeded') ? 'exceeded' : usage.some(row => row.health === 'warning') ? 'warning' : 'normal';
    return { ...tenant, memberCount: this.members.filter(row => row.tenantId === tenant.id && row.status === 'active').length, usage, health };
  }
  async list(context: Context, query: TenantQuery): Promise<TenantResult<{ items: TenantSummary[]; total: number; page: number; pageSize: number }>> {
    this.sync(); const denied = access(context, query.tenantId); if (denied) return denied;
    if (query.seed !== context.seed || !Number.isInteger(query.page) || query.page < 1 || !Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100 || query.status && !['active', 'suspended'].includes(query.status) || query.plan && !['standard', 'professional', 'enterprise'].includes(query.plan) || query.health && !['normal', 'warning', 'exceeded'].includes(query.health)) return error('VALIDATION_ERROR', '租户查询条件无效');
    await wait(context);
    const rows = this.tenants.map(row => this.summary(row)).filter(row => (query.tenantId === 'all' || row.id === query.tenantId) && (!query.keyword || `${row.name} ${row.key} ${row.contact}`.toLowerCase().includes(query.keyword.toLowerCase())) && (!query.status || row.status === query.status) && (!query.plan || row.plan === query.plan) && (!query.health || row.health === query.health)).sort((a, b) => a.id.localeCompare(b.id));
    return ok(context, { items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: rows.length, page: query.page, pageSize: query.pageSize }, `tenants_${query.page}`);
  }
  async get(context: Context, id: string): Promise<TenantResult<TenantSummary & { members: Member[] }>> {
    this.sync(); const denied = access(context, id); if (denied) return denied;
    const row = this.tenants.find(item => item.id === id); if (!row) return error('NOT_FOUND', '租户不存在');
    await wait(context); return ok(context, { ...this.summary(row), members: this.members.filter(item => item.tenantId === id) }, id);
  }
  async save(context: Context, input: TenantInput, id?: string, expectedRevision?: number): Promise<TenantResult<Tenant>> {
    this.sync(); const denied = access(context, id ?? 'new_tenant', true); if (denied) return denied;
    const fields = validate(input); if (Object.keys(fields).length) return error('VALIDATION_ERROR', '租户信息无效', fields);
    const current = id ? this.tenants.find(item => item.id === id) : null;
    if (id && !current) return error('NOT_FOUND', '租户不存在');
    if (current && current.revision !== expectedRevision) return error('CONFLICT', '租户版本已变化，请刷新');
    if (this.tenants.some(item => item.id !== id && item.key === input.key)) return error('CONFLICT', '租户标识已存在', { key: '请使用唯一标识' });
    if (current) { const blocked = usageRows({ ...current, quota: input.quota }, this.usage(current.id)).filter(item => item.used > item.limit); if (blocked.length) return error('CONFLICT', `新上限低于已用量：${blocked.map(row => `${row.resource} ${row.used}/${row.limit}`).join('、')}`); }
    await wait(context); this.sync();
    const latest = id ? this.tenants.find(item => item.id === id) : null;
    if (id && (!latest || latest.revision !== expectedRevision)) return error('CONFLICT', '租户版本已变化，请刷新');
    if (this.tenants.some(item => item.id !== id && item.key === input.key)) return error('CONFLICT', '租户标识已存在', { key: '请使用唯一标识' });
    if (latest) { const blocked = usageRows({ ...latest, quota: input.quota }, this.usage(latest.id)).filter(item => item.used > item.limit); if (blocked.length) return error('CONFLICT', `新上限低于已用量：${blocked.map(row => `${row.resource} ${row.used}/${row.limit}`).join('、')}`); }
    const row: Tenant = { ...clone(input), id: id ?? `ten_202609_${String(this.tenants.length + 1).padStart(3, '0')}`, createdAt: latest?.createdAt ?? AT, updatedAt: AT, revision: (latest?.revision ?? 0) + 1 };
    this.tenants = id ? this.tenants.map(item => item.id === id ? row : item) : [...this.tenants, row];
    if (!id) this.members.push({ id: `mem_${String(Math.max(0, ...this.members.map(item => Number(item.id.slice(4)) || 0)) + 1).padStart(3, '0')}`, tenantId: row.id, name: row.contact, email: row.email.toLowerCase(), role: 'tenantAdmin', status: 'active', invitedAt: AT, revision: 1 });
    this.commit(); return ok(context, row, row.id);
  }
  async previewQuota(context: Context, tenantId: string, quotaInput: Quota): Promise<TenantResult<{ usage: UsageRow[]; blocked: UsageRow[] }>> {
    this.sync(); const denied = access(context, tenantId); if (denied) return denied;
    const row = this.tenants.find(item => item.id === tenantId); if (!row) return error('NOT_FOUND', '租户不存在');
    const fields = validate({ ...row, quota: quotaInput }); if (Object.keys(fields).length) return error('VALIDATION_ERROR', '配额无效', fields);
    const usage = usageRows({ ...row, quota: quotaInput }, this.usage(tenantId)); return ok(context, { usage, blocked: usage.filter(item => item.used > item.limit) }, `${tenantId}_preview`);
  }
  async updateQuota(context: Context, tenantId: string, quotaInput: Quota, expectedRevision: number): Promise<TenantResult<Tenant>> {
    this.sync(); const denied = access(context, tenantId, true); if (denied) return denied;
    const preview = await this.previewQuota(context, tenantId, quotaInput); if ('error' in preview) return preview;
    if (preview.data.blocked.length) return error('CONFLICT', `新上限低于已用量：${preview.data.blocked.map(row => `${row.resource} ${row.used}/${row.limit}`).join('、')}`);
    const row = this.tenants.find(item => item.id === tenantId); if (!row) return error('NOT_FOUND', '租户不存在');
    return this.save(context, { ...row, quota: quotaInput }, tenantId, expectedRevision);
  }
  async checkCapacity(context: Context, tenantId: string, resource: QuotaResource, usedOverride?: number): Promise<TenantResult<UsageRow>> {
    this.sync(); const denied = access(context, tenantId); if (denied) return denied;
    if (context.role !== 'platformAdmin' && context.role !== 'tenantAdmin') return error('FORBIDDEN', '无权创建租户资源');
    const row = this.tenants.find(item => item.id === tenantId); if (!row) return error('NOT_FOUND', '租户不存在');
    if (!RESOURCES.includes(resource) || usedOverride !== undefined && (!Number.isInteger(usedOverride) || usedOverride < 0)) return error('VALIDATION_ERROR', '配额检查参数无效');
    const used = Math.max(this.usage(tenantId)[resource], usedOverride ?? 0);
    const { limit, warningAt } = row.quota[resource], percent = Math.round(used / limit * 100), health = used >= limit ? 'exceeded' : percent >= warningAt ? 'warning' : 'normal';
    if (row.status !== 'active') return error('CONFLICT', '租户已停用，无法创建资源');
    if (used >= limit) return error('CONFLICT', `已达到 ${resource} 配额上限：已用 ${used}/${limit}；请清理资源或申请提高配额`);
    return ok(context, { resource, used, limit, warningAt, percent, health }, `${tenantId}_${resource}`);
  }
  async inviteMember(context: Context, tenantId: string, input: MemberInput): Promise<TenantResult<Member>> {
    this.sync(); const denied = access(context, tenantId, true); if (denied) return denied;
    if (!this.tenants.some(item => item.id === tenantId)) return error('NOT_FOUND', '租户不存在');
    if (!input.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email ?? '') || !['tenantAdmin', 'operator', 'viewer'].includes(input.role) || input.status !== 'active') return error('VALIDATION_ERROR', '成员信息无效');
    const email = input.email.trim().toLowerCase();
    if (this.members.some(item => item.tenantId === tenantId && item.email.toLowerCase() === email)) return error('CONFLICT', '该邮箱已是租户成员');
    await wait(context); this.sync();
    if (this.members.some(item => item.tenantId === tenantId && item.email.toLowerCase() === email)) return error('CONFLICT', '该邮箱已是租户成员');
    const member: Member = { id: `mem_${String(Math.max(0, ...this.members.map(item => Number(item.id.slice(4)) || 0)) + 1).padStart(3, '0')}`, tenantId, name: input.name.trim(), email, role: input.role, status: 'active', invitedAt: AT, revision: 1 };
    this.members.push(member); this.commit(); return ok(context, member, member.id);
  }
  async updateMember(context: Context, tenantId: string, id: string, input: MemberInput, expectedRevision: number): Promise<TenantResult<Member>> {
    this.sync(); const denied = access(context, tenantId, true); if (denied) return denied;
    const row = this.members.find(item => item.id === id && item.tenantId === tenantId); if (!row) return error('NOT_FOUND', '成员不存在');
    if (row.revision !== expectedRevision) return error('CONFLICT', '成员信息已变化，请刷新');
    if (!input.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email ?? '') || !['tenantAdmin', 'operator', 'viewer'].includes(input.role) || !['active', 'disabled'].includes(input.status)) return error('VALIDATION_ERROR', '成员信息无效');
    const email = input.email.trim().toLowerCase();
    if (this.members.some(item => item.id !== id && item.tenantId === tenantId && item.email.toLowerCase() === email)) return error('CONFLICT', '该邮箱已是租户成员');
    const lastAdmin = row.role === 'tenantAdmin' && row.status === 'active' && (input.role !== 'tenantAdmin' || input.status !== 'active') && this.members.filter(item => item.tenantId === tenantId && item.role === 'tenantAdmin' && item.status === 'active').length <= 1;
    if (lastAdmin) return error('CONFLICT', '必须保留至少一名启用的租户管理员');
    await wait(context); this.sync();
    const latest = this.members.find(item => item.id === id && item.tenantId === tenantId);
    if (!latest || latest.revision !== expectedRevision) return error('CONFLICT', '成员信息已变化，请刷新');
    if (this.members.some(item => item.id !== id && item.tenantId === tenantId && item.email.toLowerCase() === email)) return error('CONFLICT', '该邮箱已是租户成员');
    if (latest.role === 'tenantAdmin' && latest.status === 'active' && (input.role !== 'tenantAdmin' || input.status !== 'active') && this.members.filter(item => item.tenantId === tenantId && item.role === 'tenantAdmin' && item.status === 'active').length <= 1) return error('CONFLICT', '必须保留至少一名启用的租户管理员');
    const next: Member = { ...latest, ...clone(input), name: input.name.trim(), email, revision: latest.revision + 1 };
    this.members = this.members.map(item => item.id === id ? next : item); this.commit(); return ok(context, next, id);
  }
  async removeMember(context: Context, tenantId: string, id: string, expectedRevision: number): Promise<TenantResult<{ id: string }>> {
    this.sync(); const denied = access(context, tenantId, true); if (denied) return denied;
    const row = this.members.find(item => item.id === id && item.tenantId === tenantId); if (!row) return error('NOT_FOUND', '成员不存在');
    if (row.revision !== expectedRevision) return error('CONFLICT', '成员信息已变化，请刷新');
    if (row.role === 'tenantAdmin' && row.status === 'active' && this.members.filter(item => item.tenantId === tenantId && item.role === 'tenantAdmin' && item.status === 'active').length <= 1) return error('CONFLICT', '必须保留至少一名启用的租户管理员');
    await wait(context); this.sync();
    const latest = this.members.find(item => item.id === id && item.tenantId === tenantId);
    if (!latest || latest.revision !== expectedRevision) return error('CONFLICT', '成员信息已变化，请刷新');
    if (latest.role === 'tenantAdmin' && latest.status === 'active' && this.members.filter(item => item.tenantId === tenantId && item.role === 'tenantAdmin' && item.status === 'active').length <= 1) return error('CONFLICT', '必须保留至少一名启用的租户管理员');
    this.members = this.members.filter(item => item.id !== id); this.commit(); return ok(context, { id }, id);
  }
}
function browserStorage(): Storage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
export const tenants = new TenantService(browserStorage());
