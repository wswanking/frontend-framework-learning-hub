import { RouterLink, Router as LinkRouter } from '@angular/router';
import { inject as linkInject } from '@angular/core';
import { Component, OnDestroy, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { GeoChartComponent } from './geo-chart.component';
import { getTopology, geoNames, type DeviceStatus, type GeoData, type GeoItem, type GeoLevel, type GeoQuery } from './geography';
import { geoListPage, type GeoDirection, type GeoSort } from './geo-list';
import { geoLegendOptions } from './geo-status';
import type { Context, Role, Scenario } from './dashboard';

type Filters = { tenantId: string; productId: string; status: string; continent: string; countryCode: string; nodeId: string; range: string; from: string; to: string };
type Crumb = { level: GeoLevel; id: string; name: string };
function initialFilters(): Filters { return { tenantId: localStorage.getItem('iot-atlas-current-tenant-v1') || 'all', productId: '', status: '', continent: '', countryCode: '', nodeId: '', range: '24h', from: '', to: '' }; }
function initialLocation(): { filters: Filters; crumbs: Crumb[] } {
  const params = new URLSearchParams(location.search), filters = initialFilters();
  const from = params.get('from'), to = params.get('to');
  if (from && to && Number.isFinite(Date.parse(from)) && Number.isFinite(Date.parse(to)) && Date.parse(from) < Date.parse(to) && Date.parse(to) - Date.parse(from) <= 30 * 86_400_000) { filters.from = from; filters.to = to; filters.range = 'custom'; }
  filters.tenantId = params.get('tenant') || filters.tenantId;
  const continent = params.get('continent') || params.get('region') || '', country = params.get('country') || '', node = params.get('node') || '';
  const countryContinent: Record<string, string> = { CN: 'AS', JP: 'AS', DE: 'EU', FR: 'EU', US: 'NA', CA: 'NA', BR: 'SA', AR: 'SA', ZA: 'AF', EG: 'AF', AU: 'OC', NZ: 'OC' };
  const countryCode = country || /^node_([a-z]{2})_(?:\d{3}|local)$/.exec(node)?.[1]?.toUpperCase() || '';
  const continentCode = continent || countryContinent[countryCode] || '';
  const crumbs: Crumb[] = [];
  if (continentCode && geoNames.continents[continentCode]) crumbs.push({ level: 'continent', id: continentCode, name: geoNames.continents[continentCode] });
  if (countryCode && geoNames.countries[countryCode] && countryContinent[countryCode] === continentCode) crumbs.push({ level: 'country', id: countryCode, name: geoNames.countries[countryCode] });
  if (node && crumbs.at(-1)?.level === 'country' && node.includes(`_${countryCode.toLowerCase()}_`)) crumbs.push({ level: 'node', id: node, name: `${geoNames.countries[countryCode]}节点` });
  return { filters, crumbs };
}
function queryFor(filters: Filters, crumbs: Crumb[]): GeoQuery { const to = filters.range === 'custom' ? new Date(filters.to) : new Date(), from = filters.range === 'custom' ? new Date(filters.from) : new Date(to.getTime() - ({ '24h': 1, '7d': 7, '30d': 30 }[filters.range] ?? 1) * 86_400_000); const parent = crumbs.at(-1); return { tenantId: filters.tenantId, productId: filters.productId || undefined, status: filters.status as DeviceStatus || undefined, continent: filters.continent || undefined, countryCode: filters.countryCode || undefined, nodeId: filters.nodeId || undefined, from: from.toISOString(), to: to.toISOString(), seed: 42, level: parent?.level ?? 'global', parentId: parent?.id }; }
@Component({ selector: 'app-geography', standalone: true, imports: [RouterLink, MatButtonModule, MatCardModule, GeoChartComponent], templateUrl: './geography.component.html', styleUrls: ['./dashboard.css', './geography.css'] })
export class GeographyComponent implements OnDestroy {
  private readonly linkRouter = linkInject(LinkRouter);
  routeUrl(url: string) { return this.linkRouter.parseUrl(url); }

  private readonly initial = initialLocation();
  readonly encodeURIComponent = encodeURIComponent;
  readonly tenants = Object.entries({ all: '全部租户', ten_202609_001: '华东智联', ten_202609_002: '全球能源' }).map(([id, name]) => ({ id, name }));
  readonly products = Object.entries({ '': '全部产品', prod_as_001: '工业传感器', prod_as_002: '能源网关' }).map(([id, name]) => ({ id, name }));
  readonly statuses: Record<string, string> = { '': '全部状态', unactivated: '未激活', online: '在线', offline: '离线', fault: '故障', maintenance: '维护', alarm: '告警' };
  readonly statusOptions = Object.entries(this.statuses).map(([id, name]) => ({ id, name }));
  readonly geoLegendOptions = geoLegendOptions;
  readonly continents = Object.entries(geoNames.continents).map(([id, name]) => ({ id, name }));
  readonly countries = geoNames.countries;
  readonly countryOptions = Object.entries(geoNames.countries).map(([id, name]) => ({ id, name }));
  readonly nodes = Object.entries(geoNames.countries).map(([id, name]) => ({ id: `node_${id.toLowerCase()}_001`, name: `${name}节点` }));
  readonly draft = signal<Filters>(this.initial.filters);
  readonly applied = signal<Filters>(this.initial.filters);
  readonly crumbs = signal<Crumb[]>(this.initial.crumbs);
  readonly role = signal<Role>('platformAdmin');
  readonly scenario = signal<Scenario>('normal');
  readonly themeChoice = signal(localStorage.getItem('iot-atlas-theme') || 'dark');
  readonly systemDark = signal(matchMedia('(prefers-color-scheme: dark)').matches);
  readonly dark = computed(() => this.themeChoice() === 'dark' || (this.themeChoice() === 'system' && this.systemDark()));
  readonly data = signal<GeoData | null>(null);
  readonly error = signal('');
  readonly retryable = signal(false);
  readonly filterError = signal('');
  readonly loading = signal(true);
  readonly stale = signal(false);
  readonly view = signal<'map' | 'list'>('map');
  readonly visibleView = computed(() => this.data()?.mapAvailable ? this.view() : 'list');
  readonly selected = signal<GeoItem | null>(null);
  readonly listSort = signal<GeoSort>('devices');
  readonly listDirection = signal<GeoDirection>('desc');
  readonly listPage = signal(1);
  readonly list = computed(() => geoListPage(this.data()?.items ?? [], this.listSort(), this.listDirection(), this.listPage()));
  private request = 0;
  private detailTrigger: HTMLElement | SVGElement | null = null;
  private readonly onDetailEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && this.selected()) { event.preventDefault(); this.closeDetail(); } };
  private media = matchMedia('(prefers-color-scheme: dark)');
  private readonly updateSystem = () => { this.systemDark.set(this.media.matches); if (this.themeChoice() === 'system') document.documentElement.dataset['theme'] = this.media.matches ? 'dark' : 'light'; };
  constructor() { this.media.addEventListener('change', this.updateSystem); window.addEventListener('keydown', this.onDetailEscape); this.setTheme(this.themeChoice()); void this.load(); }
  ngOnDestroy() { this.media.removeEventListener('change', this.updateSystem); window.removeEventListener('keydown', this.onDetailEscape); }
  number(value: number) { return new Intl.NumberFormat('zh-CN').format(value); }
  localInput(iso: string) { if (!iso) return ''; const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
  setDraftTime(key: 'from' | 'to', value: string) { this.setDraft(key, value ? new Date(value).toISOString() : ''); }
  setTheme(value: string) { this.themeChoice.set(value); document.documentElement.dataset['theme'] = value === 'dark' || (value === 'system' && this.systemDark()) ? 'dark' : 'light'; localStorage.setItem('iot-atlas-theme', value); }
  setRole(value: Role) { this.data.set(null); this.selected.set(null); this.stale.set(false); this.role.set(value); void this.load(); }
  setScenario(value: Scenario) { if (value === 'forbidden') { this.data.set(null); this.selected.set(null); this.stale.set(false); } this.scenario.set(value); void this.load(); }
  setDraft(key: keyof Filters, value: string) { this.draft.update(current => ({ ...current, [key]: value })); }
  private async load() { const current = ++this.request; this.loading.set(true); this.error.set(''); const context: Context = { actorId: 'usr_202609_001', role: this.role(), tenantId: this.role() === 'platformAdmin' ? 'all' : 'ten_202609_001', seed: 42, scenario: this.scenario() }; const result = await getTopology(context, queryFor(this.applied(), this.crumbs())); if (current !== this.request) return; if ('error' in result) { this.error.set(result.error.message); this.retryable.set(result.error.retryable === true); if (result.error.code === 'FORBIDDEN') { this.data.set(null); this.selected.set(null); this.stale.set(false); } else this.stale.set(true); } else { this.data.set(result.data); this.stale.set(false); this.retryable.set(false); } this.loading.set(false); }
  retry() { void this.load(); }
  invalidStart() { return !Number.isFinite(Date.parse(this.draft().from)); }
  apply() { const draft = this.draft(); if (draft.range === 'custom' && (!draft.from || !draft.to || !Number.isFinite(Date.parse(draft.from)) || !Number.isFinite(Date.parse(draft.to)) || Date.parse(draft.from) >= Date.parse(draft.to) || Date.parse(draft.to) - Date.parse(draft.from) > 30 * 86_400_000)) { this.filterError.set('请选择有效的 30 天内 UTC 时间范围'); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[aria-label="${this.invalidStart() ? '开始时间' : '结束时间'}"]`)?.focus()); return; } this.filterError.set(''); if (draft.tenantId !== this.applied().tenantId) { this.data.set(null); this.stale.set(false); } this.applied.set({ ...draft }); this.crumbs.set([]); this.selected.set(null); this.listPage.set(1); void this.load(); }
  reset() { const next = initialFilters(); if (this.role() !== 'platformAdmin') next.tenantId = 'ten_202609_001'; this.draft.set(next); this.filterError.set(''); if (next.tenantId !== this.applied().tenantId) { this.data.set(null); this.stale.set(false); } this.applied.set(next); this.crumbs.set([]); this.selected.set(null); this.listPage.set(1); void this.load(); }
  filterLegend(status: string) { const next = { ...this.applied(), status }; this.draft.set(next); this.applied.set(next); this.selected.set(null); this.listPage.set(1); void this.load(); }
  choose(item: GeoItem) { if (item.kind === 'device') { this.selectItem(item); return; } this.selected.set(null); this.listPage.set(1); this.crumbs.update(current => [...current, { level: item.kind as GeoLevel, id: item.id, name: item.name }]); void this.load(); }
  goTo(index: number) { this.crumbs.set(this.crumbs().slice(0, index + 1)); this.selected.set(null); this.listPage.set(1); void this.load(); }
  sortList(key: GeoSort) { if (this.listSort() === key) this.listDirection.set(this.listDirection() === 'asc' ? 'desc' : 'asc'); else { this.listSort.set(key); this.listDirection.set(key === 'name' ? 'asc' : 'desc'); } this.listPage.set(1); }
  selectItem(item: GeoItem) { const active = document.activeElement; this.detailTrigger = active instanceof HTMLElement || active instanceof SVGElement ? active : null; this.selected.set(item); requestAnimationFrame(() => document.querySelector<HTMLElement>('.atlas-geography .country-drawer')?.focus()); }
  closeDetail() { this.selected.set(null); const trigger = this.detailTrigger; this.detailTrigger = null; requestAnimationFrame(() => trigger?.focus()); }
  mapSelect(item: GeoItem) { if (item.kind === 'node' || item.kind === 'device') this.selectItem(item); else this.choose(item); }
}
