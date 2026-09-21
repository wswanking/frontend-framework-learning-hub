// IOT-PLATFORM-001 / IOT-PLATFORM-002 / IOT-RELEASE-001.
// Local demonstration records are independent of real repository approval or deployment.
export type DeliveryKind = 'requirement' | 'task' | 'issue' | 'review' | 'release' | 'change';
export type DeliveryRole = 'contributor' | 'productOwner' | 'techLead' | 'releaseLead';
export type DeliveryActor = { id: string; role: DeliveryRole };
export type DeliveryStatus = 'draft' | 'pending' | 'inProgress' | 'blocked' | 'done' | 'approved' | 'rejected' | 'needsChanges' | 'waived';
export type DeliveryPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type DeliveryRecord = {
  id: string; kind: DeliveryKind; title: string; status: DeliveryStatus; priority: DeliveryPriority;
  phase: string; owner: string; requirementIds: string[]; description: string; acceptance: string[];
  evidence: string[]; risk: string; updatedAt: string; revision: number;
  history: { revision: number; actorId: string; action: string; at: string; previous?: string }[];
};
export type DeliveryIssue = DeliveryRecord & { kind: 'issue'; severity: 'critical' | 'high' | 'medium' | 'low'; resolution?: string };
export type DeliveryReview = DeliveryRecord & { kind: 'review'; reviewerId: string; reviewerRole: Exclude<DeliveryRole, 'contributor'>; verdict?: 'approved' | 'rejected' | 'needsChanges' | 'waived'; reason?: string; decidedAt?: string };
export type ReleaseEnvironment = 'local' | 'preview' | 'production';
export type DeliveryRelease = DeliveryRecord & { kind: 'release'; environment: ReleaseEnvironment; version: string; previousVersion: string; changeSummary: string; testEvidence: string[]; rollbackSteps: string; knownRisks: string[]; publishedAt?: string; rollback?: { at: string; reason: string; toVersion: string; verification: string } };
export type DeliveryEntry = DeliveryRecord | DeliveryIssue | DeliveryReview | DeliveryRelease;
export type DeliveryFilter = { kind: DeliveryKind; status?: DeliveryStatus; priority?: DeliveryPriority; phase?: string; owner?: string; requirementId?: string; keyword?: string; page: number; pageSize: number };
export type DeliveryError = { error: { code: 'FORBIDDEN' | 'VALIDATION_ERROR' | 'CONFLICT' | 'NOT_FOUND'; message: string; fields?: Record<string, string> } };
export type DeliveryResult<T> = { data: T } | DeliveryError;
export type ReleaseCheck = { ready: boolean; passed: string[]; warnings: string[]; blocked: string[] };

const AT = '2026-09-20T00:00:00.000Z';
const KEY = 'iot-atlas-delivery-v1';
const clone = <T>(value: T): T => structuredClone(value);
const err = (code: DeliveryError['error']['code'], message: string, fields?: Record<string, string>): DeliveryError => ({ error: { code, message, ...(fields ? { fields } : {}) } });
const ok = <T>(data: T): DeliveryResult<T> => ({ data: clone(data) });
const base = (id: string, kind: DeliveryKind, title: string, status: DeliveryStatus, priority: DeliveryPriority, requirementIds: string[], description: string): DeliveryRecord => ({ id, kind, title, status, priority, phase: '实施', owner: '待指定', requirementIds, description, acceptance: [], evidence: [], risk: '', updatedAt: AT, revision: 1, history: [{ revision: 1, actorId: 'seed', action: '记录当前事实', at: AT }] });
const seed: DeliveryEntry[] = [
  base('IOT-QUALITY-001', 'requirement', '独立诊断与验收环境', 'inProgress', 'P0', ['IOT-QUALITY-001'], '三端诊断环境已建立；完整业务验收仍未完成。'),
  base('IOT-DOMAIN-001', 'requirement', '领域与 Mock 契约', 'inProgress', 'P0', ['IOT-DOMAIN-001'], '当前业务服务分端实现，领域契约仍待最终审核。'),
  base('IOT-DASH-001', 'requirement', '数据大盘', 'inProgress', 'P0', ['IOT-DASH-001'], '三端页面与 Mock 增量通过现有自动化；完整交互验收未完成。'),
  base('IOT-GEO-001', 'requirement', '全球节点与地理', 'inProgress', 'P1', ['IOT-GEO-001'], '三端页面与 Mock 增量通过现有自动化；完整交互验收未完成。'),
  base('IOT-PRODUCT-001', 'requirement', '产品、物模型与 DP', 'inProgress', 'P1', ['IOT-PRODUCT-001'], '三端页面与 Mock 增量通过现有自动化；完整交互验收未完成。'),
  base('IOT-DEVICE-001', 'requirement', '设备、时序与控制', 'inProgress', 'P1', ['IOT-DEVICE-001'], '三端已实现浏览器 Mock 导入、删除、消息、告警、影子与控制；V2 交互审核及最终验收未完成。'),
  base('IOT-RULE-001', 'requirement', '规则引擎', 'inProgress', 'P1', ['IOT-RULE-001'], '三端已实现浏览器 Mock 事件消费、样例保存与版本比较；独立后台流和最终验收未完成。'),
  base('IOT-FIRMWARE-001', 'requirement', '固件文件管理', 'inProgress', 'P1', ['IOT-FIRMWARE-001'], '三端本地文件元数据与状态流转已实现；完整交互验收未完成。'),
  base('IOT-OTA-001', 'requirement', 'OTA 升级演示', 'inProgress', 'P1', ['IOT-OTA-001'], '三端任务 Mock 与页面增量已实现；完整趋势与最终验收未完成。'),
  base('IOT-TENANT-001', 'requirement', '租户、成员与配额', 'inProgress', 'P1', ['IOT-TENANT-001'], '三端 Mock 与页面增量已实现；关键权限冲突和最终验收仍待处理。'),
  base('IOT-PLATFORM-003', 'requirement', '三端独立工程', 'inProgress', 'P0', ['IOT-PLATFORM-003'], '独立构建、边界检查与脱仓安装诊断已验证；实验室选型和验收仍待完成。'),
  base('IOT-LEARNING-001', 'requirement', '三框架组件与图表实验室', 'inProgress', 'P2', ['IOT-LEARNING-001'], '三端实验室已有主库、候选库与图表 Mock；Angular PrimeNG 许可、正式选型及验收仍待完成。'),
  base('IOT-PLATFORM-001', 'requirement', '工程治理与交付追溯', 'inProgress', 'P0', ['IOT-PLATFORM-001'], '交付治理需求正在实现，当前页面与数据仅为本地 Mock。'),
  base('IOT-PLATFORM-002', 'requirement', '任务、Issue 与审核看板', 'inProgress', 'P0', ['IOT-PLATFORM-002'], '交付治理需求正在实现，当前页面与数据仅为本地 Mock。'),
  base('IOT-PLATFORM-004', 'requirement', 'AI 协作与变更留痕', 'pending', 'P0', ['IOT-PLATFORM-004'], '变更留痕流程尚待完整实现。'),
  base('IOT-RELEASE-001', 'requirement', '发布、回滚与验收', 'pending', 'P1', ['IOT-RELEASE-001'], '目前尚无正式发布和已批准回滚基线。'),
  { ...base('ISSUE-20260920-001', 'issue', '租户管理员成员权限契约冲突', 'blocked', 'P1', ['IOT-TENANT-001'], '总 PRD 允许管理本租户成员，权限契约仅允许查看；待用户决定。'), kind: 'issue', severity: 'high' },
  { ...base('ISSUE-20260920-002', 'issue', 'Angular PrimeNG 候选缺少许可证密钥', 'blocked', 'P2', ['IOT-LEARNING-001'], '下载量候选 PrimeNG 22 需要许可证密钥；当前使用 NG-ZORRO 替代原型，待 REVIEW-004 确定正式选型。'), kind: 'issue', severity: 'medium' },
  { ...base('REVIEW-001', 'review', '工程治理与 AI 协作审核', 'pending', 'P0', ['IOT-PLATFORM-001', 'IOT-PLATFORM-002', 'IOT-PLATFORM-004'], '变更与验收留痕流程尚无审核结论。'), kind: 'review', reviewerId: 'product-lead', reviewerRole: 'productOwner' },
  { ...base('REVIEW-002', 'review', 'Dashboard 与地理交互审核', 'pending', 'P0', ['IOT-DASH-001', 'IOT-GEO-001'], 'V2 运行态候选图已生成，逐项视觉与交互结论尚未记录。'), kind: 'review', reviewerId: 'product-lead', reviewerRole: 'productOwner' },
  { ...base('REVIEW-003', 'review', '领域契约与业务交互审核', 'pending', 'P0', ['IOT-DOMAIN-001', 'IOT-PRODUCT-001', 'IOT-DEVICE-001', 'IOT-RULE-001', 'IOT-FIRMWARE-001', 'IOT-OTA-001', 'IOT-TENANT-001'], '领域、权限和业务交互尚无审核结论。'), kind: 'review', reviewerId: 'tech-lead', reviewerRole: 'techLead' },
  { ...base('REVIEW-004', 'review', '实验室依赖与排行审核', 'pending', 'P2', ['IOT-LEARNING-001'], '组件库候选与测量已记录；Angular PrimeNG 许可证和正式 Top 3 选择尚未决定。'), kind: 'review', reviewerId: 'tech-lead', reviewerRole: 'techLead' },
  { ...base('REVIEW-005', 'review', '正式发布与回滚审核', 'pending', 'P1', ['IOT-RELEASE-001'], '尚无发布批准。'), kind: 'review', reviewerId: 'release-lead', reviewerRole: 'releaseLead' },
];

const isIssue = (row: DeliveryEntry): row is DeliveryIssue => row.kind === 'issue';
const isReview = (row: DeliveryEntry): row is DeliveryReview => row.kind === 'review';
const isRelease = (row: DeliveryEntry): row is DeliveryRelease => row.kind === 'release';

export class DeliveryService {
  private rows: DeliveryEntry[] = clone(seed);
  constructor(private storage: Storage | null = null) { this.sync(); }
  private sync() {
    if (!this.storage) return;
    try {
      const saved: unknown = JSON.parse(this.storage.getItem(KEY) ?? 'null');
      if (!Array.isArray(saved) || !saved.every(row => row && typeof row.id === 'string' && typeof row.kind === 'string' && Number.isInteger(row.revision))) return;
      const rows = saved as DeliveryEntry[];
      const seeded = new Map(seed.map(row => [row.id, row]));
      this.rows = [
        ...rows.map(row => row.revision === 1 && row.history?.length === 1 && row.history[0]?.actorId === 'seed' && seeded.has(row.id) ? clone(seeded.get(row.id)!) : row),
        ...seed.filter(row => !rows.some(savedRow => savedRow.id === row.id)).map(clone),
      ];
    } catch { /* Keep local demo usable. */ }
  }
  private commit() { try { this.storage?.setItem(KEY, JSON.stringify(this.rows)); } catch { /* Keep local demo usable. */ } }
  private next(prefix: string) { const count = this.rows.filter(row => row.id.startsWith(`${prefix}-20260920-`)).length + 1; return `${prefix}-20260920-${String(count).padStart(3, '0')}`; }
  list(filter: DeliveryFilter): DeliveryResult<{ items: DeliveryEntry[]; total: number; page: number; pageSize: number }> {
    this.sync(); if (!Number.isInteger(filter.page) || filter.page < 1 || !Number.isInteger(filter.pageSize) || filter.pageSize < 1 || filter.pageSize > 100) return err('VALIDATION_ERROR', '分页条件无效');
    const rows = this.rows.filter(row => row.kind === filter.kind && (!filter.status || row.status === filter.status) && (!filter.priority || row.priority === filter.priority) && (!filter.phase || row.phase === filter.phase) && (!filter.owner || row.owner === filter.owner) && (!filter.requirementId || row.requirementIds.includes(filter.requirementId)) && (!filter.keyword || `${row.id} ${row.title} ${row.description}`.toLowerCase().includes(filter.keyword.toLowerCase()))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    return ok({ items: rows.slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize), total: rows.length, page: filter.page, pageSize: filter.pageSize });
  }
  get(id: string): DeliveryResult<DeliveryEntry> { this.sync(); const row = this.rows.find(item => item.id === id); return row ? ok(row) : err('NOT_FOUND', '记录不存在'); }
  trace(id: string): DeliveryResult<{ source: DeliveryEntry; related: DeliveryEntry[] }> { this.sync(); const source = this.rows.find(row => row.id === id); if (!source) return err('NOT_FOUND', '记录不存在'); const ids = new Set([source.id, ...source.requirementIds]); return ok({ source, related: this.rows.filter(row => row.id !== id && row.requirementIds.some(requirementId => ids.has(requirementId))) }); }
  save(actor: DeliveryActor, input: DeliveryRecord | DeliveryIssue, expectedRevision?: number): DeliveryResult<DeliveryEntry> {
    this.sync(); const current = this.rows.find(row => row.id === input.id);
    if (current && current.revision !== expectedRevision) return err('CONFLICT', '记录版本已变化，请刷新');
    if (current && current.kind !== input.kind) return err('VALIDATION_ERROR', '记录类型不可修改');
    if (input.kind === 'review' || input.kind === 'release' || input.kind === 'change') return err('FORBIDDEN', '请使用专用审核或发布操作');
    if (input.kind === 'requirement' && input.status === 'approved' && actor.role !== 'productOwner') return err('FORBIDDEN', '需求批准仅限产品负责人');
    if (input.kind === 'requirement' && input.status === 'approved' && !this.rows.some(row => isReview(row) && row.requirementIds.includes(input.id) && row.status === 'approved')) return err('CONFLICT', '缺少已通过的关联审核');
    if (input.kind === 'task' && input.status === 'inProgress' && !input.requirementIds.length) return err('VALIDATION_ERROR', '任务缺少关联需求，不能进入进行中', { requirementIds: '请选择需求编号' });
    if (input.kind !== 'requirement' && input.requirementIds.some(id => !this.rows.some(row => row.kind === 'requirement' && row.id === id))) return err('VALIDATION_ERROR', '关联需求不存在', { requirementIds: '请选择已有需求' });
    if (input.kind === 'requirement' && (!/^IOT-[A-Z]+-\d{3}$/.test(input.id) || !input.title.trim())) return err('VALIDATION_ERROR', '需求编号或标题无效');
    if (input.kind === 'issue' && !['productOwner', 'techLead'].includes(actor.role)) {
      const issue = input as DeliveryIssue;
      const highBefore = !!current && isIssue(current) && ['critical', 'high'].includes(current.severity);
      const highAfter = ['critical', 'high'].includes(issue.severity);
      if (highBefore && isIssue(current) && issue.severity !== current.severity) return err('FORBIDDEN', '高严重度 Issue 等级仅限负责人修改');
      if ((highBefore || highAfter) && ['done', 'waived'].includes(issue.status)) return err('FORBIDDEN', '高严重度 Issue 关闭或豁免仅限负责人');
    }
    if (input.kind === 'issue' && input.status === 'waived' && !['productOwner', 'techLead'].includes(actor.role)) return err('FORBIDDEN', 'Issue 豁免仅限负责人');
    if (input.kind === 'issue' && ['done', 'waived'].includes(input.status) && !(input as DeliveryIssue).resolution?.trim()) return err('VALIDATION_ERROR', '关闭或豁免 Issue 须记录处理结论');
    if (!input.title.trim()) return err('VALIDATION_ERROR', '标题不能为空');
    const scopeChanged = !!current && current.kind === 'requirement' && current.status === 'approved' && input.kind === 'requirement' && [current.title, current.description, current.priority, JSON.stringify(current.acceptance), JSON.stringify(current.requirementIds)].some((value, index) => value !== [input.title, input.description, input.priority, JSON.stringify(input.acceptance), JSON.stringify(input.requirementIds)][index]);
    if (scopeChanged && actor.role !== 'productOwner') return err('FORBIDDEN', '已批准需求的范围变更仅限产品负责人');
    const phaseChanged = !!current && current.phase !== input.phase;
    const missing = input.kind === 'requirement' && (!input.description.trim() || !input.acceptance.length || !input.owner.trim());
    const revision = (current?.revision ?? 0) + 1;
    const row = { ...clone(input), status: missing ? 'draft' as const : scopeChanged ? 'pending' as const : input.status, revision, updatedAt: AT, history: [...(current?.history ?? []), { revision, actorId: actor.id, action: current ? '更新记录' : '创建记录', at: AT, ...(current ? { previous: JSON.stringify({ ...current, history: undefined }) } : {}) }] } as DeliveryEntry;
    this.rows = current ? this.rows.map(item => item.id === row.id ? row : item) : [...this.rows, row];
    if (scopeChanged) this.rows = this.rows.map(item => isReview(item) && item.requirementIds.includes(row.id) && ['approved', 'waived'].includes(item.status) ? { ...item, status: 'pending', verdict: undefined, reason: undefined, decidedAt: undefined, revision: item.revision + 1, updatedAt: AT, history: [...item.history, { revision: item.revision + 1, actorId: actor.id, action: '需求范围变更，退回待审核', at: AT, previous: JSON.stringify({ ...item, history: undefined }) }] } : item);
    if (scopeChanged || phaseChanged) {
      const change = base(this.next('CHG'), 'change', `${row.id} 变更记录`, 'done', row.priority, [row.id], scopeChanged ? '已批准需求范围变更，退回待审核' : `阶段变更：${current?.phase ?? '新建'} → ${row.phase}`);
      change.owner = actor.id; change.phase = row.phase; change.evidence = [`${row.id}#${revision}`];
      change.history = [{ revision: 1, actorId: actor.id, action: '创建变更记录', at: AT }];
      this.rows.push(change);
    }
    this.commit(); return ok(row);
  }
  createTask(actor: DeliveryActor, input: Pick<DeliveryRecord, 'title' | 'requirementIds' | 'owner' | 'priority' | 'description'>): DeliveryResult<DeliveryEntry> { return this.save(actor, { ...base(this.next('TASK'), 'task', input.title, 'draft', input.priority, input.requirementIds, input.description), owner: input.owner }); }
  createIssue(actor: DeliveryActor, input: Pick<DeliveryIssue, 'title' | 'requirementIds' | 'owner' | 'priority' | 'description' | 'severity'>): DeliveryResult<DeliveryEntry> { return this.save(actor, { ...base(this.next('ISSUE'), 'issue', input.title, 'pending', input.priority, input.requirementIds, input.description), kind: 'issue', owner: input.owner, severity: input.severity }); }
  decideReview(actor: DeliveryActor, id: string, verdict: DeliveryReview['verdict'], reason: string, expectedRevision: number): DeliveryResult<DeliveryReview> {
    this.sync(); const row = this.rows.find(item => item.id === id); if (!row || !isReview(row)) return err('NOT_FOUND', '审核项不存在');
    if (actor.id !== row.reviewerId || actor.role !== row.reviewerRole) return err('FORBIDDEN', '仅指定审核人可记录结论');
    if (row.revision !== expectedRevision) return err('CONFLICT', '审核项版本已变化');
    if (!reason.trim() || !verdict) return err('VALIDATION_ERROR', '审核结论和原因必填');
    const next: DeliveryReview = { ...row, status: verdict, verdict, reason: reason.trim(), decidedAt: AT, updatedAt: AT, revision: row.revision + 1, history: [...row.history, { revision: row.revision + 1, actorId: actor.id, action: `审核${verdict}`, at: AT, previous: JSON.stringify({ ...row, history: undefined }) }] };
    this.rows = this.rows.map(item => item.id === id ? next : item); this.commit(); return ok(next);
  }
  checkRelease(input: Pick<DeliveryRelease, 'environment' | 'version' | 'previousVersion' | 'changeSummary' | 'testEvidence' | 'rollbackSteps' | 'requirementIds'>): ReleaseCheck {
    this.sync(); const passed: string[] = [], warnings: string[] = [], blocked: string[] = [];
    if (!input.version.trim()) blocked.push('缺少目标版本'); else passed.push('目标版本已填写');
    if (!input.requirementIds.length || input.requirementIds.some(id => !this.rows.some(row => row.kind === 'requirement' && row.id === id))) blocked.push('缺少有效的关联需求'); else passed.push('关联需求已填写');
    if (!input.changeSummary.trim()) blocked.push('缺少变更摘要'); else passed.push('变更摘要已填写');
    if (!input.testEvidence.length) blocked.push('缺少可复验的构建与测试证据'); else passed.push('已关联测试证据');
    if (!input.rollbackSteps.trim() || !input.previousVersion.trim()) blocked.push('缺少回滚步骤或上一已验证版本'); else passed.push('回滚材料已填写');
    const high = this.rows.filter(row => isIssue(row) && ['critical', 'high'].includes(row.severity) && !['done', 'waived'].includes(row.status));
    if (high.length) (input.environment === 'production' ? blocked : warnings).push(`未关闭的高严重度 Issue：${high.map(row => row.id).join('、')}`); else passed.push('无未关闭的高严重度 Issue');
    const unapproved = input.requirementIds.filter(id => this.rows.some(row => row.kind === 'requirement' && row.id === id && row.status !== 'approved'));
    if (unapproved.length) (input.environment === 'production' ? blocked : warnings).push(`关联需求未批准：${unapproved.join('、')}`);
    const reviews = this.rows.filter(isReview);
    const missingReview = input.requirementIds.filter(id => !reviews.some(row => row.requirementIds.includes(id)));
    if (missingReview.length) (input.environment === 'production' ? blocked : warnings).push(`关联需求缺少审核：${missingReview.join('、')}`);
    const pending = reviews.filter(row => row.requirementIds.some(id => input.requirementIds.includes(id)) && row.status !== 'approved' && row.status !== 'waived');
    if (pending.length) (input.environment === 'production' ? blocked : warnings).push(`关联审核未通过：${pending.map(row => row.id).join('、')}`);
    if (!missingReview.length && !pending.length) passed.push('关联审核已有结论');
    const releaseReview = reviews.find(row => row.id === 'REVIEW-005');
    if (!releaseReview || !['approved', 'waived'].includes(releaseReview.status)) (input.environment === 'production' ? blocked : warnings).push('正式发布审核未通过：REVIEW-005');
    else passed.push('正式发布审核已有结论');
    if (input.environment !== 'production') warnings.push('预览与本地记录不代表正式发布');
    return { ready: blocked.length === 0, passed, warnings, blocked };
  }
  createRelease(actor: DeliveryActor, input: Omit<DeliveryRelease, 'id' | 'kind' | 'revision' | 'updatedAt' | 'publishedAt'>): DeliveryResult<DeliveryRelease> {
    this.sync(); if (actor.role !== 'releaseLead') return err('FORBIDDEN', '仅发布负责人可创建发布记录');
    const check = this.checkRelease(input);
    const status: DeliveryStatus = input.environment === 'production' && !check.ready ? 'blocked' : 'draft';
    const row: DeliveryRelease = { ...clone(input), id: this.next('REL'), kind: 'release', status, revision: 1, updatedAt: AT, history: [{ revision: 1, actorId: actor.id, action: '创建发布记录', at: AT }] };
    this.rows.push(row); this.commit(); return ok(row);
  }
  updateRelease(actor: DeliveryActor, id: string, input: Omit<DeliveryRelease, 'id' | 'kind' | 'revision' | 'updatedAt' | 'publishedAt'>, expectedRevision: number): DeliveryResult<DeliveryRelease> {
    this.sync(); const row = this.rows.find(item => item.id === id); if (!row || !isRelease(row)) return err('NOT_FOUND', '发布记录不存在');
    if (actor.role !== 'releaseLead') return err('FORBIDDEN', '仅发布负责人可更新发布材料');
    if (row.revision !== expectedRevision) return err('CONFLICT', '发布记录版本已变化');
    if (row.status === 'done' || row.rollback) return err('CONFLICT', '已发布或已回滚记录不可修改');
    const candidate: DeliveryRelease = { ...row, ...clone(input), id: row.id, kind: 'release', revision: row.revision, history: row.history, publishedAt: row.publishedAt, rollback: row.rollback };
    const check = this.checkRelease(candidate);
    const next: DeliveryRelease = { ...candidate, status: candidate.environment === 'production' && !check.ready ? 'blocked' : 'draft', revision: row.revision + 1, updatedAt: AT, history: [...row.history, { revision: row.revision + 1, actorId: actor.id, action: '更新发布材料', at: AT, previous: JSON.stringify({ ...row, history: undefined }) }] };
    this.rows = this.rows.map(item => item.id === id ? next : item); this.commit(); return ok(next);
  }
  publish(actor: DeliveryActor, id: string, expectedRevision: number): DeliveryResult<DeliveryRelease> {
    this.sync(); const row = this.rows.find(item => item.id === id); if (!row || !isRelease(row)) return err('NOT_FOUND', '发布记录不存在');
    if (actor.role !== 'releaseLead') return err('FORBIDDEN', '仅发布负责人可标记发布');
    if (row.revision !== expectedRevision) return err('CONFLICT', '发布记录版本已变化');
    const check = this.checkRelease(row); if (!check.ready) return err('CONFLICT', `发布阻塞：${check.blocked.join('；')}`);
    const next: DeliveryRelease = { ...row, status: 'done', publishedAt: AT, updatedAt: AT, revision: row.revision + 1, history: [...row.history, { revision: row.revision + 1, actorId: actor.id, action: '标记模拟发布', at: AT, previous: JSON.stringify({ ...row, history: undefined }) }] };
    this.rows = this.rows.map(item => item.id === id ? next : item); this.commit(); return ok(next);
  }
  rollback(actor: DeliveryActor, id: string, reason: string, verification: string, expectedRevision: number): DeliveryResult<DeliveryRelease> {
    this.sync(); const row = this.rows.find(item => item.id === id); if (!row || !isRelease(row)) return err('NOT_FOUND', '发布记录不存在');
    if (actor.role !== 'releaseLead') return err('FORBIDDEN', '仅发布负责人可记录回滚');
    if (row.revision !== expectedRevision) return err('CONFLICT', '发布记录版本已变化');
    if (row.status !== 'done' || !row.previousVersion.trim() || !reason.trim() || !verification.trim()) return err('VALIDATION_ERROR', '仅已发布版本可回滚到上一已验证版本，须记录原因与复验结果');
    const next: DeliveryRelease = { ...row, status: 'blocked', rollback: { at: AT, reason: reason.trim(), toVersion: row.previousVersion, verification: verification.trim() }, updatedAt: AT, revision: row.revision + 1, history: [...row.history, { revision: row.revision + 1, actorId: actor.id, action: '记录模拟回滚', at: AT, previous: JSON.stringify({ ...row, history: undefined }) }] };
    this.rows = this.rows.map(item => item.id === id ? next : item); this.commit(); return ok(next);
  }
}

export const delivery = new DeliveryService(typeof localStorage === 'undefined' ? null : localStorage);
