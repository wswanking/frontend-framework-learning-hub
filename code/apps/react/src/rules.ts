// IOT-RULE-001 / IOT-DOMAIN-001. Each application keeps its own physical copy.
import type { Context } from './dashboard';

export type RuleNodeKind = 'trigger' | 'condition' | 'transform' | 'delay' | 'alarm' | 'storage' | 'notification';
export type RuleNode = {
  id: string;
  kind: RuleNodeKind;
  name: string;
  x: number;
  y: number;
  config: {
    field?: string;
    operator?: '>' | '>=' | '<' | '<=' | '==' | '!=';
    threshold?: number;
    join?: 'AND' | 'OR';
    clauses?: { field: string; operator: '>' | '>=' | '<' | '<=' | '==' | '!='; threshold: number }[];
    expression?: string;
    durationMs?: number;
    severity?: 'critical' | 'major' | 'minor';
    message?: string;
    target?: string;
    channel?: 'email' | 'sms' | 'webhook';
    simulateFailure?: boolean;
    simulateTimeout?: boolean;
  };
};
export type RuleEdge = { id: string; from: string; to: string };
export type RuleFlow = {
  id: string; tenantId: string; productId: string; name: string; enabled: boolean;
  version: number; versionNote: string; createdAt: string; updatedAt: string; nodes: RuleNode[]; edges: RuleEdge[];
};
export type RuleInput = Pick<RuleFlow, 'tenantId' | 'productId' | 'name' | 'versionNote' | 'nodes' | 'edges'>;
export type RuleSample = { deviceId: string; productId: string; occurredAt: string; properties: Record<string, number | string | boolean> };
export type RuleTrace = {
  nodeId: string; kind: RuleNodeKind; status: 'succeeded' | 'skipped' | 'failed' | 'waiting';
  input: Record<string, unknown>; output: Record<string, unknown> | null; durationMs: number; matched: boolean | null; reason?: string;
};
export type RuleExecution = {
  id: string; ruleId: string; tenantId: string; deviceId: string; occurredAt: string;
  mode: 'event' | 'applied'; status: 'succeeded' | 'skipped' | 'failed';
  traces: RuleTrace[]; sample: RuleSample; alarmCreated: boolean;
};
export type RuleIssue = { nodeId: string | null; code: 'MISSING_TRIGGER' | 'MISSING_ACTION' | 'MULTIPLE_TRIGGERS' | 'INVALID_EDGE' | 'ISOLATED' | 'CYCLE' | 'MISSING_FIELD' | 'INVALID_EXPRESSION' | 'INVALID_CONFIG'; message: string };
export type RuleError = { error: { code: 'FORBIDDEN' | 'VALIDATION_ERROR' | 'CONFLICT' | 'NOT_FOUND' | 'SCENARIO_TIMEOUT'; message: string; fieldErrors?: Record<string, string>; retryable?: boolean } };
export type RuleSuccess<T> = { data: T; meta: { requestId: string; seed: number; generatedAt: string } };
export type RuleResult<T> = RuleSuccess<T> | RuleError;
export type RuleListQuery = { tenantId: string; keyword?: string; productId?: string; enabled?: boolean; page: number; pageSize: number; seed: number };
export type RuleLogQuery = { tenantId: string; ruleId?: string; deviceId?: string; from?: string; to?: string; status?: RuleExecution['status']; page: number; pageSize: number; seed: number };
export type RuleSummary = Pick<RuleFlow, 'id' | 'tenantId' | 'productId' | 'name' | 'enabled' | 'version'> & { recentExecution: string | null; successRate: number | null };
export type RuleSampleCase = { id: string; ruleId: string; tenantId: string; name: string; sample: RuleSample; createdAt: string; actorId: string };
export type RuleVersionDiff = { from: number; to: number; fields: string[]; addedNodes: string[]; removedNodes: string[]; changedNodes: string[]; addedEdges: string[]; removedEdges: string[] };

const FIXED_AT = '2026-09-16T12:00:00.000Z';
const RULES_KEY = 'iot-atlas-rules-v1';
const LOGS_KEY = 'iot-atlas-rule-logs-v1';
const VERSIONS_KEY = 'iot-atlas-rule-versions-v1';
const CASES_KEY = 'iot-atlas-rule-sample-cases-v1';
const ACTIONS: RuleNodeKind[] = ['alarm', 'storage', 'notification'];
const IDENTIFIER = /^[a-z][a-z0-9_]{1,63}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const validUtc = (value: string) => UTC.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
const clone = <T>(value: T): T => structuredClone(value);
const versionTime = (version: number) => new Date(Date.parse(FIXED_AT) + version * 60_000).toISOString();
const seedRules: RuleFlow[] = [
  { id: 'rule_high_temp', tenantId: 'ten_202609_001', productId: 'prod_as_001', name: '高温告警', enabled: true, version: 1, versionNote: '初始演示规则', createdAt: FIXED_AT, updatedAt: FIXED_AT,
    nodes: [
      { id: 'trigger_1', kind: 'trigger', name: '设备事件', x: 50, y: 100, config: { field: 'temperature' } },
      { id: 'condition_1', kind: 'condition', name: '温度判断', x: 280, y: 100, config: { join: 'AND', clauses: [{ field: 'temperature', operator: '>', threshold: 75 }] } },
      { id: 'alarm_1', kind: 'alarm', name: '告警通知', x: 510, y: 40, config: { severity: 'critical', message: '检测到高温，请及时处理' } },
      { id: 'storage_1', kind: 'storage', name: '数据存储', x: 510, y: 180, config: { target: 'iot_atlas' } },
    ],
    edges: [{ id: 'edge_1', from: 'trigger_1', to: 'condition_1' }, { id: 'edge_2', from: 'condition_1', to: 'alarm_1' }, { id: 'edge_3', from: 'condition_1', to: 'storage_1' }] },
  { id: 'rule_low_battery', tenantId: 'ten_202609_002', productId: 'prod_as_002', name: '网关状态归档', enabled: false, version: 1, versionNote: '等待设备接入', createdAt: FIXED_AT, updatedAt: FIXED_AT,
    nodes: [
      { id: 'trigger_2', kind: 'trigger', name: '设备事件', x: 50, y: 100, config: { field: 'voltage' } },
      { id: 'storage_2', kind: 'storage', name: '数据存储', x: 300, y: 100, config: { target: 'iot_atlas' } },
    ], edges: [{ id: 'edge_4', from: 'trigger_2', to: 'storage_2' }] },
];
const seedSamples: RuleSample[] = [
  { deviceId: 'dev_as_001', productId: 'prod_as_001', occurredAt: FIXED_AT, properties: { temperature: 82.4, humidity: 41.2 } },
  { deviceId: 'dev_eu_001', productId: 'prod_as_001', occurredAt: FIXED_AT, properties: { temperature: 21.8, humidity: 55.1 } },
  { deviceId: 'dev_as_002', productId: 'prod_as_002', occurredAt: FIXED_AT, properties: { voltage: 220, status: 'OK' } },
];
const err = (code: RuleError['error']['code'], message: string, fieldErrors?: Record<string, string>): RuleError => ({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}), retryable: code === 'SCENARIO_TIMEOUT' } });
const result = <T>(context: Context, data: T, key: string): RuleSuccess<T> => ({ data: clone(data), meta: { requestId: `req_${context.seed}_${key}`, seed: context.seed, generatedAt: FIXED_AT } });
const validPage = (page: number, size: number) => Number.isInteger(page) && page > 0 && Number.isInteger(size) && size > 0 && size <= 100;
const writable = (role: Context['role']) => role === 'platformAdmin' || role === 'tenantAdmin';
function authorize(context: Context, tenantId: string, mode: 'read' | 'run' | 'write'): RuleError | null {
  if (context.scenario === 'forbidden') return err('FORBIDDEN', '无权访问规则');
  if (mode === 'write' && !writable(context.role)) return err('FORBIDDEN', '无权编辑规则');
  if (mode === 'run' && context.role === 'viewer') return err('FORBIDDEN', '观察员不能试运行规则');
  if (context.role !== 'platformAdmin' && (tenantId === 'all' || tenantId !== context.tenantId)) return err('FORBIDDEN', '无权访问该租户规则');
  if (mode === 'write' && tenantId === 'all') return err('VALIDATION_ERROR', '写入需要显式租户', { tenantId: '请选择目标租户' });
  if (context.scenario === 'offline') return err('SCENARIO_TIMEOUT', '模拟规则服务暂不可用');
  return null;
}
const pause = async (context: Context) => { if (context.scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 80)); };
function edgeError(nodes: RuleNode[], edge: RuleEdge): string | null {
  const source = nodes.find(node => node.id === edge.from), target = nodes.find(node => node.id === edge.to);
  if (!source || !target) return '连线端点不存在';
  if (source.id === target.id) return '节点不能连接自身';
  if (target.kind === 'trigger') return '触发器不接受输入';
  if (ACTIONS.includes(source.kind)) return '动作节点不提供流程输出';
  return null;
}
export function validateFlow(input: RuleInput): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (!['ten_202609_001', 'ten_202609_002'].includes(input.tenantId)) issues.push({ nodeId: null, code: 'INVALID_CONFIG', message: '请选择有效租户' });
  if (!input.name?.trim() || input.name.trim().length > 80) issues.push({ nodeId: null, code: 'INVALID_CONFIG', message: '规则名称为 1–80 字符' });
  if (!['prod_as_001', 'prod_as_002'].includes(input.productId)) issues.push({ nodeId: null, code: 'INVALID_CONFIG', message: '请选择有效产品' });
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges) || input.nodes.length > 30 || input.edges.length > 60) return [{ nodeId: null, code: 'INVALID_CONFIG', message: '节点与连线数量无效' }];
  const ids = input.nodes.map(node => node.id);
  if (new Set(ids).size !== ids.length) issues.push({ nodeId: null, code: 'INVALID_CONFIG', message: '节点 ID 必须唯一' });
  const triggers = input.nodes.filter(node => node.kind === 'trigger');
  if (!triggers.length) issues.push({ nodeId: null, code: 'MISSING_TRIGGER', message: '需要一个触发器' });
  if (triggers.length > 1) triggers.forEach(node => issues.push({ nodeId: node.id, code: 'MULTIPLE_TRIGGERS', message: '只能有一个触发器' }));
  if (!input.nodes.some(node => ACTIONS.includes(node.kind))) issues.push({ nodeId: null, code: 'MISSING_ACTION', message: '至少需要一个动作节点' });
  for (const node of input.nodes) {
    const c = node.config ?? {};
    const issue = (code: RuleIssue['code'], message: string) => issues.push({ nodeId: node.id, code, message });
    if (!node.id || !node.name?.trim() || !Number.isFinite(node.x) || !Number.isFinite(node.y) || !['trigger', 'condition', 'transform', 'delay', ...ACTIONS].includes(node.kind)) { issue('INVALID_CONFIG', '节点名称、坐标或类型无效'); continue; }
    if (node.kind === 'trigger' && (!c.field || !IDENTIFIER.test(c.field))) issue('MISSING_FIELD', '触发器需配置有效字段');
    if (node.kind === 'condition') {
      if (!['AND', 'OR'].includes(c.join ?? '') || !Array.isArray(c.clauses) || !c.clauses.length || c.clauses.length > 6) issue('INVALID_CONFIG', '条件组须为 AND/OR 且含 1–6 个条件');
      else c.clauses.forEach(clause => { if (!IDENTIFIER.test(clause.field) || !['>', '>=', '<', '<=', '==', '!='].includes(clause.operator) || !Number.isFinite(clause.threshold)) issue('MISSING_FIELD', '条件字段、运算符或阈值无效'); });
    }
    if (node.kind === 'transform' && (!c.field || !IDENTIFIER.test(c.field) || !validExpression(c.expression ?? ''))) issue('INVALID_EXPRESSION', '转换仅支持 x、abs(x)、round(x) 或 x 与常数的加减乘');
    if (node.kind === 'delay' && (!Number.isInteger(c.durationMs) || c.durationMs! < 0 || c.durationMs! > 10_000)) issue('INVALID_CONFIG', '延迟须为 0–10000 毫秒');
    if (node.kind === 'alarm' && (!['critical', 'major', 'minor'].includes(c.severity ?? '') || !c.message?.trim())) issue('INVALID_CONFIG', '告警级别和内容必填');
    if (node.kind === 'storage' && (!c.target || !IDENTIFIER.test(c.target))) issue('INVALID_CONFIG', '存储目标必填');
    if (node.kind === 'notification' && (!['email', 'sms', 'webhook'].includes(c.channel ?? '') || !c.message?.trim())) issue('INVALID_CONFIG', '通知渠道和内容必填');
  }
  for (const edge of input.edges) {
    const reason = edgeError(input.nodes, edge);
    if (reason) issues.push({ nodeId: input.nodes.some(node => node.id === edge.to) ? edge.to : null, code: 'INVALID_EDGE', message: reason });
  }
  if (new Set(input.edges.map(edge => edge.id)).size !== input.edges.length || new Set(input.edges.map(edge => `${edge.from}:${edge.to}`)).size !== input.edges.length) issues.push({ nodeId: null, code: 'INVALID_EDGE', message: '连线不能重复' });
  const indegree = new Map(input.nodes.map(node => [node.id, 0]));
  const forward = new Map(input.nodes.map(node => [node.id, [] as string[]]));
  for (const edge of input.edges) if (indegree.has(edge.from) && indegree.has(edge.to)) { indegree.set(edge.to, indegree.get(edge.to)! + 1); forward.get(edge.from)!.push(edge.to); }
  const queue = input.nodes.filter(node => indegree.get(node.id) === 0).map(node => node.id);
  const seen: string[] = [];
  while (queue.length) { const id = queue.shift()!; seen.push(id); for (const to of forward.get(id) ?? []) { indegree.set(to, indegree.get(to)! - 1); if (indegree.get(to) === 0) queue.push(to); } }
  for (const node of input.nodes) if (!seen.includes(node.id)) issues.push({ nodeId: node.id, code: 'CYCLE', message: '节点形成循环依赖' });
  const reachable = new Set<string>(), walk = [...triggers.map(node => node.id)];
  while (walk.length) { const id = walk.shift()!; if (reachable.has(id)) continue; reachable.add(id); walk.push(...(forward.get(id) ?? [])); }
  for (const node of input.nodes) if (!reachable.has(node.id) && !issues.some(issue => issue.nodeId === node.id && issue.code === 'CYCLE')) issues.push({ nodeId: node.id, code: 'ISOLATED', message: '节点未连接到触发器' });
  return issues;
}
export function validExpression(expression: string): boolean {
  return /^(x|abs\(x\)|round\(x\)|x\s*[+*-]\s*-?\d+(?:\.\d+)?)$/.test(expression.trim()) && expression.length <= 80;
}
function transform(expression: string, x: number): number {
  const source = expression.trim();
  if (source === 'x') return x;
  if (source === 'abs(x)') return Math.abs(x);
  if (source === 'round(x)') return Math.round(x);
  const match = /^x\s*([+*-])\s*(-?\d+(?:\.\d+)?)$/.exec(source)!;
  const value = Number(match[2]);
  return match[1] === '+' ? x + value : match[1] === '-' ? x - value : x * value;
}
function compare(value: number, operator: NonNullable<RuleNode['config']['operator']>, threshold: number): boolean {
  if (operator === '>') return value > threshold;
  if (operator === '>=') return value >= threshold;
  if (operator === '<') return value < threshold;
  if (operator === '<=') return value <= threshold;
  if (operator === '==') return value === threshold;
  return value !== threshold;
}
function runGraph(flow: RuleFlow, sample: RuleSample, id: string, mode: RuleExecution['mode']): RuleExecution {
  const predecessors = new Map(flow.nodes.map(node => [node.id, [] as string[]]));
  const successors = new Map(flow.nodes.map(node => [node.id, [] as string[]]));
  for (const edge of flow.edges) { predecessors.get(edge.to)!.push(edge.from); successors.get(edge.from)!.push(edge.to); }
  const indegree = new Map(flow.nodes.map(node => [node.id, predecessors.get(node.id)!.length]));
  const queue = flow.nodes.filter(node => indegree.get(node.id) === 0).map(node => node.id);
  const traces = new Map<string, RuleTrace>();
  const outputs = new Map<string, Record<string, unknown>>();
  while (queue.length) {
    const nodeId = queue.shift()!, node = flow.nodes.find(item => item.id === nodeId)!;
    const parents = predecessors.get(nodeId)!.map(parent => traces.get(parent)!);
    const active = node.kind === 'trigger' || parents.some(parent => parent.status === 'succeeded');
    const input = node.kind === 'trigger' ? { ...sample.properties } : { ...(outputs.get(predecessors.get(nodeId)!.find(parent => traces.get(parent)?.status === 'succeeded') ?? '') ?? {}) };
    let status: RuleTrace['status'] = 'succeeded', output: Record<string, unknown> | null = { ...input }, matched: boolean | null = null, reason: string | undefined;
    let durationMs = node.kind === 'delay' ? node.config.durationMs ?? 0 : node.kind === 'alarm' ? 46 : node.kind === 'storage' ? 32 : 8;
    if (!active) { status = 'skipped'; output = null; durationMs = 0; reason = '上游条件未匹配或执行失败'; }
    else if (node.config.simulateTimeout) { status = 'failed'; output = null; durationMs = 1000; reason = '节点表达式超时（1000 ms）'; }
    else if (node.config.simulateFailure) { status = 'failed'; output = null; reason = '模拟动作失败'; }
    else if (node.kind === 'trigger' && !(node.config.field! in input)) { status = 'failed'; output = null; reason = `缺少字段 ${node.config.field}`; }
    else if (node.kind === 'condition') {
      const values = node.config.clauses!.map(clause => {
        const value = input[clause.field];
        if (typeof value !== 'number' || !Number.isFinite(value)) { reason = `缺少数值字段 ${clause.field}`; return null; }
        return compare(value, clause.operator, clause.threshold);
      });
      if (reason) { status = 'failed'; output = null; }
      else { matched = node.config.join === 'AND' ? values.every(Boolean) : values.some(Boolean); if (!matched) { status = 'skipped'; output = null; reason = '条件未匹配'; } }
    } else if (node.kind === 'transform') {
      const value = input[node.config.field!];
      if (typeof value !== 'number' || !Number.isFinite(value)) { status = 'failed'; output = null; reason = `缺少数值字段 ${node.config.field}`; }
      else { const next = transform(node.config.expression!, value); if (!Number.isFinite(next)) { status = 'failed'; output = null; reason = '转换结果无效'; } else output = { ...input, [node.config.field!]: next }; }
    } else if (node.kind === 'alarm') output = { ...input, severity: node.config.severity, message: node.config.message };
    else if (node.kind === 'storage') output = { ...input, storedTo: node.config.target };
    else if (node.kind === 'notification') output = { ...input, simulatedChannel: node.config.channel, message: node.config.message };
    const trace: RuleTrace = { nodeId, kind: node.kind, status, input, output, durationMs, matched, ...(reason ? { reason } : {}) };
    traces.set(nodeId, trace);
    if (output) outputs.set(nodeId, output);
    for (const to of successors.get(nodeId)!) { indegree.set(to, indegree.get(to)! - 1); if (indegree.get(to) === 0) queue.push(to); }
  }
  const ordered = [...traces.values()];
  return { id, ruleId: flow.id, tenantId: flow.tenantId, deviceId: sample.deviceId, occurredAt: sample.occurredAt, mode,
    status: ordered.some(trace => trace.status === 'failed') ? 'failed' : ordered.some(trace => ACTIONS.includes(trace.kind) && trace.status === 'succeeded') ? 'succeeded' : 'skipped',
    traces: ordered, sample: clone(sample), alarmCreated: mode !== 'applied' ? false : ordered.some(trace => trace.kind === 'alarm' && trace.status === 'succeeded') };
}

export class RuleService {
  private flows = clone(seedRules);
  private logs: RuleExecution[] = [];
  private versions = clone(seedRules);
  private cases: RuleSampleCase[] = [];
  constructor(private storage: Storage | null = null) { this.sync(); }
  private sync() {
    if (!this.storage) return;
    try {
      const flows = this.storage.getItem(RULES_KEY), logs = this.storage.getItem(LOGS_KEY), versions = this.storage.getItem(VERSIONS_KEY), cases = this.storage.getItem(CASES_KEY);
      if (flows) { const parsed = JSON.parse(flows) as RuleFlow[]; if (Array.isArray(parsed) && parsed.every(item => item && typeof item.id === 'string' && Number.isInteger(item.version) && Array.isArray(item.nodes) && Array.isArray(item.edges))) this.flows = parsed.map(item => ({ ...item, createdAt: item.createdAt ?? FIXED_AT })); }
      if (logs) { const parsed = JSON.parse(logs) as RuleExecution[]; if (Array.isArray(parsed) && parsed.every(item => item && typeof item.id === 'string' && Array.isArray(item.traces))) this.logs = parsed; }
      if (versions) { const parsed = JSON.parse(versions) as RuleFlow[]; if (Array.isArray(parsed) && parsed.every(item => item && typeof item.id === 'string' && Number.isInteger(item.version) && Array.isArray(item.nodes) && Array.isArray(item.edges))) this.versions = parsed; }
      else if (flows) this.versions = [...clone(seedRules), ...this.flows.filter(item => !seedRules.some(seed => seed.id === item.id && seed.version === item.version)).map(clone)];
      if (cases) { const parsed = JSON.parse(cases) as RuleSampleCase[]; if (Array.isArray(parsed) && parsed.every(item => item && typeof item.id === 'string' && typeof item.ruleId === 'string' && item.sample?.properties)) this.cases = parsed; }
    } catch { /* Malformed local demo data falls back to the current session. */ }
  }
  private commit(notifyLogs = false) { try { this.storage?.setItem(RULES_KEY, JSON.stringify(this.flows)); this.storage?.setItem(LOGS_KEY, JSON.stringify(this.logs)); this.storage?.setItem(VERSIONS_KEY, JSON.stringify(this.versions)); this.storage?.setItem(CASES_KEY, JSON.stringify(this.cases)); if (notifyLogs && typeof window !== 'undefined') window.dispatchEvent(new Event('iot-atlas-mock-changed')); } catch { /* Keep session usable. */ } }
  private find(context: Context, id: string, mode: 'read' | 'run' | 'write'): RuleFlow | RuleError {
    this.sync();
    const flow = this.flows.find(item => item.id === id);
    const denied = authorize(context, flow?.tenantId ?? (context.role === 'platformAdmin' ? 'all' : context.tenantId), mode);
    if (denied) return denied;
    return flow ?? err('NOT_FOUND', '规则不存在');
  }
  samples(): RuleSample[] { return clone(seedSamples); }
  async sampleCases(context: Context, id: string): Promise<RuleResult<RuleSampleCase[]>> {
    const flow = this.find(context, id, 'read'); if ('error' in flow) return flow;
    return result(context, this.cases.filter(item => item.ruleId === id), `cases_${id}`);
  }
  async saveSampleCase(context: Context, id: string, name: string, sample: RuleSample): Promise<RuleResult<RuleSampleCase>> {
    const flow = this.find(context, id, 'run'); if ('error' in flow) return flow;
    if (!name?.trim() || name.trim().length > 80) return err('VALIDATION_ERROR', '样例名称须为 1–80 字符');
    const tested = await this.testRun(context, id, sample); if ('error' in tested) return tested;
    this.sync(); const prior = this.cases.filter(item => item.ruleId === id);
    if (prior.length >= 20 || prior.some(item => item.name === name.trim())) return err('CONFLICT', '样例名称重复或已达到 20 个上限');
    const saved: RuleSampleCase = { id: `case_${context.seed}_${id}_${prior.length + 1}`, ruleId: id, tenantId: flow.tenantId, name: name.trim(), sample: clone(sample), createdAt: FIXED_AT, actorId: context.actorId };
    this.cases.push(saved); this.commit(); return result(context, saved, saved.id);
  }
  async versionHistory(context: Context, id: string): Promise<RuleResult<RuleFlow[]>> {
    const flow = this.find(context, id, 'read'); if ('error' in flow) return flow;
    const snapshots = this.versions.filter(item => item.id === id).sort((a, b) => b.version - a.version);
    return result(context, snapshots.length ? snapshots : [flow], `versions_${id}`);
  }
  async compareVersions(context: Context, id: string, from: number, to: number): Promise<RuleResult<RuleVersionDiff>> {
    const history = await this.versionHistory(context, id); if ('error' in history) return history;
    const older = history.data.find(item => item.version === from), newer = history.data.find(item => item.version === to);
    if (!older || !newer || from >= to) return err('VALIDATION_ERROR', '请选择两个存在且递增的版本');
    const fields = (['name', 'productId', 'enabled', 'versionNote'] as const).filter(key => older[key] !== newer[key]);
    const oldNodes = new Map(older.nodes.map(item => [item.id, item])), newNodes = new Map(newer.nodes.map(item => [item.id, item]));
    const oldEdges = new Map(older.edges.map(item => [item.id, item])), newEdges = new Map(newer.edges.map(item => [item.id, item]));
    return result(context, { from, to, fields,
      addedNodes: newer.nodes.filter(item => !oldNodes.has(item.id)).map(item => item.id),
      removedNodes: older.nodes.filter(item => !newNodes.has(item.id)).map(item => item.id),
      changedNodes: newer.nodes.filter(item => oldNodes.has(item.id) && JSON.stringify(oldNodes.get(item.id)) !== JSON.stringify(item)).map(item => item.id),
      addedEdges: newer.edges.filter(item => !oldEdges.has(item.id)).map(item => item.id),
      removedEdges: older.edges.filter(item => !newEdges.has(item.id)).map(item => item.id) }, `diff_${id}_${from}_${to}`);
  }
  async list(context: Context, query: RuleListQuery): Promise<RuleResult<{ items: RuleSummary[]; total: number; page: number; pageSize: number }>> {
    this.sync(); const denied = authorize(context, query.tenantId, 'read'); if (denied) return denied;
    if (query.seed !== context.seed || !validPage(query.page, query.pageSize)) return err('VALIDATION_ERROR', '查询条件无效');
    await pause(context);
    const items = this.flows.filter(item => (query.tenantId === 'all' || item.tenantId === query.tenantId) && (!query.keyword || item.name.toLowerCase().includes(query.keyword.toLowerCase())) && (!query.productId || item.productId === query.productId) && (query.enabled === undefined || item.enabled === query.enabled)).sort((a, b) => a.id.localeCompare(b.id));
    const summaries = items.map(item => { const records = this.logs.filter(log => log.ruleId === item.id); return { id: item.id, tenantId: item.tenantId, productId: item.productId, name: item.name, enabled: item.enabled, version: item.version,
      recentExecution: records[0]?.occurredAt ?? null, successRate: records.length ? records.filter(log => log.status === 'succeeded').length / records.length : null }; });
    return result(context, { items: summaries.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: summaries.length, page: query.page, pageSize: query.pageSize }, `list_${query.page}`);
  }
  async get(context: Context, id: string): Promise<RuleResult<RuleFlow>> { const flow = this.find(context, id, 'read'); if ('error' in flow) return flow; await pause(context); return result(context, flow, id); }
  async save(context: Context, input: RuleInput, id?: string, expectedVersion?: number): Promise<RuleResult<RuleFlow>> {
    this.sync(); const existing = id ? this.flows.find(item => item.id === id) : undefined;
    const denied = authorize(context, existing?.tenantId ?? input.tenantId, 'write'); if (denied) return denied;
    if (id && !existing) return err('NOT_FOUND', '规则不存在');
    if (existing && input.tenantId !== existing.tenantId) return err('VALIDATION_ERROR', '不能迁移规则租户');
    if (input.tenantId === 'ten_202609_001' && input.productId !== 'prod_as_001' || input.tenantId === 'ten_202609_002' && input.productId !== 'prod_as_002') return err('VALIDATION_ERROR', '产品不属于所选租户');
    const issues = validateFlow(input);
    if (issues.length) return err('VALIDATION_ERROR', '规则图校验失败', Object.fromEntries(issues.map((issue, index) => [`${issue.nodeId ?? 'flow'}:${index}`, issue.message])));
    if (existing && expectedVersion !== existing.version) return err('CONFLICT', '规则版本已变化，请刷新', { version: '版本冲突' });
    await pause(context); this.sync();
    if (existing && this.flows.find(item => item.id === id)?.version !== expectedVersion) return err('CONFLICT', '规则版本已变化，请刷新', { version: '版本冲突' });
    const version = existing ? existing.version + 1 : 1;
    const next: RuleFlow = { ...clone(input), id: id ?? `rule_${context.seed}_${this.flows.length + 1}`, enabled: existing?.enabled ?? false, version, createdAt: existing?.createdAt ?? versionTime(1), updatedAt: versionTime(version) };
    if (existing) this.flows = this.flows.map(item => item.id === id ? next : item); else this.flows.push(next);
    this.versions.push(clone(next));
    this.commit(); return result(context, next, next.id);
  }
  async toggle(context: Context, id: string, enabled: boolean, expectedVersion: number): Promise<RuleResult<RuleFlow>> {
    const flow = this.find(context, id, 'write'); if ('error' in flow) return flow;
    if (flow.version !== expectedVersion) return err('CONFLICT', '规则版本已变化，请刷新');
    if (enabled) { const issues = validateFlow(flow); if (issues.length) return err('VALIDATION_ERROR', '规则尚未通过校验'); }
    await pause(context); this.sync(); const fresh = this.flows.find(item => item.id === id);
    if (!fresh || fresh.version !== expectedVersion) return err('CONFLICT', '规则版本已变化，请刷新');
    const next = { ...fresh, enabled, version: fresh.version + 1, updatedAt: versionTime(fresh.version + 1) };
    this.flows = this.flows.map(item => item.id === id ? next : item); this.versions.push(clone(next)); this.commit(); return result(context, next, id);
  }
  async testRun(context: Context, id: string, sample: RuleSample): Promise<RuleResult<RuleExecution>> {
    const flow = this.find(context, id, 'run'); if ('error' in flow) return flow;
    const issues = validateFlow(flow); if (issues.length) return err('VALIDATION_ERROR', '规则图校验失败', Object.fromEntries(issues.map((issue, index) => [`${issue.nodeId ?? 'flow'}:${index}`, issue.message])));
    if (sample.productId !== flow.productId || !validUtc(sample.occurredAt) || !sample.deviceId || !sample.properties || typeof sample.properties !== 'object') return err('VALIDATION_ERROR', '样例报文无效');
    await pause(context);
    return result(context, runGraph(flow, sample, `test_${context.seed}_${flow.id}_${sample.deviceId}`, 'event'), `test_${id}`);
  }
  async applySimulation(context: Context, id: string, sample: RuleSample, confirmed: boolean): Promise<RuleResult<RuleExecution>> {
    const flow = this.find(context, id, 'run'); if ('error' in flow) return flow;
    if (!confirmed) return err('VALIDATION_ERROR', '需明确确认应用模拟结果');
    const tested = await this.testRun(context, id, sample); if ('error' in tested) return tested;
    this.sync();
    const execution = { ...tested.data, id: `applied_${context.seed}_${this.logs.length + 1}`, mode: 'applied' as const };
    execution.alarmCreated = execution.traces.some(trace => trace.kind === 'alarm' && trace.status === 'succeeded');
    this.logs.unshift(execution); this.commit(true); return result(context, execution, execution.id);
  }
  async consumeEvent(context: Context, id: string, sample: RuleSample): Promise<RuleResult<RuleExecution | null>> {
    const flow = this.find(context, id, 'run'); if ('error' in flow) return flow;
    if (!flow.enabled) return result(context, null, `disabled_${id}`);
    if (this.logs.some(log => log.mode === 'event' && log.ruleId === id && log.deviceId === sample.deviceId && log.occurredAt === sample.occurredAt)) return result(context, null, `duplicate_${id}`);
    const tested = await this.testRun(context, id, sample); if ('error' in tested) return tested;
    this.sync();
    if (this.logs.some(log => log.mode === 'event' && log.ruleId === id && log.deviceId === sample.deviceId && log.occurredAt === sample.occurredAt)) return result(context, null, `duplicate_${id}`);
    const execution = { ...tested.data, id: `event_${context.seed}_${this.logs.length + 1}`, mode: 'event' as const };
    execution.alarmCreated = execution.traces.some(trace => trace.kind === 'alarm' && trace.status === 'succeeded');
    this.logs.unshift(execution); this.commit(true); return result(context, execution, execution.id);
  }
  async logsFor(context: Context, query: RuleLogQuery): Promise<RuleResult<{ items: RuleExecution[]; total: number; page: number; pageSize: number }>> {
    this.sync(); const denied = authorize(context, query.tenantId, 'read'); if (denied) return denied;
    if (query.seed !== context.seed || !validPage(query.page, query.pageSize) || (query.from && !validUtc(query.from)) || (query.to && !validUtc(query.to)) || (query.from && query.to && query.from > query.to)) return err('VALIDATION_ERROR', '日志查询条件无效');
    await pause(context);
    const items = this.logs.filter(item => (query.tenantId === 'all' || item.tenantId === query.tenantId) && (!query.ruleId || item.ruleId === query.ruleId) && (!query.deviceId || item.deviceId.includes(query.deviceId)) && (!query.status || item.status === query.status) && (!query.from || item.occurredAt >= query.from) && (!query.to || item.occurredAt <= query.to)).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
    return result(context, { items: items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize }, `logs_${query.page}`);
  }
}
export const rules = new RuleService(typeof localStorage === 'undefined' ? null : localStorage);
