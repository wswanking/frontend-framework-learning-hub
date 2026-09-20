import { Component, HostListener, OnDestroy, computed, effect, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import type { Context, Role, Scenario } from './dashboard';
import { tenantOptions, productOptions } from './catalog';
import { devices, type Command, type Device, type DeviceImportPreview, type DeviceInput, type DeviceListQuery, type DeviceShadow, type DeviceStatus, type TelemetryPoint } from './devices';
import { parseDeviceCsv } from './device-import';
import { utcMinuteToIso } from './device-filter-time';
import { defaultCustomFrom, defaultCustomTo, telemetryWindow } from './telemetry-range';
import type { ThingModelItem } from './products';
import { rules, type RuleExecution } from './rules';
import { deviceEvents, type DeviceAlarm, type DeviceMessage } from './device-events';
import { ota, type OtaExecution, type OtaTaskStatus } from './ota';
import { tenants } from './tenants';

type Tab = 'overview' | 'realtime' | 'shadow' | 'telemetry' | 'messages' | 'alarms' | 'location' | 'rules' | 'ota' | 'commands';
type TelemetryView = { points: TelemetryPoint[]; metrics: { id: string; unit: string }[]; missing: { from: string; to: string }[]; noData: boolean; updatedAt: string };
const baseQuery = (): DeviceListQuery => ({ tenantId: new URLSearchParams(location.search).get('tenant') || localStorage.getItem('iot-atlas-current-tenant-v1') || 'all', seed: 42, page: 1, pageSize: 10, sortBy: 'lastActiveAt', sortDirection: 'desc' });

@Component({ selector: 'app-devices', standalone: true, imports: [MatButtonModule, MatCardModule], templateUrl: './devices.component.html', styleUrls: ['./dashboard.css', './products.css', './devices.css'] })
export class DevicesComponent implements OnDestroy {
  readonly encodeURIComponent = encodeURIComponent;
  readonly statuses: Record<DeviceStatus, string> = { unactivated: '未激活', online: '在线', offline: '离线', fault: '故障', maintenance: '维护' };
  readonly statusEntries = Object.entries(this.statuses).map(([id, name]) => ({ id, name }));
  readonly regions: Record<string, string> = { AS: '亚洲', EU: '欧洲', NA: '北美洲', SA: '南美洲', AF: '非洲', OC: '大洋洲' };
  readonly regionEntries = Object.entries(this.regions).map(([id, name]) => ({ id, name }));
  readonly tenantChoices = tenantOptions();
  readonly publishedProducts = productOptions().filter(item => item.status === 'published');
  readonly productNames: Record<string, string> = Object.fromEntries(this.publishedProducts.map(item => [item.id, item.name]));
  firstProduct(tenantId: string) { return this.publishedProducts.find(item => item.tenantId === tenantId)?.id ?? ''; }
  readonly products = Object.entries(this.productNames).map(([id, name]) => ({ id, name }));
  readonly tabs: { id: Tab; name: string }[] = [
    { id: 'overview', name: '概览' }, { id: 'realtime', name: '实时属性' }, { id: 'shadow', name: '设备影子' }, { id: 'telemetry', name: '时序数据' },
    { id: 'messages', name: '消息' }, { id: 'alarms', name: '告警' }, { id: 'location', name: '位置' },
    { id: 'rules', name: '规则执行' }, { id: 'ota', name: 'OTA 历史' }, { id: 'commands', name: '命令记录' },
  ];
  readonly nav = ['实验室'];
  readonly role = signal<Role>('platformAdmin');
  readonly scenario = signal<Scenario>('normal');
  readonly themeChoice = signal(localStorage.getItem('iot-atlas-theme') || 'dark');
  readonly systemDark = signal(matchMedia('(prefers-color-scheme: dark)').matches);
  readonly dark = computed(() => this.themeChoice() === 'dark' || (this.themeChoice() === 'system' && this.systemDark()));
  readonly draft = signal<DeviceListQuery>(baseQuery());
  readonly query = signal<DeviceListQuery>(baseQuery());
  readonly rows = signal<Device[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly selected = signal<string | null>(null);
  readonly detail = signal<Device | null>(null);
  readonly tab = signal<Tab>('overview');
  readonly selectedRows = signal<string[]>([]);
  readonly showRegion = signal(true);
  readonly showLastActive = signal(true);
  readonly message = signal('');
  readonly creating = signal(false); readonly createError = signal(''); readonly capacityNote = signal('');
  private capacityRequest = 0;
  readonly createInput = signal<DeviceInput>({ tenantId: 'ten_202609_001', productId: 'prod_as_001', name: '', region: 'AS', countryCode: 'CN', location: null, tags: [] });
  readonly importing = signal(false); readonly importTenant = signal('ten_202609_001'); readonly importProduct = signal('prod_as_001');
  readonly importRows = signal<DeviceInput[]>([]); readonly importPreview = signal<DeviceImportPreview | null>(null); readonly importError = signal('');
  readonly deletePending = signal<string[]>([]); readonly deleteError = signal('');
  readonly entryDialogOpen = computed(() => this.creating() || this.importing() || this.deletePending().length > 0);
  readonly nameDraft = signal('');
  readonly tagsDraft = signal('');
  readonly metrics = signal<string[]>([]);
  readonly range = signal(1);
  readonly customFrom = signal(defaultCustomFrom);
  readonly customTo = signal(defaultCustomTo);
  readonly granularity = signal<'minute' | 'hour' | 'day'>('hour');
  readonly zoom = signal(false);
  readonly live = signal(false);
  readonly telemetry = signal<TelemetryView | null>(null);
  readonly telemetryError = signal('');
  readonly capabilities = signal<ThingModelItem[]>([]);
  readonly commandItem = signal('');
  readonly commandValue = signal('');
  readonly commandPreview = signal(false);
  readonly commandError = signal('');
  readonly history = signal<Command[]>([]);
  readonly ruleLogs = signal<RuleExecution[]>([]);
  readonly ruleLogError = signal('');
  readonly rawMessages = signal<DeviceMessage[]>([]);
  readonly alarms = signal<DeviceAlarm[]>([]);
  readonly eventError = signal('');
  readonly otaHistory = signal<{ taskId: string; taskStatus: OtaTaskStatus; execution: OtaExecution }[]>([]);
  readonly otaError = signal('');
  readonly shadow = signal<DeviceShadow | null>(null);
  readonly shadowError = signal('');
  readonly chosenCapability = computed(() => this.capabilities().find(item => item.id === this.commandItem()));
  readonly visiblePoints = computed(() => this.telemetry()?.points ?? []);
  focusTelemetryRange() { document.querySelector<HTMLSelectElement>('select[aria-label="时序范围"]')?.focus(); }
  readonly chips = computed(() => Object.entries({ 产品: this.query().productId ? this.productNames[this.query().productId!] : '', 状态: this.query().status ? this.statuses[this.query().status!] : '', 地域: this.query().region ? this.regions[this.query().region!] : '', 标签: this.query().tag ?? '', 最后活跃: this.query().lastActiveFrom?.slice(0, 16) ?? '', 关键词: this.query().keyword ?? '' }).filter(([, value]) => value).map(([key, value]) => ({ key, value })));
  private media = matchMedia('(prefers-color-scheme: dark)');
  private updateSystem = () => { this.systemDark.set(this.media.matches); if (this.themeChoice() === 'system') document.documentElement.dataset['theme'] = this.media.matches ? 'dark' : 'light'; };
  private listRequest = 0;
  private detailRequest = 0;
  private telemetryRequest = 0;
  private commandTimer?: ReturnType<typeof setInterval>;
  private shadowTimer?: ReturnType<typeof setInterval>;
  private stopLive?: () => void;
  private previewTrigger: HTMLElement | null = null;
  private previewFrame = 0;
  private previewWasOpen = false;
  private previewOverflow = '';
  private entryTrigger: HTMLElement | null = null;
  private entryFrame = 0;
  private entryWasOpen = false;
  private entryOverflow = '';
  constructor() {
    this.media.addEventListener('change', this.updateSystem); this.setTheme(this.themeChoice()); void this.loadList(); const id = new URLSearchParams(location.search).get('device'); if (id) void this.open(id);
    effect(() => {
      const open = this.commandPreview();
      if (open && !this.previewWasOpen) { this.previewTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null; this.previewOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden'; }
      if (open) this.previewFrame = requestAnimationFrame(() => document.querySelector<HTMLElement>('.device-control-sheet[role="dialog"]')?.focus());
      else if (this.previewWasOpen) { document.documentElement.style.overflow = this.previewOverflow; const trigger = this.previewTrigger; this.previewFrame = requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus(); else document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus(); }); this.previewTrigger = null; }
      this.previewWasOpen = open;
    });
    effect(() => {
      const open = this.entryDialogOpen();
      if (open && !this.entryWasOpen) { this.entryTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null; this.entryOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden'; }
      if (open) this.entryFrame = requestAnimationFrame(() => document.querySelector<HTMLElement>('.device-entry-dialog[role="dialog"]')?.focus());
      else if (this.entryWasOpen) { document.documentElement.style.overflow = this.entryOverflow; const trigger = this.entryTrigger; this.entryFrame = requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus(); }); this.entryTrigger = null; }
      this.entryWasOpen = open;
    });
  }
  ngOnDestroy() { this.media.removeEventListener('change', this.updateSystem); this.stopTimers(); cancelAnimationFrame(this.previewFrame); cancelAnimationFrame(this.entryFrame); if (this.previewWasOpen) document.documentElement.style.overflow = this.previewOverflow; if (this.entryWasOpen) document.documentElement.style.overflow = this.entryOverflow; }
  @HostListener('window:keydown', ['$event']) onCommandKeydown(event: KeyboardEvent) {
    if (this.entryDialogOpen()) {
      const entry = document.querySelector<HTMLElement>('.device-entry-dialog[role="dialog"]');
      if (!entry) return;
      if (event.key === 'Escape') { event.preventDefault(); this.creating.set(false); this.importing.set(false); this.deletePending.set([]); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(entry.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])'));
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === entry)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === entry)) { event.preventDefault(); first.focus(); }
      return;
    }
    if (!this.commandPreview()) return;
    const dialog = document.querySelector<HTMLElement>('.device-control-sheet[role="dialog"]');
    if (!dialog) return;
    if (event.key === 'Escape') { event.preventDefault(); this.commandPreview.set(false); return; }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])'));
    if (!buttons.length) return;
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
  }
  private stopTimers() { if (this.commandTimer) clearInterval(this.commandTimer); if (this.shadowTimer) clearInterval(this.shadowTimer); this.stopLive?.(); this.stopLive = undefined; }
  private context(): Context { return { actorId: 'usr_202609_001', role: this.role(), tenantId: this.role() === 'platformAdmin' ? 'all' : 'ten_202609_001', seed: 42, scenario: this.scenario() }; }
  setTheme(value: string) { this.themeChoice.set(value); document.documentElement.dataset['theme'] = value === 'dark' || (value === 'system' && this.systemDark()) ? 'dark' : 'light'; localStorage.setItem('iot-atlas-theme', value); }
  setRole(value: Role) { this.role.set(value); const tenantId = value === 'platformAdmin' ? 'all' : 'ten_202609_001'; this.draft.update(current => ({ ...current, tenantId, page: 1 })); this.query.update(current => ({ ...current, tenantId, page: 1 })); this.close(); void this.loadList(); }
  setScenario(value: Scenario) { this.scenario.set(value); void this.loadList(); if (this.selected()) void this.open(this.selected()!); }
  setDraft(key: keyof DeviceListQuery, value: unknown) { this.draft.update(current => ({ ...current, [key]: value })); }
  async loadList() { const request = ++this.listRequest; this.loading.set(true); const result = await devices.list(this.context(), this.query()); if (request !== this.listRequest) return; if ('error' in result) { this.message.set(result.error.message); this.rows.set([]); this.total.set(0); } else { this.rows.set(result.data.items); this.total.set(result.data.total); this.message.set(''); } this.loading.set(false); }
  async open(id: string) { this.stopTimers(); const request = ++this.detailRequest; this.selected.set(id); const [result, writable] = await Promise.all([devices.get(this.context(), id), devices.writableItems(this.context(), id)]); if (request !== this.detailRequest) return; if ('error' in result) { this.message.set(result.error.message); this.detail.set(null); return; } this.detail.set(result.data); this.nameDraft.set(result.data.name); this.tagsDraft.set(result.data.tags.join(',')); this.metrics.set(Object.keys(result.data.attributes).slice(0, 2)); this.tab.set('overview'); if ('data' in writable) { this.capabilities.set(writable.data); this.commandItem.set(writable.data[0]?.id ?? ''); } }
  close() { this.detailRequest++; this.selected.set(null); this.detail.set(null); this.live.set(false); this.commandPreview.set(false); this.stopTimers(); }
  apply() { this.query.set({ ...this.draft(), page: 1 }); this.selectedRows.set([]); void this.loadList(); }
  reset() { const next = { ...baseQuery(), tenantId: this.role() === 'platformAdmin' ? baseQuery().tenantId : 'ten_202609_001' }; this.draft.set(next); this.query.set(next); this.selectedRows.set([]); void this.loadList(); }
  removeChip(key: string) { const field = ({ 产品: 'productId', 状态: 'status', 地域: 'region', 标签: 'tag', 最后活跃: 'lastActiveFrom', 关键词: 'keyword' } as Record<string, keyof DeviceListQuery>)[key]; const next = { ...this.query(), [field]: undefined, page: 1 }; this.query.set(next); this.draft.set(next); void this.loadList(); }
  sort(by: DeviceListQuery['sortBy']) { this.query.update(current => ({ ...current, sortBy: by, sortDirection: current.sortBy === by && current.sortDirection === 'asc' ? 'desc' : 'asc' })); void this.loadList(); }
  setPageSize(value: number) { this.query.update(current => ({ ...current, page: 1, pageSize: value })); this.draft.set(this.query()); void this.loadList(); }
  changePage(delta: number) { this.query.update(current => ({ ...current, page: current.page + delta })); void this.loadList(); }
  maxPage() { return Math.max(1, Math.ceil(this.total() / this.query().pageSize)); }
  everySelected() { return this.rows().every(item => this.selectedRows().includes(item.id)); }
  date(value: string) { return new Date(value).toLocaleString('zh-CN'); }
  utcMinuteToIso(value: string) { return utcMinuteToIso(value); }
  attributeEntries() { return Object.entries(this.detail()?.attributes ?? {}); }
  metricIds() { return Object.keys(this.detail()?.attributes ?? {}); }
  messageJson() { const detail = this.detail(); return detail ? JSON.stringify({ deviceId: detail.id, properties: detail.attributes }, null, 2) : ''; }
  messagePayload(item: DeviceMessage) { return JSON.stringify(item.payload, null, 2); }
  selectPage(checked: boolean) { this.selectedRows.set(checked ? [...new Set([...this.selectedRows(), ...this.rows().map(item => item.id)])] : this.selectedRows().filter(id => !this.rows().some(item => item.id === id))); }
  selectRow(id: string, checked: boolean) { this.selectedRows.set(checked ? [...this.selectedRows(), id] : this.selectedRows().filter(item => item !== id)); }
  private download(name: string, content: string) { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' })); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); }
  private cell(value: unknown) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
  async exportRows() { const results = await Promise.all(this.selectedRows().map(id => devices.get(this.context(), id))); const failure = results.find(result => 'error' in result); if (failure && 'error' in failure) { this.message.set(`设备导出失败：${failure.error.message}`); return; } const selectedDevices = results.flatMap(result => 'data' in result ? [result.data] : []); this.download('devices.csv', ['id,name,status,product,region', ...selectedDevices.map(item => [item.id, item.name, item.status, item.productId, item.region].map(value => this.cell(value)).join(','))].join('\n')); }
  exportTelemetry() { const view = this.telemetry(); if (view) this.download('telemetry.csv', ['timestamp,metric,value,unit,quality', ...view.points.map(point => [point.timestamp, point.metric, point.value, point.unit, point.quality].map(value => this.cell(value)).join(','))].join('\n')); }
  async saveMetadata() { const detail = this.detail(); if (!detail) return; const result = await devices.updateMetadata(this.context(), detail.id, { name: this.nameDraft(), tags: this.tagsDraft().split(',').map(value => value.trim()).filter(Boolean) }, detail.version); if ('error' in result) this.message.set(result.error.message); else { this.detail.set(result.data); this.message.set('设备信息已保存'); void this.loadList(); } }
  async loadDeviceCapacity(tenantId: string) { const request = ++this.capacityRequest; this.capacityNote.set('正在查询设备配额…'); const result = await tenants.checkCapacity(this.context(), tenantId, 'devices'); if (request !== this.capacityRequest) return; this.capacityNote.set('error' in result ? result.error.message : `设备配额已用 ${result.data.used}/${result.data.limit}${(result.data.used + 1) / result.data.limit * 100 >= result.data.warningAt ? `；登记后达到 ${result.data.warningAt}% 预警阈值` : ''}`); }
  newDevice() { const tenantId = this.query().tenantId === 'all' ? 'ten_202609_001' : this.query().tenantId; this.createInput.set({ tenantId, productId: this.firstProduct(tenantId), name: '', region: 'AS', countryCode: tenantId === 'ten_202609_002' ? 'JP' : 'CN', location: null, tags: [] }); this.createError.set(''); this.creating.set(true); void this.loadDeviceCapacity(tenantId); }
  setCreate(key: keyof DeviceInput, value: unknown) { this.createInput.update(current => ({ ...current, [key]: value })); }
  setCreateTenant(tenantId: string) { this.createInput.update(current => ({ ...current, tenantId, productId: this.firstProduct(tenantId) })); void this.loadDeviceCapacity(tenantId); }
  createProducts() { return this.publishedProducts.filter(item => item.tenantId === this.createInput().tenantId); }
  setCreateTags(value: string) { this.setCreate('tags', value.split(',').map(item => item.trim()).filter(Boolean)); }
  async createDevice() { const result = await devices.create(this.context(), this.createInput()); if ('error' in result) { this.createError.set(result.error.message); return; } this.creating.set(false); this.message.set(`设备 ${result.data.id} 已登记为未激活`); await this.loadList(); await this.open(result.data.id); }
  openImport() { const tenantId = this.query().tenantId === 'all' ? 'ten_202609_001' : this.query().tenantId; this.importTenant.set(tenantId); this.importProduct.set(this.firstProduct(tenantId)); this.importRows.set([]); this.importPreview.set(null); this.importError.set(''); this.importing.set(true); }
  setImportTenant(tenantId: string) { this.importTenant.set(tenantId); this.importProduct.set(this.firstProduct(tenantId)); this.importRows.set([]); this.importPreview.set(null); }
  setImportProduct(productId: string) { this.importProduct.set(productId); this.importRows.set([]); this.importPreview.set(null); }
  importProducts() { return this.publishedProducts.filter(item => item.tenantId === this.importTenant()); }
  async readImport(file?: File) { this.importRows.set([]); this.importPreview.set(null); this.importError.set(''); if (!file) return; try { const parsed = parseDeviceCsv(await file.text(), this.importTenant(), this.importProduct()); if ('error' in parsed) { this.importError.set(parsed.error); return; } const result = await devices.previewImport(this.context(), parsed.rows); if ('error' in result) { this.importError.set(result.error.message); return; } this.importRows.set(parsed.rows); this.importPreview.set(result.data); } catch { this.importError.set('CSV 文件读取失败'); } }
  async commitImport() { const result = await devices.importBatch(this.context(), this.importRows(), true); if ('error' in result) { this.importError.set(result.error.message); this.importPreview.set(null); return; } this.importing.set(false); this.selectedRows.set([]); this.message.set(`已导入 ${result.data.length} 台未激活设备`); await this.loadList(); }
  async confirmDelete() { const result = await devices.deleteBatch(this.context(), this.deletePending(), true); if ('error' in result) { this.deleteError.set(result.error.message); return; } this.deletePending.set([]); this.selectedRows.set([]); if (this.detail() && result.data.deleted.includes(this.detail()!.id)) this.close(); this.message.set(`已删除 ${result.data.deleted.length} 台设备；历史记录保留`); await this.loadList(); }
  chooseTab(value: Tab) { this.tab.set(value); if (this.commandTimer) clearInterval(this.commandTimer); if (this.shadowTimer) clearInterval(this.shadowTimer); if (value === 'realtime') void this.refreshRealtime(); if (value === 'telemetry') void this.loadTelemetry(); if (value === 'commands') { void this.loadCommands(); this.commandTimer = setInterval(() => void this.loadCommands(), 700); } if (value === 'shadow') { void this.loadShadow(); this.shadowTimer = setInterval(() => void this.loadShadow(), 700); } if (value === 'rules') void this.loadRuleLogs(); if (value === 'messages' || value === 'alarms') void this.loadDeviceEvents(); if (value === 'ota') void this.loadOtaHistory(); this.updateLive(); }
  async refreshRealtime() { const id = this.selected(); if (!id) return; const result = await devices.get(this.context(), id); if (this.selected() === id && this.tab() === 'realtime' && 'data' in result) this.detail.set(result.data); }
  async loadDeviceEvents() { const detail = this.detail(), tab = this.tab(); if (!detail || (tab !== 'messages' && tab !== 'alarms')) return; const result = tab === 'messages' ? await deviceEvents.listMessages(this.context(), detail.id) : await deviceEvents.listAlarms(this.context(), detail.id); if (this.detail()?.id !== detail.id || this.tab() !== tab) return; if ('error' in result) { this.eventError.set(result.error.message); if (tab === 'messages') this.rawMessages.set([]); else this.alarms.set([]); } else { this.eventError.set(''); if (tab === 'messages') this.rawMessages.set(result.data as DeviceMessage[]); else this.alarms.set(result.data as DeviceAlarm[]); } }
  async acknowledgeAlarm(id: string) { const detail = this.detail(); if (!detail) return; const result = await deviceEvents.acknowledge(this.context(), detail.id, id); if ('error' in result) this.eventError.set(result.error.message); else { this.eventError.set(''); this.alarms.update(current => current.map(item => item.id === id ? result.data : item)); } }
  async loadRuleLogs() { const detail = this.detail(); if (!detail || this.tab() !== 'rules') return; const result = await rules.logsFor(this.context(), { tenantId: detail.tenantId, deviceId: detail.id, page: 1, pageSize: 20, seed: 42 }); if ('error' in result) { this.ruleLogError.set(result.error.message); this.ruleLogs.set([]); } else { this.ruleLogError.set(''); this.ruleLogs.set(result.data.items); } }
  async loadOtaHistory() { const detail = this.detail(); if (!detail || this.tab() !== 'ota') return; const result = await ota.historyForDevice(this.context(), detail.id); if ('error' in result) { this.otaError.set(result.error.message); this.otaHistory.set([]); } else { this.otaError.set(''); this.otaHistory.set(result.data); } }
  chooseMetric(id: string, checked: boolean) { this.metrics.set(checked ? [...this.metrics(), id] : this.metrics().filter(item => item !== id)); void this.loadTelemetry(); this.updateLive(); }
  setRange(value: number) { this.range.set(value); void this.loadTelemetry(); }
  setCustomFrom(value: string) { this.customFrom.set(value); void this.loadTelemetry(); }
  setCustomTo(value: string) { this.customTo.set(value); void this.loadTelemetry(); }
  setGranularity(value: 'minute' | 'hour' | 'day') { this.granularity.set(value); void this.loadTelemetry(); this.updateLive(); }
  setLive(value: boolean) { this.live.set(value); this.updateLive(); }
  private updateLive() {
    this.stopLive?.(); this.stopLive = undefined;
    const detail = this.detail();
    if (!this.live() || this.tab() !== 'telemetry' || !detail || !this.metrics().length) return;
    this.stopLive = devices.subscribeTelemetry(this.context(), detail.id, this.metrics(), this.granularity(), event => {
      if ('error' in event) { this.telemetryError.set(event.error.message); return; }
      void deviceEvents.recordTelemetry(this.context(), detail.id, event.data).then(result => { if ('error' in result) this.telemetryError.set(`原始消息未保存：${result.error.message}`); });
      void devices.applyTelemetry(this.context(), detail.id, event.data);
      const current = this.telemetry();
      if (!current) return;
      this.telemetry.set({ ...current, points: [...current.points, ...event.data], noData: current.noData && event.data.every(point => point.value === null),
        missing: event.data[0]?.value === null ? [...current.missing, { from: event.data[0].timestamp, to: event.data[0].timestamp }] : current.missing,
        updatedAt: event.data[0]?.timestamp ?? current.updatedAt });
    });
  }
  async loadTelemetry() { const detail = this.detail(); if (!detail || this.tab() !== 'telemetry' || !this.metrics().length) return; const request = ++this.telemetryRequest; const window = telemetryWindow(this.range(), this.customFrom(), this.customTo()); if (!window.ok) { this.telemetryError.set(window.error); this.telemetry.set(null); return; } const from = this.zoom() ? new Date((Date.parse(window.from) + Date.parse(window.to)) / 2).toISOString() : window.from; this.telemetry.set(null); const result = await devices.queryTelemetry(this.context(), { deviceId: detail.id, from, to: window.to, metrics: this.metrics(), granularity: this.granularity(), seed: 42 }); if (request !== this.telemetryRequest) return; if ('error' in result) { this.telemetryError.set(result.error.message); this.telemetry.set(null); } else { this.telemetryError.set(''); this.telemetry.set(result.data); } }
  toggleZoom() { this.zoom.set(!this.zoom()); void this.loadTelemetry(); }
  chartPoints(metric: string) { return this.visiblePoints().filter(point => point.metric === metric); }
  chartSegments(metric: string) { const points = this.chartPoints(metric); const values = points.filter(point => point.value !== null).map(point => point.value as number); if (!values.length) return []; const min = Math.min(...values), max = Math.max(...values), spread = Math.max(1, max - min); const segments: string[] = []; let path = ''; points.forEach((point, index) => { if (point.value === null) { if (path) segments.push(path); path = ''; } else path += `${path ? ' L' : 'M'} ${(32 + index * 648 / Math.max(1, points.length - 1)).toFixed(1)} ${(150 - (point.value - min) / spread * 116).toFixed(1)}`; }); if (path) segments.push(path); return segments; }
  chartDots(metric: string) { const points = this.chartPoints(metric); const values = points.filter(point => point.value !== null).map(point => point.value as number); if (!values.length) return []; const min = Math.min(...values), spread = Math.max(1, Math.max(...values) - min); return points.flatMap((point, index) => point.value === null ? [] : [{ timestamp: point.timestamp, x: 32 + index * 648 / Math.max(1, points.length - 1), y: 150 - (point.value - min) / spread * 116, label: `${point.timestamp}：${point.value} ${point.unit}` }]); }
  setCommandItem(value: string) { this.commandItem.set(value); this.commandValue.set(''); this.commandPreview.set(false); }
  parsedCommandValue(): string | number | boolean { const item = this.chosenCapability(); return item?.dataType === 'int' || item?.dataType === 'float' ? Number(this.commandValue()) : item?.dataType === 'bool' ? this.commandValue() === 'true' : this.commandValue(); }
  async submitCommand() { const detail = this.detail(), item = this.chosenCapability(); if (!detail || !item) return; const result = await devices.executeCommand(this.context(), detail.id, item.id, this.parsedCommandValue()); if ('error' in result) { this.commandError.set(result.error.message + (result.error.fieldErrors?.value ? `：${result.error.fieldErrors.value}` : '')); return; } this.commandError.set(''); this.commandPreview.set(false); this.history.update(current => [result.data, ...current]); this.chooseTab('commands'); }
  async loadCommands() { const detail = this.detail(); if (!detail || this.tab() !== 'commands') return; const result = await devices.commandHistory(this.context(), detail.id); if ('data' in result) this.history.set(result.data); }
  async loadShadow() { const detail = this.detail(); if (!detail || this.tab() !== 'shadow') return; const result = await devices.getShadow(this.context(), detail.id); if (this.detail()?.id !== detail.id || this.tab() !== 'shadow') return; if ('error' in result) { this.shadowError.set(result.error.message); this.shadow.set(null); } else { this.shadowError.set(''); this.shadow.set(result.data); } }
}
