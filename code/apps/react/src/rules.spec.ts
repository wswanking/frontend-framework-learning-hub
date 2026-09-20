import { describe, expect, it } from 'vitest';
import type { Context } from './dashboard';
import { RuleService, validateFlow, type RuleInput, type RuleNode } from './rules';

const admin: Context = { actorId: 'usr_202609_001', role: 'platformAdmin', tenantId: 'all', seed: 42, scenario: 'normal' };
const tenant: Context = { ...admin, role: 'tenantAdmin', tenantId: 'ten_202609_001' };
const operator: Context = { ...tenant, role: 'operator' };
const viewer: Context = { ...tenant, role: 'viewer' };
const sample = { deviceId: 'dev_as_001', productId: 'prod_as_001', occurredAt: '2026-09-16T12:00:00.000Z', properties: { temperature: 82.4, humidity: 41.2 } };
const input = (): RuleInput => ({
  tenantId: 'ten_202609_001', productId: 'prod_as_001', name: '测试高温规则', versionNote: '初版',
  nodes: [
    { id: 't', kind: 'trigger', name: '触发', x: 0, y: 0, config: { field: 'temperature' } },
    { id: 'c', kind: 'condition', name: '判断', x: 100, y: 0, config: { join: 'AND', clauses: [{ field: 'temperature', operator: '>', threshold: 75 }] } },
    { id: 'a', kind: 'alarm', name: '告警', x: 200, y: 0, config: { severity: 'critical', message: '温度过高' } },
  ],
  edges: [{ id: 'e1', from: 't', to: 'c' }, { id: 'e2', from: 'c', to: 'a' }],
});
const service = () => new RuleService();
const listQuery = { tenantId: 'all', page: 1, pageSize: 10, seed: 42 };
const logQuery = { tenantId: 'all', page: 1, pageSize: 10, seed: 42 };

describe('IOT-RULE-001 graph and execution contract', () => {
  it('lists tenant-scoped summaries and checks read and write rights first', async () => {
    const current = service();
    expect(await current.list(admin, listQuery)).toMatchObject({ data: { total: 2 } });
    expect(await current.list(tenant, { ...listQuery, tenantId: tenant.tenantId })).toMatchObject({ data: { total: 1, items: [{ id: 'rule_high_temp' }] } });
    expect(await current.list(viewer, listQuery)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.get(viewer, 'rule_low_battery')).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.save(operator, input())).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.testRun(viewer, 'rule_high_temp', sample)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.list(admin, { ...listQuery, page: 0 })).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('locates cycles, orphan nodes, incompatible edges and missing actions before save', async () => {
    const current = service(), draft = input();
    expect(validateFlow(draft)).toEqual([]);
    draft.nodes.push({ id: 'x', kind: 'transform', name: '转换', x: 100, y: 100, config: { field: 'temperature', expression: 'x+1' } });
    draft.edges.push({ id: 'e3', from: 'c', to: 'x' }, { id: 'e4', from: 'x', to: 'c' });
    expect(validateFlow(draft)).toEqual(expect.arrayContaining([expect.objectContaining({ nodeId: 'c', code: 'CYCLE' }), expect.objectContaining({ nodeId: 'x', code: 'CYCLE' })]));
    expect(await current.save(tenant, draft)).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: expect.any(Object) } });
    draft.edges.pop(); draft.edges.pop();
    expect(validateFlow(draft)).toEqual(expect.arrayContaining([expect.objectContaining({ nodeId: 'x', code: 'ISOLATED' })]));
    draft.nodes.pop();
    draft.edges.push({ id: 'e3', from: 'a', to: 't' });
    expect(validateFlow(draft)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_EDGE' })]));
    draft.edges.pop(); draft.nodes.pop(); draft.edges.pop();
    expect(validateFlow(draft)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'MISSING_ACTION' })]));
  });

  it('validates condition groups, safe expressions and node configuration', async () => {
    const draft = input();
    draft.nodes[1].config = { join: 'OR', clauses: [{ field: 'temperature', operator: '>', threshold: 75 }, { field: 'humidity', operator: '<', threshold: 20 }] };
    const converted: RuleNode = { id: 'x', kind: 'transform', name: '转换', x: 150, y: 0, config: { field: 'temperature', expression: 'x*2' } };
    draft.nodes.push(converted); draft.edges[1].from = 'x'; draft.edges.push({ id: 'e3', from: 'c', to: 'x' });
    expect(validateFlow(draft)).toEqual([]);
    converted.config.expression = 'alert(1)';
    expect(validateFlow(draft)).toEqual(expect.arrayContaining([expect.objectContaining({ nodeId: 'x', code: 'INVALID_EXPRESSION' })]));
    converted.config.expression = 'x*2'; draft.nodes[1].config.join = 'BAD' as 'AND';
    expect(validateFlow(draft)).toEqual(expect.arrayContaining([expect.objectContaining({ nodeId: 'c', code: 'INVALID_CONFIG' })]));
  });

  it('returns ordered trace inputs and outputs without changing devices or logs', async () => {
    const current = service();
    const run = await current.testRun(operator, 'rule_high_temp', sample);
    expect(run).toMatchObject({ data: { status: 'succeeded', alarmCreated: false, traces: [
      { nodeId: 'trigger_1', status: 'succeeded', input: { temperature: 82.4 } },
      { nodeId: 'condition_1', status: 'succeeded', matched: true },
      { nodeId: 'alarm_1', status: 'succeeded', output: { severity: 'critical' } },
      { nodeId: 'storage_1', status: 'succeeded', output: { storedTo: 'iot_atlas' } },
    ] } });
    expect(await current.logsFor(operator, { ...logQuery, tenantId: tenant.tenantId })).toMatchObject({ data: { total: 0 } });
    const below = await current.testRun(operator, 'rule_high_temp', { ...sample, properties: { temperature: 20 } });
    expect(below).toMatchObject({ data: { status: 'skipped', traces: [{}, { status: 'skipped' }, { status: 'skipped' }, { status: 'skipped' }] } });
    expect(await current.testRun(operator, 'rule_high_temp', { ...sample, properties: {} })).toMatchObject({ data: { status: 'failed', traces: [
      { status: 'failed', reason: expect.stringContaining('temperature') }, { status: 'skipped' }, { status: 'skipped' }, { status: 'skipped' },
    ] } });
  });

  it('keeps disabled events out of logs and requires confirmation to apply a test', async () => {
    const current = service(), gateway = { deviceId: 'dev_as_002', productId: 'prod_as_002', occurredAt: sample.occurredAt, properties: { voltage: 220 } };
    expect(await current.consumeEvent(admin, 'rule_low_battery', gateway)).toMatchObject({ data: null });
    expect(await current.logsFor(admin, logQuery)).toMatchObject({ data: { total: 0 } });
    expect(await current.applySimulation(operator, 'rule_high_temp', sample, false)).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await current.applySimulation(operator, 'rule_high_temp', sample, true)).toMatchObject({ data: { mode: 'applied', alarmCreated: true } });
    expect(await current.logsFor(admin, { ...logQuery, ruleId: 'rule_high_temp', deviceId: 'dev_as_001', status: 'succeeded' })).toMatchObject({ data: { total: 1 } });
  });

  it('saves with version checks and runs enabled events deterministically', async () => {
    const current = service();
    const created = await current.save(tenant, input());
    expect(created).toMatchObject({ data: { enabled: false, version: 1, createdAt: expect.any(String) } });
    if ('error' in created) throw new Error(created.error.message);
    const id = created.data.id;
    expect(await current.toggle(operator, id, true, 1)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.toggle(tenant, id, true, 1)).toMatchObject({ data: { enabled: true, version: 2 } });
    expect(await current.save(tenant, input(), id, 1)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await current.consumeEvent(operator, id, sample)).toMatchObject({ data: { status: 'succeeded', alarmCreated: true } });
    expect(await current.logsFor(tenant, { ...logQuery, tenantId: tenant.tenantId, ruleId: id })).toMatchObject({ data: { total: 1 } });
  });

  it('marks expression timeout and action failure on their nodes', async () => {
    const current = service();
    const draft = input();
    draft.nodes[1].config.simulateTimeout = true;
    draft.nodes[2].config.simulateFailure = true;
    const saved = await current.save(tenant, draft);
    if ('error' in saved) throw new Error(saved.error.message);
    expect(await current.testRun(operator, saved.data.id, sample)).toMatchObject({ data: { status: 'failed', traces: [{}, { nodeId: 'c', status: 'failed', reason: expect.stringContaining('超时') }, { nodeId: 'a', status: 'skipped' }] } });
    draft.nodes[1].config.simulateTimeout = false;
    expect(await current.save(tenant, draft, saved.data.id, 1)).toMatchObject({ data: { version: 2 } });
    expect(await current.testRun(operator, saved.data.id, sample)).toMatchObject({ data: { status: 'failed', traces: [{}, {}, { nodeId: 'a', status: 'failed', reason: '模拟动作失败' }] } });
  });

  it('persists rules and applied logs across independent service instances', async () => {
    localStorage.removeItem('iot-atlas-rules-v1'); localStorage.removeItem('iot-atlas-rule-logs-v1');
    try {
      const first = new RuleService(localStorage), second = new RuleService(localStorage);
      const saved = await first.save(tenant, input());
      if ('error' in saved) throw new Error(saved.error.message);
      expect(await second.get(tenant, saved.data.id)).toMatchObject({ data: { name: '测试高温规则' } });
      expect(await second.save(tenant, input(), saved.data.id, 0)).toMatchObject({ error: { code: 'CONFLICT' } });
      expect(await first.applySimulation(operator, saved.data.id, sample, true)).toMatchObject({ data: { mode: 'applied' } });
      expect(await second.logsFor(operator, { ...logQuery, tenantId: tenant.tenantId })).toMatchObject({ data: { total: 1 } });
    } finally { localStorage.removeItem('iot-atlas-rules-v1'); localStorage.removeItem('iot-atlas-rule-logs-v1'); }
  });

  it('saves named test samples without applying actions and enforces rule scope', async () => {
    const current = service();
    expect(await current.saveSampleCase(viewer, 'rule_high_temp', '高温样例', sample)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.saveSampleCase({ ...operator, tenantId: 'ten_202609_002' }, 'rule_high_temp', '高温样例', sample)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.saveSampleCase(operator, 'rule_high_temp', '高温样例', sample)).toMatchObject({ data: { name: '高温样例', sample } });
    expect(await current.saveSampleCase(operator, 'rule_high_temp', '高温样例', sample)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await current.sampleCases(tenant, 'rule_high_temp')).toMatchObject({ data: [{ name: '高温样例' }] });
    expect(await current.logsFor(tenant, { ...logQuery, tenantId: tenant.tenantId })).toMatchObject({ data: { total: 0 } });
  });

  it('keeps immutable versions and compares changed nodes and fields across reload', async () => {
    for (const key of ['iot-atlas-rules-v1', 'iot-atlas-rule-logs-v1', 'iot-atlas-rule-versions-v1', 'iot-atlas-rule-sample-cases-v1']) localStorage.removeItem(key);
    try {
      const first = new RuleService(localStorage), changed = input();
      const initial = await first.save(tenant, changed);
      if ('error' in initial) throw new Error(initial.error.message);
      changed.name = '已调整高温规则'; changed.versionNote = '修改阈值'; changed.nodes[1].config.clauses![0].threshold = 80;
      const revised = await first.save(tenant, changed, initial.data.id, 1);
      expect(revised).toMatchObject({ data: { version: 2 } });
      const second = new RuleService(localStorage);
      expect(await second.versionHistory(viewer, initial.data.id)).toMatchObject({ data: [{ version: 2 }, { version: 1 }] });
      expect(await second.compareVersions(tenant, initial.data.id, 1, 2)).toMatchObject({ data: { fields: ['name', 'versionNote'], changedNodes: ['c'], addedNodes: [], removedNodes: [] } });
      expect(await second.compareVersions(tenant, initial.data.id, 2, 1)).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(await second.get(tenant, initial.data.id)).toMatchObject({ data: { name: '已调整高温规则' } });
    } finally { for (const key of ['iot-atlas-rules-v1', 'iot-atlas-rule-logs-v1', 'iot-atlas-rule-versions-v1', 'iot-atlas-rule-sample-cases-v1']) localStorage.removeItem(key); }
  });
});
