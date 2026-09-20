import { Component, OnDestroy, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import type { Context, Role, Scenario } from './dashboard';
import { memberPermissions, tenants, type Member, type MemberInput, type Quota, type QuotaResource, type TenantInput, type TenantQuery, type TenantSummary, type UsageRow } from './tenants';

type Tab = 'overview' | 'members' | 'roles' | 'quotas' | 'products' | 'devices';
type Editor = 'tenant' | 'member' | 'quota' | null;
const baseQuery = (tenantId: string): TenantQuery => ({ tenantId, seed: 42, page: 1, pageSize: 10 });
const emptyQuota = (): Quota => ({ devices: { limit: 100, warningAt: 80 }, products: { limit: 20, warningAt: 80 }, messages: { limit: 10_000, warningAt: 80 }, storageMb: { limit: 512, warningAt: 80 }, otaConcurrent: { limit: 5, warningAt: 80 } });
const emptyTenant = (): TenantInput => ({ name: '', key: '', status: 'active', plan: 'standard', contact: '', email: '', description: '', quota: emptyQuota() });
const emptyMember = (): MemberInput => ({ name: '', email: '', role: 'viewer', status: 'active' });
const persistedTenant = () => { const id = localStorage.getItem('iot-atlas-current-tenant-v1'); return id && (id === 'all' || /^ten_202609_\d+$/.test(id)) ? id : 'all'; };

@Component({ selector: 'app-tenants', standalone: true, imports: [MatButtonModule, MatCardModule], templateUrl: './tenants.component.html', styleUrls: ['./dashboard.css', './tenants.css'] })
export class TenantsComponent implements OnDestroy {
  readonly Math = Math; readonly Object = Object; readonly encodeURIComponent = encodeURIComponent;
  readonly names: Record<string, string> = { all: '全部租户', ten_202609_001: '华东智联', ten_202609_002: '全球能源' };
  readonly statusNames = { active: '正常', suspended: '已停用' };
  readonly planNames = { standard: '标准版', professional: '专业版', enterprise: '企业版' };
  readonly roleNames = { tenantAdmin: '租户管理员', operator: '运维工程师', viewer: '数据观察员' };
  readonly resourceNames: Record<QuotaResource, string> = { devices: '设备', products: '产品', messages: '消息量', storageMb: '存储（MiB）', otaConcurrent: 'OTA 并发' };
  readonly quotaResourceRoute: Partial<Record<QuotaResource, string>> = { devices: '/devices', storageMb: '/firmware', otaConcurrent: '/firmware?tab=ota' };
  quotaResourceHref(resource: QuotaResource, tenantId: string) { const route = this.quotaResourceRoute[resource]; return route ? `${route}${route.includes('?') ? '&' : '?'}tenant=${encodeURIComponent(tenantId)}` : null; }
  readonly resources = Object.keys(this.resourceNames) as QuotaResource[];
  readonly tabs: Record<Tab, string> = { overview: '概览', members: '成员', roles: '角色', quotas: '配额', products: '产品', devices: '设备' };
  readonly healthNames = { normal: '正常', warning: '预警', exceeded: '超限' };
  readonly memberPermissions = memberPermissions;
  readonly role = signal<Role>('platformAdmin'); readonly scenario = signal<Scenario>('normal');
  readonly themeChoice = signal(localStorage.getItem('iot-atlas-theme') || 'dark');
  readonly systemDark = signal(matchMedia('(prefers-color-scheme: dark)').matches);
  readonly dark = computed(() => this.themeChoice() === 'dark' || this.themeChoice() === 'system' && this.systemDark());
  readonly currentTenant = signal(persistedTenant());
  readonly draft = signal<TenantQuery>(baseQuery(this.currentTenant())); readonly query = signal<TenantQuery>(baseQuery(this.currentTenant()));
  readonly rows = signal<TenantSummary[]>([]); readonly total = signal(0); readonly choices = signal<TenantSummary[]>([]);
  readonly selected = signal<(TenantSummary & { members: Member[] }) | null>(null); readonly tab = signal<Tab>('overview');
  readonly editor = signal<Editor>(null); readonly editedMember = signal<Member | null>(null); readonly editingTenantId = signal<string | null>(null);
  readonly tenantDraft = signal<TenantInput>(emptyTenant()); readonly memberDraft = signal<MemberInput>(emptyMember()); readonly quotaDraft = signal<Quota>(emptyQuota());
  readonly quotaPreview = signal<{ usage: UsageRow[]; blocked: UsageRow[] } | null>(null);
  readonly message = signal(''); readonly dirty = signal(false);
  readonly canWrite = computed(() => this.role() === 'platformAdmin'); readonly selectedHealth = computed(() => this.selected()?.health ?? 'normal');
  private media = matchMedia('(prefers-color-scheme: dark)');
  private mediaChanged = () => { this.systemDark.set(this.media.matches); if (this.themeChoice() === 'system') this.applyTheme(); };
  constructor() { this.media.addEventListener('change', this.mediaChanged); this.applyTheme(); void this.load(); void this.loadChoices(); }
  ngOnDestroy() { this.media.removeEventListener('change', this.mediaChanged); }
  private context(): Context { return { actorId: 'usr_202609_001', role: this.role(), tenantId: this.role() === 'platformAdmin' ? 'all' : 'ten_202609_001', seed: 42, scenario: this.scenario() }; }
  value(event: Event) { return (event.target as HTMLInputElement).value; }
  number(event: Event) { return Number(this.value(event)); }
  setTheme(value: string) { this.themeChoice.set(value); this.applyTheme(); }
  private applyTheme() { document.documentElement.dataset['theme'] = this.dark() ? 'dark' : 'light'; localStorage.setItem('iot-atlas-theme', this.themeChoice()); }
  setScenario(value: Scenario) { this.scenario.set(value); void this.load(); void this.loadChoices(); }
  async load() { const result = await tenants.list(this.context(), this.query()); if ('error' in result) { this.message.set(result.error.message); this.rows.set([]); this.total.set(0); } else { this.rows.set(result.data.items); this.total.set(result.data.total); } }
  async loadChoices() { if (this.role() !== 'platformAdmin') return; const result = await tenants.list(this.context(), baseQuery('all')); if ('data' in result) this.choices.set(result.data.items); }
  setDraft(key: keyof TenantQuery, value: unknown) { this.draft.update(current => ({ ...current, [key]: value })); }
  apply() { this.query.set({ ...this.draft(), page: 1 }); void this.load(); }
  changePage(delta: number) { this.query.update(current => ({ ...current, page: current.page + delta })); void this.load(); }
  checkDiscard() { return !this.dirty() || window.confirm('当前编辑尚未保存，放弃修改吗？'); }
  closeEditor() { if (!this.checkDiscard()) return; this.editor.set(null); this.dirty.set(false); this.quotaPreview.set(null); }
  async open(id: string, nextTab: Tab = 'overview', preserveMessage = false, afterSave = false) { if (!afterSave && !this.checkDiscard()) return; this.editor.set(null); this.dirty.set(false); const result = await tenants.get(this.context(), id); if ('error' in result) { this.message.set(result.error.message); return; } this.selected.set(result.data); this.tab.set(nextTab); if (!preserveMessage) this.message.set(''); }
  switchTenant(id: string) { if (!this.checkDiscard()) return; const next = this.role() === 'platformAdmin' ? id : 'ten_202609_001'; localStorage.setItem('iot-atlas-current-tenant-v1', next); this.currentTenant.set(next); this.draft.set(baseQuery(next)); this.query.set(baseQuery(next)); this.selected.set(null); this.editor.set(null); this.dirty.set(false); this.message.set(`已切换当前租户：${this.names[next] ?? next}`); void this.load(); }
  changeRole(next: Role) { if (!this.checkDiscard()) return; this.role.set(next); const id = next === 'platformAdmin' ? persistedTenant() : 'ten_202609_001'; this.currentTenant.set(id); this.draft.set(baseQuery(id)); this.query.set(baseQuery(id)); this.selected.set(null); this.editor.set(null); this.dirty.set(false); this.message.set(''); void this.load(); void this.loadChoices(); }
  selectTab(next: Tab) { if (!this.checkDiscard()) return; this.tab.set(next); this.editor.set(null); this.dirty.set(false); }
  startTenant(mode: 'new' | 'edit') { const selected = this.selected(); if (mode === 'edit' && !selected) return; this.editingTenantId.set(mode === 'edit' ? selected!.id : null); this.tenantDraft.set(mode === 'new' ? emptyTenant() : { ...selected!, quota: structuredClone(selected!.quota) }); this.editor.set('tenant'); this.dirty.set(false); this.message.set(''); }
  setTenantField(key: keyof TenantInput, value: unknown) { this.tenantDraft.update(current => ({ ...current, [key]: value })); this.dirty.set(true); }
  async saveTenant() { const selected = this.selected(), id = this.editingTenantId(); const result = await tenants.save(this.context(), this.tenantDraft(), id ?? undefined, id ? selected?.revision : undefined); if ('error' in result) { this.message.set(result.error.message); return; } this.editor.set(null); this.dirty.set(false); this.message.set(`租户 ${result.data.name} 已保存`); await this.load(); await this.loadChoices(); await this.open(result.data.id, 'overview', true, true); }
  startMember(member: Member | null) { this.editedMember.set(member); this.memberDraft.set(member ? { name: member.name, email: member.email, role: member.role, status: member.status } : emptyMember()); this.editor.set('member'); this.dirty.set(false); this.message.set(''); }
  setMemberField(key: keyof MemberInput, value: unknown) { this.memberDraft.update(current => ({ ...current, [key]: value })); this.dirty.set(true); }
  async saveMember() { const selected = this.selected(); if (!selected) return; const edited = this.editedMember(); const result = edited ? await tenants.updateMember(this.context(), selected.id, edited.id, this.memberDraft(), edited.revision) : await tenants.inviteMember(this.context(), selected.id, this.memberDraft()); if ('error' in result) { this.message.set(result.error.message); return; } this.editor.set(null); this.dirty.set(false); this.message.set(edited ? '成员信息已保存' : '已添加 Mock 成员，未发送真实邀请'); await this.load(); await this.open(selected.id, 'members', true, true); }
  async removeMember(member: Member) { const selected = this.selected(); if (!selected || !window.confirm(`移除 ${member.name}？此操作会取消其演示访问权限。`)) return; const result = await tenants.removeMember(this.context(), selected.id, member.id, member.revision); if ('error' in result) { this.message.set(result.error.message); return; } this.message.set('成员已移除'); await this.load(); await this.open(selected.id, 'members', true, true); }
  startQuota() { const selected = this.selected(); if (!selected) return; this.quotaDraft.set(structuredClone(selected.quota)); this.quotaPreview.set(null); this.editor.set('quota'); this.dirty.set(false); this.message.set(''); }
  setQuota(resource: QuotaResource, key: 'limit' | 'warningAt', value: number, tenant = false) { const target = tenant ? this.tenantDraft().quota : this.quotaDraft(); const updated = { ...target, [resource]: { ...target[resource], [key]: value } }; if (tenant) this.tenantDraft.update(current => ({ ...current, quota: updated })); else { this.quotaDraft.set(updated); this.quotaPreview.set(null); } this.dirty.set(true); }
  async previewQuota() { const selected = this.selected(); if (!selected) return; const result = await tenants.previewQuota(this.context(), selected.id, this.quotaDraft()); if ('error' in result) { this.message.set(result.error.message); return; } this.quotaPreview.set(result.data); this.message.set('已预览配额影响'); }
  async saveQuota() { const selected = this.selected(); if (!selected) return; const result = await tenants.updateQuota(this.context(), selected.id, this.quotaDraft(), selected.revision); if ('error' in result) { this.message.set(result.error.message); return; } this.editor.set(null); this.dirty.set(false); this.quotaPreview.set(null); this.message.set('配额已更新'); await this.load(); await this.open(selected.id, 'quotas', true, true); }
  used(row: TenantSummary, resource: QuotaResource) { return row.usage.find(item => item.resource === resource)?.used ?? 0; }
  roleName(key: string) { return this.roleNames[key as keyof typeof this.roleNames] ?? key; }
  displayTime(value: string) { return new Date(value).toLocaleString('zh-CN'); }
}
