import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DashboardChartComponent } from './dashboard-chart.component';
import { getSummary, type Context, type DashboardData, type DashboardQuery, type Role, type Scenario } from './dashboard';

type Range = '24h' | '7d' | '30d' | 'custom';
type Draft = { tenantId: string; region: string; range: Range; from: string; to: string };
type ThemeChoice = 'light' | 'dark' | 'system';
const DAY = 86_400_000;
function defaultDraft(): Draft { return { tenantId: localStorage.getItem('iot-atlas-current-tenant-v1') || 'all', region: '', range: '24h', from: '', to: '' }; }
function localInput(iso: string) { const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
function queryFromDraft(value: Draft): DashboardQuery {
  const to = value.range === 'custom' ? new Date(value.to) : new Date();
  const from = value.range === 'custom' ? new Date(value.from) : new Date(to.getTime() - ({ '24h': DAY, '7d': 7 * DAY, '30d': 30 * DAY }[value.range]));
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to || to.getTime() > Date.now() + 1000 || to.getTime() - from.getTime() > 30 * DAY) throw new Error('请选择有效且不晚于当前时间的 30 天内范围');
  return { tenantId: value.tenantId, region: value.region || undefined, from: from.toISOString(), to: to.toISOString(), seed: 42 };
}
function initialQuery(): DashboardQuery {
  const params = new URLSearchParams(location.search);
  const tenantId = params.get('tenant'), from = params.get('from'), to = params.get('to');
  if (tenantId && from && to && Number.isFinite(Date.parse(from)) && Number.isFinite(Date.parse(to))) return { tenantId, from, to, region: params.get('region') || undefined, seed: 42 };
  return queryFromDraft({ ...defaultDraft(), tenantId: tenantId || defaultDraft().tenantId });
}

@Component({
  selector: 'app-dashboard', standalone: true, imports: [MatButtonModule, MatCardModule, MatProgressSpinnerModule, DashboardChartComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnDestroy {
  readonly tenantNames: Record<string, string> = { all: '全部租户', ten_202609_001: '华东智联', ten_202609_002: '全球能源' };
  readonly continentNames: Partial<Record<string, string>> = { AS: '亚洲', EU: '欧洲', NA: '北美洲', SA: '南美洲', AF: '非洲', OC: '大洋洲' };
  readonly countryNames: Partial<Record<string, string>> = { CN: '中国', DE: '德国', US: '美国', BR: '巴西', ZA: '南非', AU: '澳大利亚', JP: '日本', FR: '法国', CA: '加拿大', AR: '阿根廷', EG: '埃及', NZ: '新西兰' };
  readonly countryContinent: Record<string, string> = { CN: 'AS', JP: 'AS', DE: 'EU', FR: 'EU', US: 'NA', CA: 'NA', BR: 'SA', AR: 'SA', ZA: 'AF', EG: 'AF', AU: 'OC', NZ: 'OC' };
  geographyUrl(query: DashboardQuery, continent?: string, country?: string, node?: string) { const params = new URLSearchParams({ tenant: query.tenantId, from: query.from, to: query.to }); if (continent) params.set('continent', continent); if (country) params.set('country', country); if (node) params.set('node', node); return `/geography?${params}`; }
  deviceUrl(id: string) { return `/devices?device=${encodeURIComponent(id)}`; }
  readonly nav = ['数据大盘', '全球节点', '产品与物模型', '设备中心', '规则引擎', '固件与 OTA', '租户管理', '实验室', '交付看板'];
  readonly eventLabels = { info: '● 遥测', minor: '⚠ 一般告警', major: '⚠ 重要告警', critical: '⛔ 紧急告警' };
  readonly tenants = Object.entries(this.tenantNames).map(([id, name]) => ({ id, name }));
  readonly continents = Object.entries(this.continentNames).map(([id, name]) => ({ id, name }));
  readonly applied = signal<DashboardQuery>(initialQuery());
  readonly draft = signal<Draft>({ tenantId: this.applied().tenantId, region: this.applied().region || '', range: new URLSearchParams(location.search).has('from') ? 'custom' : '24h', from: localInput(this.applied().from), to: localInput(this.applied().to) });
  readonly role = signal<Role>('platformAdmin');
  readonly scenario = signal<Scenario>('normal');
  readonly data = signal<DashboardData | null>(null);
  readonly error = signal('');
  readonly retryable = signal(false);
  readonly filterError = signal('');
  readonly loading = signal(true);
  readonly refreshedAt = signal<string | null>(null);
  readonly filterOpen = signal(false);
  readonly stale = signal(false);
  readonly paused = signal(false);
  readonly pendingCount = signal(0);
  readonly showAllEvents = signal(false);
  private pendingData: DashboardData | null = null;
  readonly country = signal<string | null>(new URLSearchParams(location.search).get('country'));
  readonly node = signal<string | null>(new URLSearchParams(location.search).get('node'));
  readonly themeChoice = signal<ThemeChoice>((localStorage.getItem('iot-atlas-theme') as ThemeChoice) || 'dark');
  readonly systemDark = signal(matchMedia('(prefers-color-scheme: dark)').matches);
  readonly dark = computed(() => this.themeChoice() === 'dark' || (this.themeChoice() === 'system' && this.systemDark()));
  readonly selected = computed(() => this.data()?.countries.find(item => item.id === this.country()));
  readonly selectedNode = computed(() => this.data()?.nodes.find(item => item.id === this.node()));
  readonly metrics = computed(() => {
    const data = this.data();
    return data ? [
      ['接入设备', this.number(data.metrics.devices), '台', this.number(data.comparison.devices)], ['在线率', this.percent(data.metrics.onlineRate), `${this.number(data.metrics.onlineDevices)} 台在线`, this.percent(data.comparison.onlineRate)],
      ['消息量', this.number(data.metrics.messages), '条', this.number(data.comparison.messages)], ['活跃告警', this.number(data.metrics.activeAlarms), '条', this.number(data.comparison.activeAlarms)], ['OTA 成功率', this.percent(data.metrics.otaSuccessRate), '已完成执行', this.percent(data.comparison.otaSuccessRate)],
    ] : [];
  });
  private request = 0;
  private drawerTrigger: HTMLElement | null = null;
  private focusedDrawer: string | null = null;
  private readonly router = inject(Router);
  private media = matchMedia('(prefers-color-scheme: dark)');
  private readonly updateSystem = () => { this.systemDark.set(this.media.matches); if (this.themeChoice() === 'system') document.documentElement.dataset['theme'] = this.media.matches ? 'dark' : 'light'; };
  private readonly refreshMock = () => { void this.load(); };
  private readonly onStorage = (event: StorageEvent) => { if (['iot-atlas-device-messages-v1', 'iot-atlas-device-alarm-acks-v1', 'iot-atlas-ota-v1', 'iot-atlas-devices-v1', 'iot-atlas-rule-logs-v1'].includes(event.key ?? '')) void this.load(); };
  constructor() {
    this.media.addEventListener('change', this.updateSystem);
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('iot-atlas-mock-changed', this.refreshMock);
    window.addEventListener('keydown', this.onDrawerEscape);
    this.setTheme(this.themeChoice());
    void this.load();
  }
  ngOnDestroy() { this.media.removeEventListener('change', this.updateSystem); window.removeEventListener('storage', this.onStorage); window.removeEventListener('iot-atlas-mock-changed', this.refreshMock); window.removeEventListener('keydown', this.onDrawerEscape); }
  clearPause() { this.paused.set(false); this.pendingData = null; this.pendingCount.set(0); }
  pauseEvents() { this.paused.set(true); }
  resumeEvents() { this.paused.set(false); if (this.pendingData) { this.data.set(this.pendingData); this.pendingData = null; } this.pendingCount.set(0); const list = document.querySelector<HTMLUListElement>('.event-list'); if (list) list.scrollTop = 0; }
  onEventScroll(event: Event) { if ((event.target as HTMLUListElement).scrollTop > 16 && !this.paused()) this.pauseEvents(); }
  number(value: number) { return new Intl.NumberFormat('zh-CN').format(value); }
  percent(value: number | null) { return value === null ? '—' : `${(value * 100).toFixed(1)}%`; }
  formatDate(value: string) { return new Date(value).toLocaleDateString('zh-CN'); }
  formatTime(value: string) { return new Date(value).toLocaleString('zh-CN'); }
  severityName(value: 'critical' | 'major' | 'minor') { return { critical: '紧急', major: '重要', minor: '一般' }[value]; }
  nodesForCountry() { return this.data()?.nodes.filter(node => node.countryCode === this.country()) ?? []; }
  setTheme(value: ThemeChoice) { this.themeChoice.set(value); const dark = value === 'dark' || (value === 'system' && this.systemDark()); document.documentElement.dataset['theme'] = dark ? 'dark' : 'light'; localStorage.setItem('iot-atlas-theme', value); }
  private clearSelection() { this.country.set(null); this.node.set(null); this.drawerTrigger = null; this.focusedDrawer = null; void this.router.navigateByUrl(this.urlFor(this.applied())); }
  setRole(value: Role) { this.clearPause(); this.data.set(null); this.clearSelection(); this.role.set(value); void this.load(); }
  setScenario(value: Scenario) { if (value === 'forbidden') { this.clearPause(); this.data.set(null); this.clearSelection(); } this.scenario.set(value); void this.load(); }
  setDraft(key: keyof Draft, value: string) { this.draft.update(current => ({ ...current, [key]: value })); }
  private async load() {
    const current = ++this.request;
    this.loading.set(true); this.error.set('');
    const context: Context = { actorId: 'usr_202609_001', role: this.role(), tenantId: this.role() === 'platformAdmin' ? 'all' : 'ten_202609_001', seed: 42, scenario: this.scenario() };
    const result = await getSummary(context, this.applied());
    if (current !== this.request) return;
    if ('error' in result) { this.error.set(result.error.message); this.retryable.set(result.error.retryable === true); if (result.error.code === 'FORBIDDEN') { this.clearPause(); this.data.set(null); this.stale.set(false); this.clearSelection(); } else this.stale.set(true); }
    else { if (this.paused() && this.data()) { this.pendingData = result.data; const seen = new Set(this.data()!.events.map(item => item.id)); this.pendingCount.set(result.data.events.filter(item => !seen.has(item.id)).length); this.data.set({ ...result.data, events: this.data()!.events }); } else this.data.set(result.data); this.refreshedAt.set(new Date().toISOString()); this.stale.set(false); this.retryable.set(false); }
    this.loading.set(false);
    if (this.node() || this.country()) this.focusDrawer(this.node() ?? this.country()!);
  }
  retry() { void this.load(); }
  private urlFor(query: DashboardQuery, selectedCountry?: string, selectedNode?: string) {
    const params = new URLSearchParams({ tenant: query.tenantId, from: query.from, to: query.to });
    if (query.region) params.set('region', query.region);
    if (selectedCountry) params.set('country', selectedCountry);
    if (selectedNode) params.set('node', selectedNode);
    return `/dashboard?${params}`;
  }
  private rememberDrawerTrigger() { const active = document.activeElement; if (active instanceof HTMLElement && !active.closest('.country-drawer')) this.drawerTrigger = active; }
  private restoreDrawerTrigger() { const trigger = this.drawerTrigger; requestAnimationFrame(() => trigger?.focus()); }
  private focusDrawer(id: string) { if (id === this.focusedDrawer) return; requestAnimationFrame(() => { const drawer = document.querySelector<HTMLElement>('.country-drawer'); if (drawer) { drawer.focus(); this.focusedDrawer = id; } }); }
  invalidStart() { return !Number.isFinite(Date.parse(this.draft().from)); }
  private readonly onDrawerEscape = (event: KeyboardEvent) => { if (event.key !== 'Escape' || (!this.country() && !this.node())) return; event.preventDefault(); this.country.set(null); this.node.set(null); this.focusedDrawer = null; void this.router.navigateByUrl(this.urlFor(this.applied())); this.restoreDrawerTrigger(); };
  openCountry(code: string) { this.rememberDrawerTrigger(); this.node.set(null); this.country.set(code); this.focusDrawer(code); void this.router.navigateByUrl(this.urlFor(this.applied(), code)); }
  closeCountry() { this.country.set(null); this.focusedDrawer = null; void this.router.navigateByUrl(this.urlFor(this.applied())); this.restoreDrawerTrigger(); }
  openNode(id: string) { this.rememberDrawerTrigger(); this.country.set(null); this.node.set(id); this.focusDrawer(id); void this.router.navigateByUrl(this.urlFor(this.applied(), undefined, id)); }
  closeNode() { this.node.set(null); this.focusedDrawer = null; void this.router.navigateByUrl(this.urlFor(this.applied())); this.restoreDrawerTrigger(); }
  openContinent(id: string) { const next = { ...this.applied(), region: id }; this.clearPause(); this.country.set(null); this.node.set(null); this.draft.update(current => ({ ...current, region: id })); this.applied.set(next); void this.router.navigateByUrl(this.urlFor(next)); void this.load(); }
  apply() {
    try { const next = queryFromDraft(this.draft()); this.clearPause(); if (next.tenantId !== this.applied().tenantId) this.data.set(null); this.filterError.set(''); this.error.set(''); this.country.set(null); this.node.set(null); this.applied.set(next); void this.router.navigateByUrl(this.urlFor(next)); this.filterOpen.set(false); void this.load(); }
    catch (cause) { this.filterError.set((cause as Error).message); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[aria-label="${this.invalidStart() ? '开始时间' : '结束时间'}"]`)?.focus()); }
  }
  reset() {
    const nextDraft = defaultDraft();
    if (this.role() !== 'platformAdmin') nextDraft.tenantId = 'ten_202609_001';
    this.draft.set(nextDraft);
    this.filterError.set('');
    const next = queryFromDraft(nextDraft); this.clearPause(); if (next.tenantId !== this.applied().tenantId) this.data.set(null); this.country.set(null); this.node.set(null); this.applied.set(next); void this.router.navigateByUrl(this.urlFor(next)); this.filterOpen.set(false); void this.load();
  }
}
