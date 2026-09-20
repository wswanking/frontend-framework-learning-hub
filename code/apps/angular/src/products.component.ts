import { Component, ElementRef, HostListener, OnDestroy, computed, effect, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import type { Context, Role, Scenario } from './dashboard';
import { tenantOptions } from './catalog';
import { downloadProductCsv } from './product-export';
import { products, defaultAccessConfig, modelIdentifierError, type AccessConfig, type Conversion, type DataType, type DpRule, type Product, type ProductInput, type ProductStatus, type ThingModelItem } from './products';
import { parseJsonObject } from './model-json';
import { devices, type Device } from './devices';
import { tenants } from './tenants';

type Tab = 'basic' | 'access' | 'model' | 'dp' | 'devices';
type ListFilters = { tenantId: string; keyword: string; category: string; status: string; page: number; pageSize: number };
function initialList(): ListFilters { return { tenantId: new URLSearchParams(location.search).get('tenant') || localStorage.getItem('iot-atlas-current-tenant-v1') || 'all', keyword: '', category: '', status: '', page: 1, pageSize: 10 }; }
function emptyProduct(tenantId: string): ProductInput { return { tenantId: tenantId === 'all' ? 'ten_202609_001' : tenantId, name: '', productKey: '', category: '工业传感器', protocol: 'MQTT', status: 'draft' }; }
function productInput(product: Product): ProductInput { return { tenantId: product.tenantId, name: product.name, productKey: product.productKey, category: product.category, protocol: product.protocol, status: product.status }; }
function emptyItem(): ThingModelItem { return { id: '', kind: 'property', identifier: '', name: '', dataType: 'float', accessMode: 'read', unit: '', min: 0, max: 100 }; }
function emptyRule(itemId: string): DpRule { return { id: '', itemId, rawType: 'int16', scale: 1, offset: 0, precision: 1, enumMap: [], expression: 'x' }; }

@Component({ selector: 'app-products', standalone: true, imports: [MatButtonModule, MatCardModule], templateUrl: './products.component.html', styleUrls: ['./dashboard.css', './products.css'] })
export class ProductsComponent implements OnDestroy {
  readonly tenantNames: Record<string, string> = { all: '全部租户', ...Object.fromEntries(tenantOptions().map(item => [item.id, item.name])) };
  readonly tenants = Object.entries(this.tenantNames).map(([id, name]) => ({ id, name }));
  readonly statusNames: Record<string, string> = { draft: '草稿', published: '已发布', disabled: '已停用' };
  readonly deviceStatusNames: Record<string, string> = { unactivated: '未激活', online: '在线', offline: '离线', fault: '故障', maintenance: '维护' };
  readonly statuses = Object.entries(this.statusNames).map(([id, name]) => ({ id, name }));
  readonly kinds: Record<string, string> = { property: '属性', event: '事件', service: '服务' };
  readonly accesses = Object.entries({ read: '只读', write: '只写', readWrite: '读写' }).map(([id, name]) => ({ id, name }));
  readonly categories = ['工业传感器', '能源设备', '水务设备', '安防设备'];
  readonly nav = ['实验室'];
  readonly tabs: { id: Tab; name: string }[] = [{ id: 'basic', name: '基础信息' }, { id: 'access', name: '接入配置' }, { id: 'model', name: '物模型' }, { id: 'dp', name: 'DP 规则' }, { id: 'devices', name: '设备' }];
  readonly role = signal<Role>('platformAdmin');
  readonly scenario = signal<Scenario>('normal');
  readonly themeChoice = signal(localStorage.getItem('iot-atlas-theme') || 'dark');
  readonly systemDark = signal(matchMedia('(prefers-color-scheme: dark)').matches);
  readonly dark = computed(() => this.themeChoice() === 'dark' || (this.themeChoice() === 'system' && this.systemDark()));
  readonly canWrite = computed(() => this.role() === 'platformAdmin' || this.role() === 'tenantAdmin');
  readonly draftFilters = signal<ListFilters>(initialList());
  readonly filters = signal<ListFilters>(initialList());
  readonly rows = signal<Product[]>([]);
  readonly selectedProducts = signal<string[]>([]);
  readonly visibleSelected = computed(() => this.rows().filter(product => this.selectedProducts().includes(product.id)));
  toggleProduct(id: string) { this.selectedProducts.update(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); }
  selectPage(checked: boolean) { this.selectedProducts.set(checked ? this.rows().map(product => product.id) : []); }
  exportSelected() { downloadProductCsv(this.visibleSelected()); }
  readonly total = signal(0);
  readonly listLoading = signal(true);
  readonly selectedId = signal<string | null>(null);
  readonly detail = signal<Product | null>(null);
  readonly tab = signal<Tab>('basic');
  readonly devicePage = signal(1);
  readonly deviceRows = signal<Device[]>([]);
  readonly deviceTotal = signal(0);
  readonly deviceLoading = signal(false);
  readonly deviceError = signal('');
  readonly capacityNote = signal('');
  readonly base = signal<ProductInput>(emptyProduct('all'));
  readonly access = signal<AccessConfig>(defaultAccessConfig('MQTT'));
  readonly model = signal<ThingModelItem>(emptyItem());
  readonly modelOriginal = signal<ThingModelItem>(emptyItem());
  readonly jsonMode = signal(false);
  readonly jsonText = signal(JSON.stringify(emptyItem(), null, 2));
  readonly modelJsonInput = viewChild<ElementRef<HTMLTextAreaElement>>('modelJsonInput');
  readonly rule = signal<DpRule>(emptyRule(''));
  readonly ruleOriginal = signal<DpRule>(emptyRule(''));
  readonly enumText = signal('[]');
  readonly raw = signal('850');
  readonly conversion = signal<Conversion | null>(null);
  readonly message = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly pending = signal<string | null>(null);
  readonly impact = signal<'base' | 'model' | 'remove' | null>(null);
  readonly typePending = signal<DataType | null>(null);
  readonly removeId = signal('');
  readonly dirty = computed(() => !!this.selectedId() && (this.tab() === 'basic' ? JSON.stringify(this.base()) !== JSON.stringify(this.detail() ? productInput(this.detail()!) : emptyProduct(this.filters().tenantId)) : this.tab() === 'access' ? !!this.detail() && JSON.stringify(this.access()) !== JSON.stringify(this.detail()!.accessConfig) : this.tab() === 'model' ? (this.jsonMode() ? this.jsonText() !== JSON.stringify(this.modelOriginal(), null, 2) : JSON.stringify(this.model()) !== JSON.stringify(this.modelOriginal())) : this.tab() === 'dp' ? JSON.stringify(this.rule()) !== JSON.stringify(this.ruleOriginal()) || this.enumText() !== JSON.stringify(this.ruleOriginal().enumMap) : false));
  readonly identifierIssue = computed(() => this.tab() === 'model' && !this.jsonMode() && this.detail() ? modelIdentifierError(this.model().identifier, this.model().id, this.detail()!.model) : null);
  private listRequest = 0;
  private detailRequest = 0;
  private deviceRequest = 0;
  private capacityRequest = 0;
  private media = matchMedia('(prefers-color-scheme: dark)');
  private activeModalKind: string | null = null;
  private modalTrigger: HTMLElement | null = null;
  private modalFrame = 0;
  private readonly updateSystem = () => { this.systemDark.set(this.media.matches); if (this.themeChoice() === 'system') document.documentElement.dataset['theme'] = this.media.matches ? 'dark' : 'light'; };
  constructor() {
    this.media.addEventListener('change', this.updateSystem); this.setTheme(this.themeChoice()); void this.loadList();
    effect(() => {
      const kind = this.pending() ? 'pending' : this.impact() ? 'impact' : this.typePending() ? 'type' : null;
      if (kind && !this.activeModalKind) this.modalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!kind && this.activeModalKind) { const trigger = this.modalTrigger; const previous = this.activeModalKind; this.modalFrame = requestAnimationFrame(() => { if (previous === 'type') document.querySelector<HTMLElement>('[aria-label="数据类型"]')?.focus(); else if (trigger?.isConnected) trigger.focus(); }); this.modalTrigger = null; }
      else if (kind) this.modalFrame = requestAnimationFrame(() => document.querySelector<HTMLElement>('.product-modal[role="dialog"]')?.focus());
      this.activeModalKind = kind;
    });
    effect(() => {
      const tab = this.tab(), detail = this.detail(), page = this.devicePage(), context = this.context();
      if (tab === 'devices' && detail) void this.loadAssociated(detail, page, context);
      else { this.deviceRequest++; this.deviceRows.set([]); this.deviceTotal.set(0); this.deviceError.set(''); }
    });
    effect(() => {
      const id = this.selectedId(), tenantId = this.base().tenantId;
      this.role(); this.scenario();
      if (id === 'new') void this.loadProductCapacity(tenantId);
      else { this.capacityRequest++; this.capacityNote.set(''); }
    });
  }
  ngOnDestroy() { this.media.removeEventListener('change', this.updateSystem); cancelAnimationFrame(this.modalFrame); }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) { if (this.dirty()) event.preventDefault(); }
  @HostListener('window:keydown', ['$event']) onModalKeydown(event: KeyboardEvent) {
    const kind = this.activeModalKind;
    const dialog = document.querySelector<HTMLElement>('.product-modal[role="dialog"]');
    if (!kind || !dialog) return;
    if (event.key === 'Escape') { event.preventDefault(); if (kind === 'pending') this.pending.set(null); else if (kind === 'impact') this.cancelImpact(); else this.typePending.set(null); return; }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])'));
    if (!buttons.length) return;
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
  }
  number(value: number) { return new Intl.NumberFormat('zh-CN').format(value); }
  date(value: string) { return new Date(value).toLocaleDateString('zh-CN'); }
  maxPage() { return Math.max(1, Math.ceil(this.total() / this.filters().pageSize)); }
  deviceMaxPage() { return Math.max(1, Math.ceil(this.deviceTotal() / 10)); }
  fieldEntries() { return Object.entries(this.fieldErrors()); }
  modelJson() { return JSON.stringify(this.model(), null, 2); }
  private context(): Context { return { actorId: 'usr_202609_001', role: this.role(), tenantId: this.role() === 'platformAdmin' ? 'all' : 'ten_202609_001', seed: 42, scenario: this.scenario() }; }
  private async loadProductCapacity(tenantId: string) { const request = ++this.capacityRequest; this.capacityNote.set('正在查询产品配额…'); const result = await tenants.checkCapacity(this.context(), tenantId, 'products'); if (request !== this.capacityRequest) return; this.capacityNote.set('error' in result ? result.error.message : `产品配额已用 ${result.data.used}/${result.data.limit}${(result.data.used + 1) / result.data.limit * 100 >= result.data.warningAt ? `；保存后达到 ${result.data.warningAt}% 预警阈值` : ''}`); }
  private async loadAssociated(product: Product, page: number, context: Context) {
    const current = ++this.deviceRequest;
    this.deviceLoading.set(true); this.deviceError.set(''); this.deviceRows.set([]);
    const response = await devices.list(context, { tenantId: product.tenantId, productId: product.id, seed: 42, page, pageSize: 10, sortBy: 'name', sortDirection: 'asc' });
    if (current !== this.deviceRequest) return;
    if ('error' in response) { this.deviceRows.set([]); this.deviceTotal.set(0); this.deviceError.set(response.error.message); }
    else { this.deviceRows.set(response.data.items); this.deviceTotal.set(response.data.total); }
    this.deviceLoading.set(false);
  }
  retryAssociated() { const detail = this.detail(); if (detail) void this.loadAssociated(detail, this.devicePage(), this.context()); }
  changeDevicePage(delta: number) { this.devicePage.update(page => page + delta); }
  setTheme(value: string) { this.themeChoice.set(value); document.documentElement.dataset['theme'] = value === 'dark' || (value === 'system' && this.systemDark()) ? 'dark' : 'light'; localStorage.setItem('iot-atlas-theme', value); }
  private clearProtectedView() { this.rows.set([]); this.total.set(0); this.selectedProducts.set([]); this.selectedId.set(null); this.detail.set(null); this.pending.set(null); this.impact.set(null); this.typePending.set(null); this.detailRequest++; }
  setRole(value: Role) { this.clearProtectedView(); this.role.set(value); const tenantId = value === 'platformAdmin' ? 'all' : 'ten_202609_001'; this.draftFilters.update(current => ({ ...current, tenantId, page: 1 })); this.filters.update(current => ({ ...current, tenantId, page: 1 })); void this.loadList(); }
  setScenario(value: Scenario) { if (value === 'forbidden') this.clearProtectedView(); this.scenario.set(value); void this.loadList(); }
  setDraftFilter(key: keyof ListFilters, value: string) { this.draftFilters.update(current => ({ ...current, [key]: value })); }
  setBase(key: keyof ProductInput, value: string) { this.base.update(current => ({ ...current, [key]: value })); }
  setModel(key: keyof ThingModelItem, value: unknown) { this.model.update(current => ({ ...current, [key]: value })); }
  changeModelType(target: HTMLSelectElement) {
    const current = this.model();
    const next = target.value as DataType;
    if (next === current.dataType) return;
    const numeric = next === 'float' || next === 'int';
    const incompatible = numeric ? !!current.enumValues?.length : !!current.unit?.trim() || current.min !== undefined || current.max !== undefined;
    if (incompatible) { target.value = current.dataType; this.typePending.set(next); }
    else this.model.set({ ...current, dataType: next });
  }
  confirmModelType() {
    const next = this.typePending();
    if (!next) return;
    const { unit, min, max, enumValues, ...compatible } = this.model();
    this.model.set(next === 'float' || next === 'int' ? { ...compatible, dataType: next, unit: unit ?? '', min: min ?? 0, max: max ?? 100 }
      : next === 'enum' ? { ...compatible, dataType: next, enumValues: enumValues ?? [] } : { ...compatible, dataType: next });
    this.typePending.set(null);
  }
  setRule(key: keyof DpRule, value: unknown) { this.rule.update(current => ({ ...current, [key]: value })); }
  setThreshold(key: 'min' | 'max', value: number) { this.rule.update(current => ({ ...current, threshold: { min: key === 'min' ? value : current.threshold?.min ?? 0, max: key === 'max' ? value : current.threshold?.max ?? 100 } })); }
  setEnumValues(value: string) { this.model.update(current => ({ ...current, enumValues: value.split(',').filter(Boolean) })); }
  setEnumMap(value: string) { this.enumText.set(value); this.conversion.set(null); }
  parseEnumText(): DpRule['enumMap'] | null { try { const parsed: unknown = JSON.parse(this.enumText()); if (!Array.isArray(parsed)) throw new Error('映射必须是数组'); const { enumMap, ...rest } = this.fieldErrors(); void enumMap; this.fieldErrors.set(rest); return parsed as DpRule['enumMap']; } catch { this.fieldErrors.update(current => ({ ...current, enumMap: '枚举映射须为有效 JSON 数组' })); this.conversion.set(null); return null; } }
  async loadList() { const current = ++this.listRequest; this.listLoading.set(true); this.selectedProducts.set([]); const filters = this.filters(); const response = await products.list(this.context(), { tenantId: filters.tenantId, keyword: filters.keyword || undefined, category: filters.category || undefined, status: filters.status as ProductStatus || undefined, page: filters.page, pageSize: filters.pageSize, seed: 42 }); if (current !== this.listRequest) return; if ('error' in response) { this.message.set(response.error.message); this.rows.set([]); this.total.set(0); if (response.error.code === 'FORBIDDEN') this.clearProtectedView(); } else { this.rows.set(response.data.items); this.total.set(response.data.total); } this.listLoading.set(false); }
  async loadDetail() { const id = this.selectedId(); if (!id || id === 'new') return; const current = ++this.detailRequest; const response = await products.get(this.context(), id); if (current !== this.detailRequest) return; if ('error' in response) { this.message.set(response.error.message); this.selectedId.set(null); this.detail.set(null); } else { this.detail.set(response.data); this.base.set(productInput(response.data)); this.access.set(structuredClone(response.data.accessConfig)); this.fieldErrors.set({}); } }
  apply() { this.filters.set({ ...this.draftFilters(), page: 1 }); void this.loadList(); }
  reset() { const next = initialList(); if (this.role() !== 'platformAdmin') next.tenantId = 'ten_202609_001'; this.draftFilters.set(next); this.filters.set(next); void this.loadList(); }
  setPageSize(value: number) { this.filters.update(current => ({ ...current, page: 1, pageSize: value })); this.draftFilters.update(current => ({ ...current, page: 1, pageSize: value })); void this.loadList(); }
  changePage(delta: number) { this.filters.update(current => ({ ...current, page: current.page + delta })); void this.loadList(); }
  refresh() { this.message.set(''); void this.loadList(); if (this.selectedId()) void this.loadDetail(); }
  open(id: string | null) { if (this.dirty()) { this.pending.set(id ?? 'close'); return; } this.selectedId.set(id); this.detail.set(null); this.message.set(''); this.fieldErrors.set({}); this.tab.set('basic'); if (id === 'new') { this.base.set(emptyProduct(new URLSearchParams(location.search).get('tenant') || this.filters().tenantId)); this.access.set(defaultAccessConfig('MQTT')); } else if (id) void this.loadDetail(); }
  discard() { const target = this.pending(); this.pending.set(null); this.message.set(''); this.fieldErrors.set({}); if (target?.startsWith('tab:')) { this.base.set(this.detail() ? productInput(this.detail()!) : emptyProduct(this.filters().tenantId)); this.access.set(structuredClone(this.detail()?.accessConfig ?? defaultAccessConfig('MQTT'))); this.model.set(structuredClone(this.modelOriginal())); this.jsonText.set(JSON.stringify(this.modelOriginal(), null, 2)); this.jsonMode.set(false); this.rule.set(structuredClone(this.ruleOriginal())); this.enumText.set(JSON.stringify(this.ruleOriginal().enumMap)); const next = target.slice(4) as Tab; if (next === 'dp' && this.detail()?.model.length) this.editRule(this.detail()!.model[0].id); else if (next === 'model') this.editModel(); else this.tab.set(next); return; } this.selectedId.set(target === 'close' ? null : target); this.detail.set(null); this.tab.set('basic'); if (target === 'new') { this.base.set(emptyProduct(this.filters().tenantId)); this.tab.set('basic'); } else if (target && target !== 'close') void this.loadDetail(); }
  chooseTab(value: Tab) { if (this.dirty()) { this.pending.set(`tab:${value}`); return; } if (value === 'dp' && this.detail()?.model.length) this.editRule(this.detail()!.model[0].id); else if (value === 'model') this.editModel(); else { if (value === 'devices') this.devicePage.set(1); this.tab.set(value); } }
  editModel(item?: ThingModelItem) { const next = item ? structuredClone(item) : emptyItem(); this.model.set(next); this.modelOriginal.set(structuredClone(next)); this.jsonText.set(JSON.stringify(next, null, 2)); this.jsonMode.set(false); this.conversion.set(null); this.fieldErrors.set({}); this.tab.set('model'); }
  editRule(itemId: string) { const next = this.detail()?.dpRules.find(candidate => candidate.itemId === itemId) ?? emptyRule(itemId); this.rule.set(structuredClone(next)); this.ruleOriginal.set(structuredClone(next)); this.enumText.set(JSON.stringify(next.enumMap)); this.conversion.set(null); this.fieldErrors.set({}); this.tab.set('dp'); }
  showResult(response: { error: { message: string; fieldErrors?: Record<string, string> } } | { data: Product }, onSuccess?: (product: Product) => void) { if ('error' in response) { this.message.set(response.error.message); this.fieldErrors.set(response.error.fieldErrors ?? {}); return false; } this.detail.set(response.data); this.base.set(productInput(response.data)); this.access.set(structuredClone(response.data.accessConfig)); this.message.set('已保存'); this.fieldErrors.set({}); void this.loadList(); onSuccess?.(response.data); return true; }
  async saveBase(confirmImpact = false) { const response = await products.save(this.context(), this.base(), this.detail()?.id, this.detail()?.version, confirmImpact); if ('error' in response && response.error.fieldErrors?.confirmImpact) { this.impact.set('base'); this.message.set(response.error.message); return false; } return this.showResult(response, product => { this.selectedId.set(product.id); this.impact.set(null); }); }
  setAccess(key: keyof AccessConfig, value: string | number) { this.access.update(current => ({ ...current, [key]: value })); }
  async saveAccess() { const detail = this.detail(); return detail ? this.showResult(await products.saveAccessConfig(this.context(), detail.id, this.access(), detail.version)) : false; }
  parseModel() { const parsed = parseJsonObject<ThingModelItem>(this.jsonText()); if (parsed.error) { this.message.set(parsed.error.message); this.fieldErrors.set({ modelJson: parsed.error.message }); const input = this.modelJsonInput()?.nativeElement; input?.focus(); input?.setSelectionRange(parsed.error.offset, parsed.error.offset); return null; } this.model.set(parsed.value); this.fieldErrors.set({}); this.message.set(''); return parsed.value; }
  toForm() { if (this.jsonMode() && !this.parseModel()) return; this.jsonMode.set(false); }
  toJson() { this.jsonText.set(this.modelJson()); this.jsonMode.set(true); }
  async saveModel(confirmImpact = false) { const detail = this.detail(); if (!detail) return false; const current = this.jsonMode() ? this.parseModel() : this.model(); if (!current) return false; const next = { ...current }; const response = await products.saveModel(this.context(), detail.id, next, detail.version, confirmImpact); if ('error' in response && response.error.fieldErrors?.confirmImpact) { this.impact.set('model'); this.message.set(response.error.message); return false; } return this.showResult(response, product => { const saved = product.model.find(item => item.id === next.id || (!next.id && item.identifier === next.identifier)) ?? next; this.model.set(saved); this.modelOriginal.set(saved); this.jsonText.set(JSON.stringify(saved, null, 2)); this.impact.set(null); }); }
  async removeModel(confirmed = false) { const detail = this.detail(); if (!detail) return false; const response = await products.removeModel(this.context(), detail.id, this.removeId(), detail.version, confirmed); if ('error' in response && response.error.fieldErrors?.confirmImpact) { this.impact.set('remove'); this.message.set(response.error.message); return false; } return this.showResult(response, () => { this.impact.set(null); this.removeId.set(''); this.model.set(emptyItem()); this.modelOriginal.set(emptyItem()); }); }
  requestRemove(id: string) { this.removeId.set(id); void this.removeModel(); }
  async saveRule() { const detail = this.detail(); if (!detail) return false; const enumMap = this.parseEnumText(); if (!enumMap) return false; const next = { ...this.rule(), enumMap, id: this.rule().id || `dp_${this.rule().itemId}` }; return this.showResult(await products.saveDpRule(this.context(), detail.id, next, detail.version), () => { this.rule.set(next); this.ruleOriginal.set(next); this.enumText.set(JSON.stringify(next.enumMap)); }); }
  async testRule() { const detail = this.detail(); if (!detail) return; const enumMap = this.parseEnumText(); if (!enumMap) return; const response = await products.testDpRule(this.context(), detail.id, { ...this.rule(), enumMap }, this.raw()); if ('error' in response) { this.message.set(response.error.message); this.fieldErrors.set(response.error.fieldErrors ?? {}); this.conversion.set(null); } else { this.conversion.set(response.data); this.message.set(''); this.fieldErrors.set({}); } }
  async saveCurrent() { return this.tab() === 'basic' ? this.saveBase() : this.tab() === 'access' ? this.saveAccess() : this.tab() === 'model' ? this.saveModel() : this.tab() === 'dp' ? this.saveRule() : true; }
  async saveAndLeave() { if (await this.saveCurrent()) this.discard(); }
  confirmImpact() { void (this.impact() === 'base' ? this.saveBase(true) : this.impact() === 'model' ? this.saveModel(true) : this.removeModel(true)); }
  cancelImpact() { this.impact.set(null); this.removeId.set(''); }
}
