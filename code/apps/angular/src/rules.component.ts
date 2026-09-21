import { Component, ElementRef, OnDestroy, ViewChild, computed, effect, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import type { Context, Role, Scenario } from './dashboard';
import { rules, validateFlow, type RuleEdge, type RuleExecution, type RuleFlow, type RuleInput, type RuleIssue, type RuleListQuery, type RuleLogQuery, type RuleNode, type RuleNodeKind, type RuleSample, type RuleSampleCase, type RuleSummary, type RuleVersionDiff } from './rules';

type View = 'list' | 'editor' | 'logs';
const blank = (tenantId: string): RuleInput => ({ tenantId: tenantId === 'all' ? 'ten_202609_001' : tenantId, productId: tenantId === 'ten_202609_002' ? 'prod_as_002' : 'prod_as_001', name: '', versionNote: '', nodes: [], edges: [] });
const baseList = (): RuleListQuery => ({ tenantId: localStorage.getItem('iot-atlas-current-tenant-v1') || 'all', page: 1, pageSize: 10, seed: 42 });
const baseLog = (): RuleLogQuery => ({ tenantId: localStorage.getItem('iot-atlas-current-tenant-v1') || 'all', page: 1, pageSize: 10, seed: 42 });
const inputOf = (flow: RuleFlow): RuleInput => ({ tenantId: flow.tenantId, productId: flow.productId, name: flow.name, versionNote: flow.versionNote, nodes: structuredClone(flow.nodes), edges: structuredClone(flow.edges) });
const defaults: Record<RuleNodeKind, RuleNode['config']> = {
  trigger: { field: 'temperature' }, condition: { join: 'AND', clauses: [{ field: 'temperature', operator: '>', threshold: 75 }] }, transform: { field: 'temperature', expression: 'x' },
  delay: { durationMs: 1000 }, alarm: { severity: 'major', message: '设备告警' }, storage: { target: 'iot_atlas' }, notification: { channel: 'email', message: '模拟通知' },
};

@Component({ selector: 'app-rules', standalone: true, imports: [MatButtonModule, MatCardModule], templateUrl: './rules.component.html', styleUrls: ['./dashboard.css', './products.css', './rules.css'] })
export class RulesComponent implements OnDestroy {
  readonly Math = Math;
  @ViewChild('canvas') canvas?: ElementRef<HTMLDivElement>;
  readonly tenants = [{ id: 'all', name: '全部租户' }, { id: 'ten_202609_001', name: '华东智联' }, { id: 'ten_202609_002', name: '全球能源' }];
  readonly products = [{ id: 'prod_as_001', name: '工业温湿度传感器' }, { id: 'prod_as_002', name: '能源网关' }];
  readonly productNames: Record<string, string> = { prod_as_001: '工业温湿度传感器', prod_as_002: '能源网关' };
  readonly kinds: Record<RuleNodeKind, string> = { trigger: '设备事件', condition: '条件判断', transform: '数据转换', delay: '延迟', alarm: '告警通知', storage: '数据存储', notification: '模拟通知' };
  readonly palette: RuleNodeKind[] = ['trigger', 'condition', 'transform', 'delay', 'alarm', 'storage', 'notification'];
  readonly nav = ['实验室'];
  readonly operators = ['>', '>=', '<', '<=', '==', '!='];
  readonly samples = rules.samples();
  readonly role = signal<Role>('platformAdmin');
  readonly scenario = signal<Scenario>('normal');
  readonly themeChoice = signal(localStorage.getItem('iot-atlas-theme') || 'dark');
  readonly systemDark = signal(matchMedia('(prefers-color-scheme: dark)').matches);
  readonly dark = computed(() => this.themeChoice() === 'dark' || (this.themeChoice() === 'system' && this.systemDark()));
  readonly canWrite = computed(() => this.role() === 'platformAdmin' || this.role() === 'tenantAdmin');
  readonly canRun = computed(() => this.role() !== 'viewer');
  readonly view = signal<View>('list');
  readonly draftFilters = signal<RuleListQuery>(baseList());
  readonly filters = signal<RuleListQuery>(baseList());
  readonly rows = signal<RuleSummary[]>([]);
  readonly total = signal(0);
  readonly message = signal('');
  readonly flow = signal<RuleFlow | null>(null);
  readonly draft = signal<RuleInput>(blank('all'));
  readonly selectedNode = signal<string | null>(null);
  readonly connectFrom = signal<string | null>(null);
  readonly issues = signal<RuleIssue[]>([]);
  readonly sampleText = signal(JSON.stringify(this.samples[0]));
  readonly caseName = signal(''); readonly savedCases = signal<RuleSampleCase[]>([]);
  readonly versions = signal<RuleFlow[]>([]); readonly fromVersion = signal(1); readonly toVersion = signal(1);
  readonly versionDiff = signal<RuleVersionDiff | null>(null);
  readonly execution = signal<RuleExecution | null>(null);
  readonly visibleTraces = signal<number | null>(null);
  readonly playback = computed(() => this.execution() !== null && this.visibleTraces() !== null && this.visibleTraces()! < this.execution()!.traces.length);
  readonly playbackTimer = effect(onCleanup => { const result = this.execution(), count = this.visibleTraces(); if (!result || count === null) return; if (count >= result.traces.length) { this.message.set('试运行完成；设备数据未改变'); return; } const wait = Math.min(1000, Math.max(180, result.traces[count]?.durationMs ?? 180)); const timer = window.setTimeout(() => this.visibleTraces.update(value => value === null ? null : value + 1), wait); onCleanup(() => window.clearTimeout(timer)); });
  readonly confirm = signal<'toggle' | 'apply' | null>(null);
  readonly logDraft = signal<RuleLogQuery>(baseLog());
  readonly logQuery = signal<RuleLogQuery>(baseLog());
  readonly logs = signal<RuleExecution[]>([]);
  readonly logTotal = signal(0);
  readonly selectedLog = signal<RuleExecution | null>(null);
  readonly node = computed(() => this.draft().nodes.find(item => item.id === this.selectedNode()));
  readonly dirty = computed(() => this.flow() ? JSON.stringify(this.draft()) !== JSON.stringify(inputOf(this.flow()!)) : !!(this.draft().name || this.draft().nodes.length || this.draft().edges.length));
  readonly traceMap = computed(() => new Map(this.execution()?.traces.slice(0, this.visibleTraces() ?? this.execution()!.traces.length).map(item => [item.nodeId, item]) ?? []));
  readonly canvasHeight = computed(() => Math.max(420, ...this.draft().nodes.map(item => item.y + 110)));
  private media = matchMedia('(prefers-color-scheme: dark)');
  private updateMedia = () => { this.systemDark.set(this.media.matches); if (this.themeChoice() === 'system') document.documentElement.dataset['theme'] = this.media.matches ? 'dark' : 'light'; };
  private listToken = 0;
  private logToken = 0;
  private beforeUnload = (event: BeforeUnloadEvent) => { if (this.view() === 'editor' && this.dirty()) event.preventDefault(); };
  constructor() { this.media.addEventListener('change', this.updateMedia); window.addEventListener('beforeunload', this.beforeUnload); this.setTheme(this.themeChoice()); void this.loadList(); }
  ngOnDestroy() { this.media.removeEventListener('change', this.updateMedia); window.removeEventListener('beforeunload', this.beforeUnload); }
  private context(): Context { return { actorId: 'usr_202609_001', role: this.role(), tenantId: this.role() === 'platformAdmin' ? 'all' : 'ten_202609_001', seed: 42, scenario: this.scenario() }; }
  setTheme(value: string) { this.themeChoice.set(value); document.documentElement.dataset['theme'] = value === 'dark' || (value === 'system' && this.systemDark()) ? 'dark' : 'light'; localStorage.setItem('iot-atlas-theme', value); }
  setRole(value: Role) { this.role.set(value); const tenantId = value === 'platformAdmin' ? 'all' : 'ten_202609_001'; this.draftFilters.set({ ...baseList(), tenantId }); this.filters.set({ ...baseList(), tenantId }); this.logDraft.set({ ...baseLog(), tenantId }); this.logQuery.set({ ...baseLog(), tenantId }); this.view.set('list'); this.flow.set(null); this.execution.set(null); this.message.set(''); void this.loadList(); }
  setScenario(value: Scenario) { this.scenario.set(value); void this.loadList(); if (this.view() === 'logs') void this.loadLogs(); }
  setDraftFilter(key: keyof RuleListQuery, value: unknown) { this.draftFilters.update(current => ({ ...current, [key]: value })); }
  setDraft(key: keyof RuleInput, value: unknown) { this.draft.update(current => ({ ...current, [key]: value })); }
  setTenant(value: string) { this.draft.update(current => ({ ...current, tenantId: value, productId: value === 'ten_202609_002' ? 'prod_as_002' : 'prod_as_001' })); }
  setLogDraft(key: keyof RuleLogQuery, value: unknown) { this.logDraft.update(current => ({ ...current, [key]: value })); }
  applyFilters() { this.filters.set({ ...this.draftFilters(), page: 1 }); void this.loadList(); }
  changePage(delta: number) { this.filters.update(current => ({ ...current, page: current.page + delta })); void this.loadList(); }
  setPageSize(size: number) { this.filters.update(current => ({ ...current, page: 1, pageSize: size })); void this.loadList(); }
  async loadList() { const token = ++this.listToken; const response = await rules.list(this.context(), this.filters()); if (token !== this.listToken) return; if ('error' in response) { this.message.set(response.error.message); this.rows.set([]); this.total.set(0); } else { this.rows.set(response.data.items); this.total.set(response.data.total); } }
  openLogs(all = false) { this.logDraft.update(current => ({ ...current, ruleId: all ? undefined : this.flow()?.id })); this.logQuery.update(current => ({ ...current, ruleId: all ? undefined : this.flow()?.id, page: 1 })); this.view.set('logs'); void this.loadLogs(); }
  applyLogFilters() { this.logQuery.set({ ...this.logDraft(), page: 1 }); void this.loadLogs(); }
  changeLogPage(delta: number) { this.logQuery.update(current => ({ ...current, page: current.page + delta })); void this.loadLogs(); }
  async loadLogs() { const token = ++this.logToken; const response = await rules.logsFor(this.context(), this.logQuery()); if (token !== this.logToken) return; if ('error' in response) { this.message.set(response.error.message); this.logs.set([]); this.logTotal.set(0); } else { this.logs.set(response.data.items); this.logTotal.set(response.data.total); } }
  async loadExtras(id: string) { const [cases, history] = await Promise.all([rules.sampleCases(this.context(), id), rules.versionHistory(this.context(), id)]); if ('data' in cases) this.savedCases.set(cases.data); if ('data' in history) { this.versions.set(history.data); this.fromVersion.set(history.data.at(-1)?.version ?? 1); this.toVersion.set(history.data[0]?.version ?? 1); } this.versionDiff.set(null); }
  async open(id: string) { const response = await rules.get(this.context(), id); if ('error' in response) { this.message.set(response.error.message); return; } this.flow.set(response.data); this.draft.set(inputOf(response.data)); this.selectedNode.set(response.data.nodes[0]?.id ?? null); this.issues.set([]); this.execution.set(null); this.view.set('editor'); this.message.set(''); void this.loadExtras(id); }
  create() { this.flow.set(null); this.draft.set(blank(this.filters().tenantId)); this.selectedNode.set(null); this.issues.set([]); this.execution.set(null); this.savedCases.set([]); this.versions.set([]); this.versionDiff.set(null); this.view.set('editor'); this.message.set(''); }
  updateNode(patch: Partial<RuleNode> & { config?: RuleNode['config'] }) { if (!this.canWrite() || !this.selectedNode()) return; this.draft.update(current => ({ ...current, nodes: current.nodes.map(item => item.id === this.selectedNode() ? { ...item, ...patch, config: patch.config ? { ...item.config, ...patch.config } : item.config } : item) })); this.execution.set(null); }
  updateConfig(patch: RuleNode['config']) { this.updateNode({ config: patch }); }
  updateClause(index: number, patch: Partial<NonNullable<RuleNode['config']['clauses']>[number]>) { const node = this.node(); if (node) this.updateConfig({ clauses: node.config.clauses?.map((item, position) => position === index ? { ...item, ...patch } : item) }); }
  removeClause(index: number) { const node = this.node(); if (node) this.updateConfig({ clauses: node.config.clauses?.filter((_, position) => position !== index) }); }
  addClause() { const node = this.node(); if (node) this.updateConfig({ clauses: [...(node.config.clauses ?? []), { field: 'temperature', operator: '>', threshold: 75 }] }); }
  addNode(kind: RuleNodeKind, x = 40 + (this.draft().nodes.length % 3) * 220, y = 80 + Math.floor(this.draft().nodes.length / 3) * 130) { if (!this.canWrite()) return; const id = `${kind}_${Date.now()}_${this.draft().nodes.length}`; this.draft.update(current => ({ ...current, nodes: [...current.nodes, { id, kind, name: this.kinds[kind], x: Math.min(730, Math.max(0, x)), y: Math.max(0, y), config: structuredClone(defaults[kind]) }] })); this.selectedNode.set(id); this.issues.set([]); this.execution.set(null); }
  dragKind(event: DragEvent, kind: RuleNodeKind) { event.dataTransfer?.setData('node/kind', kind); }
  dragNode(event: DragEvent, id: string) { event.dataTransfer?.setData('node/id', id); }
  drop(event: DragEvent) { event.preventDefault(); if (!this.canWrite() || !this.canvas?.nativeElement || !event.dataTransfer) return; const element = this.canvas.nativeElement, bounds = element.getBoundingClientRect(); const x = event.clientX - bounds.left + element.scrollLeft - 70, y = event.clientY - bounds.top + element.scrollTop - 35; const moved = event.dataTransfer.getData('node/id'); if (moved) this.draft.update(current => ({ ...current, nodes: current.nodes.map(item => item.id === moved ? { ...item, x: Math.min(730, Math.max(0, x)), y: Math.max(0, y) } : item) })); else { const kind = event.dataTransfer.getData('node/kind') as RuleNodeKind; if (this.palette.includes(kind)) this.addNode(kind, x, y); } }
  line(edge: RuleEdge) { const from = this.draft().nodes.find(item => item.id === edge.from), to = this.draft().nodes.find(item => item.id === edge.to); return from && to ? { x1: from.x + 150, y1: from.y + 42, x2: to.x, y2: to.y + 42 } : null; }
  nodeName(id: string) { return this.draft().nodes.find(item => item.id === id)?.name ?? id; }
  connect(to: string) { if (!this.connectFrom() || !this.canWrite()) return; const edge: RuleEdge = { id: `edge_${Date.now()}`, from: this.connectFrom()!, to }; const proposed = { ...this.draft(), edges: [...this.draft().edges, edge] }; const blocking = validateFlow(proposed).find(issue => issue.code === 'INVALID_EDGE' || issue.code === 'CYCLE'); if (blocking) this.message.set(blocking.message); else { this.draft.set(proposed); this.message.set('连线已添加'); this.issues.set([]); } this.connectFrom.set(null); this.execution.set(null); }
  removeEdge(id: string) { this.draft.update(current => ({ ...current, edges: current.edges.filter(item => item.id !== id) })); }
  removeNode() { const node = this.node(); if (!node) return; this.draft.update(current => ({ ...current, nodes: current.nodes.filter(item => item.id !== node.id), edges: current.edges.filter(edge => edge.from !== node.id && edge.to !== node.id) })); this.selectedNode.set(null); }
  validate() { const found = validateFlow(this.draft()); this.issues.set(found); this.message.set(found.length ? `发现 ${found.length} 项校验问题` : '规则图校验通过'); }
  async save() { this.validate(); if (this.issues().length) return; const response = await rules.save(this.context(), this.draft(), this.flow()?.id, this.flow()?.version); if ('error' in response) { this.message.set(response.error.message); return; } this.flow.set(response.data); this.draft.set(inputOf(response.data)); this.message.set('草稿已保存'); void this.loadList(); void this.loadExtras(response.data.id); }
  async toggle() { const flow = this.flow(); if (!flow) return; const response = await rules.toggle(this.context(), flow.id, !flow.enabled, flow.version); this.confirm.set(null); if ('error' in response) { this.message.set(response.error.message); return; } this.flow.set(response.data); this.message.set(response.data.enabled ? '规则已启用' : '规则已停用'); void this.loadList(); void this.loadExtras(response.data.id); }
  sampleIndex() { return this.samples.findIndex(item => JSON.stringify(item) === this.sampleText()); }
  setSample(index: number) { const sample = this.samples[index]; if (sample) { this.sampleText.set(JSON.stringify(sample)); this.execution.set(null); } }
  setSampleText(value: string) { this.sampleText.set(value); this.execution.set(null); }
  private parseSample(): RuleSample | null { try { const parsed = JSON.parse(this.sampleText()) as RuleSample; if (!parsed || typeof parsed !== 'object') throw new Error('需要 JSON 对象'); return parsed; } catch (cause) { this.message.set(`样例 JSON 无效：${(cause as Error).message}`); return null; } }
  async run() { const flow = this.flow(); if (!flow || this.dirty()) { this.message.set('请先保存当前规则图'); return; } const sample = this.parseSample(); if (!sample) return; const response = await rules.testRun(this.context(), flow.id, sample); if ('error' in response) { this.message.set(response.error.message); return; } this.execution.set(response.data); this.visibleTraces.set(0); this.message.set('正在逐节点回放试运行轨迹；设备数据未改变'); }
  async apply() { const flow = this.flow(); if (!flow) return; const sample = this.parseSample(); if (!sample) return; const response = await rules.applySimulation(this.context(), flow.id, sample, true); this.confirm.set(null); if ('error' in response) { this.message.set(response.error.message); return; } this.execution.set(response.data); this.visibleTraces.set(null); this.message.set('模拟结果已写入演示日志；设备数据未改变'); void this.loadList(); }
  async saveCase() { const flow = this.flow(); if (!flow || !this.execution()) return; const sample = this.parseSample(); if (!sample) return; const response = await rules.saveSampleCase(this.context(), flow.id, this.caseName(), sample); if ('error' in response) { this.message.set(response.error.message); return; } this.caseName.set(''); this.message.set(`测试样例 ${response.data.name} 已保存`); void this.loadExtras(flow.id); }
  selectSavedCase(id: string) { const saved = this.savedCases().find(item => item.id === id); if (saved) { this.sampleText.set(JSON.stringify(saved.sample)); this.execution.set(null); } }
  async compare() { const flow = this.flow(); if (!flow) return; const response = await rules.compareVersions(this.context(), flow.id, this.fromVersion(), this.toVersion()); if ('error' in response) { this.message.set(response.error.message); return; } this.versionDiff.set(response.data); this.message.set(`已比较 v${this.fromVersion()} 与 v${this.toVersion()}`); }
  confirmAction() { if (this.confirm() === 'toggle') void this.toggle(); else void this.apply(); }
  formatTime(value: string | null) { return value ? new Date(value).toLocaleString('zh-CN') : '暂无'; }
  toLocal(value?: string) { return value?.slice(0, 16) ?? ''; }
  fromLocal(value: string) { return value ? new Date(value).toISOString() : undefined; }
  nameOf(id: string) { return this.rows().find(item => item.id === id)?.name ?? id; }
  sumTime(execution: RuleExecution) { return execution.traces.reduce((sum, trace) => sum + trace.durationMs, 0); }
  serialize(value: unknown) { return JSON.stringify(value); }
}
