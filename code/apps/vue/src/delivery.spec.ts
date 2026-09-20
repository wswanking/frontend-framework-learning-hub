import { describe, expect, it } from 'vitest';
import { DeliveryService, type DeliveryActor, type DeliveryRecord, type DeliveryRelease } from './delivery';

const contributor: DeliveryActor = { id: 'ai', role: 'contributor' };
const productOwner: DeliveryActor = { id: 'product-lead', role: 'productOwner' };
const releaseLead: DeliveryActor = { id: 'release-lead', role: 'releaseLead' };

function value<T>(result: { data: T } | { error: unknown }): T { if ('error' in result) throw new Error(JSON.stringify(result.error)); return result.data; }
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() { return items.size; }, clear() { items.clear(); }, getItem(key) { return items.get(key) ?? null; },
    key(index) { return [...items.keys()][index] ?? null; }, removeItem(key) { items.delete(key); }, setItem(key, value) { items.set(key, value); },
  };
}

describe('IOT-PLATFORM-001/002 and IOT-RELEASE-001 governance contract', () => {
  it('adds new seed reviews to older browser storage without replacing a recorded decision', () => {
    const storage = memoryStorage();
    {
      const original = new DeliveryService();
      const legacyRequirement = value(original.get('IOT-LEARNING-001'));
      const legacyReview = value(original.get('REVIEW-003'));
      storage.setItem('iot-atlas-delivery-v1', JSON.stringify([
        { ...legacyRequirement, status: 'pending', description: '实验室业务页面尚未实现；UI 库排行口径与依赖待审核。' },
        { ...legacyReview, requirementIds: ['IOT-TENANT-001'] },
      ]));
      const migrated = new DeliveryService(storage);
      expect(value(migrated.get('IOT-LEARNING-001'))).toMatchObject({ status: 'inProgress' });
      expect(value(migrated.get('REVIEW-003')).requirementIds).toContain('IOT-PRODUCT-001');
      expect(value(migrated.get('REVIEW-001'))).toMatchObject({ status: 'pending' });
      expect(value(migrated.get('REVIEW-002'))).toMatchObject({ status: 'pending' });
      const decided = value(migrated.decideReview({ id: 'tech-lead', role: 'techLead' }, 'REVIEW-003', 'needsChanges', '待补齐契约证据', 1));
      expect(value(new DeliveryService(storage).get('REVIEW-003'))).toMatchObject({ revision: decided.revision, reason: '待补齐契约证据' });
    }
  });

  it('lists factual pending records and traces a requirement to its issue and review', () => {
    const service = new DeliveryService();
    expect(service.list({ kind: 'requirement', page: 1, pageSize: 2 })).toMatchObject({ data: { total: 16, items: [{ kind: 'requirement' }, { kind: 'requirement' }] } });
    expect(service.list({ kind: 'issue', status: 'blocked', priority: 'P1', phase: '实施', owner: '待指定', requirementId: 'IOT-TENANT-001', keyword: '权限', page: 1, pageSize: 10 })).toMatchObject({ data: { total: 1, items: [{ id: 'ISSUE-20260920-001' }] } });
    const trace = value(service.trace('IOT-TENANT-001'));
    expect(trace.related.map(row => row.id)).toEqual(expect.arrayContaining(['ISSUE-20260920-001', 'REVIEW-003']));
    expect(value(service.list({ kind: 'review', status: 'pending', page: 1, pageSize: 10 })).total).toBe(5);
    expect(value(service.trace('IOT-DASH-001')).related.map(row => row.id)).toContain('REVIEW-002');
    expect(value(service.trace('IOT-PRODUCT-001')).related.map(row => row.id)).toContain('REVIEW-003');
    expect(value(service.trace('IOT-LEARNING-001')).related.map(row => row.id)).toEqual(expect.arrayContaining(['ISSUE-20260920-002', 'REVIEW-004']));
    expect(value(service.trace('IOT-PLATFORM-001')).related.map(row => row.id)).toContain('REVIEW-001');
    const release = (requirementId: string) => service.checkRelease({ environment: 'production', version: 'v0.1.0', previousVersion: 'v0.0.1', changeSummary: '演示变更', testEvidence: ['本地测试'], rollbackSteps: '恢复上一版本', requirementIds: [requirementId] });
    expect(release('IOT-DASH-001').blocked.join(' ')).toContain('REVIEW-002');
    expect(release('IOT-PRODUCT-001').blocked.join(' ')).toContain('REVIEW-003');
    expect(release('IOT-PRODUCT-001').blocked.join(' ')).toContain('REVIEW-005');
    const preview = service.checkRelease({ environment: 'preview', version: 'v0.1.0', previousVersion: 'v0.0.1', changeSummary: '演示变更', testEvidence: ['本地测试'], rollbackSteps: '恢复上一版本', requirementIds: ['IOT-PRODUCT-001'] });
    expect(preview.warnings.join(' ')).toContain('REVIEW-005');
    expect(preview.blocked).toHaveLength(0);
    const missingReview = release('IOT-QUALITY-001');
    expect(missingReview.ready).toBe(false);
    expect(missingReview.blocked.join(' ')).toContain('关联需求缺少审核：IOT-QUALITY-001');
    expect(missingReview.passed).not.toContain('关联审核已有结论');
    expect(service.list({ kind: 'issue', page: 0, pageSize: 10 })).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('blocks an unlinked task from execution and keeps immutable revision history', () => {
    const service = new DeliveryService();
    const task = value(service.createTask(contributor, { title: '补齐验收证据', requirementIds: [], owner: 'AI', priority: 'P1', description: '整理测试' }));
    expect(service.save(contributor, { ...task, status: 'inProgress' }, task.revision)).toMatchObject({ error: { code: 'VALIDATION_ERROR', fields: { requirementIds: expect.any(String) } } });
    const updated = value(service.save(contributor, { ...task, requirementIds: ['IOT-TENANT-001'], status: 'inProgress' }, task.revision));
    expect(updated.history.map(item => item.revision)).toEqual([1, 2]);
    expect(JSON.parse(updated.history[1].previous ?? '{}')).toMatchObject({ status: 'draft', requirementIds: [] });
    expect(service.save(contributor, { ...updated, title: '过期编辑' }, 1)).toMatchObject({ error: { code: 'CONFLICT' } });
    const moved = value(service.save(contributor, { ...updated, phase: '开发' }, updated.revision));
    expect(moved.phase).toBe('开发');
    expect(value(service.trace(task.id)).related).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'change', description: '阶段变更：实施 → 开发' })]));
  });

  it('does not let a contributor clear a high issue by closing or downgrading it', () => {
    const service = new DeliveryService();
    const issue = value(service.get('ISSUE-20260920-001')) as DeliveryRecord & { kind: 'issue'; severity: 'high' | 'medium'; resolution?: string };
    expect(service.save(contributor, { ...issue, status: 'done', resolution: '自行关闭' }, issue.revision)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(service.save(contributor, { ...issue, severity: 'medium', status: 'blocked' }, issue.revision)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(service.save(releaseLead, { ...issue, status: 'waived', resolution: '自行豁免' }, issue.revision)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(value(service.get(issue.id))).toMatchObject({ status: 'blocked', severity: 'high', revision: 1 });
    expect(service.checkRelease({ environment: 'production', version: 'v0.1.0', previousVersion: 'v0.0.1', changeSummary: '演示变更', testEvidence: ['本地测试'], rollbackSteps: '恢复上一版本', requirementIds: ['IOT-TENANT-001'] }).blocked.join(' ')).toContain(issue.id);
  });

  it('requires a designated reviewer and a recorded reason; a requirement cannot bypass review', () => {
    const service = new DeliveryService();
    const requirement = value(service.get('IOT-TENANT-001')) as DeliveryRecord;
    expect(service.save(contributor, { ...requirement, status: 'approved' }, requirement.revision)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(service.save(productOwner, { ...requirement, status: 'approved' }, requirement.revision)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(service.decideReview(productOwner, 'REVIEW-003', 'approved', '同意', 1)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(service.decideReview({ id: 'tech-lead', role: 'techLead' }, 'REVIEW-003', 'approved', '', 1)).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    const review = value(service.decideReview({ id: 'tech-lead', role: 'techLead' }, 'REVIEW-003', 'needsChanges', '成员权限冲突待统一', 1));
    expect(review.history).toHaveLength(2);
    expect(service.save(productOwner, { ...requirement, status: 'approved' }, requirement.revision)).toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('blocks production when high issues, review, tests or rollback are missing and persists a draft release', () => {
    const storage = memoryStorage();
    {
      const service = new DeliveryService(storage);
      const input: Omit<DeliveryRelease, 'id' | 'kind' | 'revision' | 'updatedAt' | 'publishedAt'> = {
        title: '演示预览', status: 'draft', priority: 'P1', phase: '预览', owner: 'release-lead', requirementIds: ['IOT-TENANT-001'], description: '本地模拟', acceptance: [], evidence: [], risk: '', history: [],
        environment: 'production', version: 'v0.1.0', previousVersion: '', changeSummary: '租户增量', testEvidence: [], rollbackSteps: '', knownRisks: [],
      };
      const check = service.checkRelease(input);
      expect(check.ready).toBe(false);
      expect(check.blocked.join(' ')).toContain('ISSUE-20260920-001');
      expect(check.blocked.join(' ')).toContain('REVIEW-003');
      expect(check.blocked.join(' ')).toContain('回滚步骤');
      expect(service.createRelease(contributor, input)).toMatchObject({ error: { code: 'FORBIDDEN' } });
      const release = value(service.createRelease(releaseLead, input));
      expect(release.status).toBe('blocked');
      expect(service.updateRelease(contributor, release.id, { ...input, version: 'v0.2.0' }, release.revision)).toMatchObject({ error: { code: 'FORBIDDEN' } });
      const corrected = value(service.updateRelease(releaseLead, release.id, { ...input, version: 'v0.2.0', previousVersion: 'v0.1.0', testEvidence: ['本地测试'], rollbackSteps: '恢复上一版' }, release.revision));
      expect(corrected).toMatchObject({ status: 'blocked', revision: 2, version: 'v0.2.0' });
      expect(corrected.history.map(item => item.action)).toEqual(['创建发布记录', '更新发布材料']);
      expect(service.updateRelease(releaseLead, release.id, input, release.revision)).toMatchObject({ error: { code: 'CONFLICT' } });
      expect(service.publish(releaseLead, release.id, release.revision)).toMatchObject({ error: { code: 'CONFLICT' } });
      expect(service.rollback(releaseLead, release.id, '故障', '已复测', corrected.revision)).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(value(new DeliveryService(storage).get(release.id)).id).toBe(release.id);
    }
  });

  it('returns an approved requirement to review and records a CHG when its scope changes', () => {
    const service = new DeliveryService();
    const reviewer = { id: 'tech-lead', role: 'techLead' } as const;
    value(service.decideReview(reviewer, 'REVIEW-003', 'approved', '首轮模拟审核', 1));
    const original = value(service.get('IOT-TENANT-001')) as DeliveryRecord;
    const approved = value(service.save(productOwner, { ...original, status: 'approved', owner: 'product-lead', acceptance: ['旧范围'] }, original.revision));
    expect(approved.status).toBe('approved');
    expect(service.save(contributor, { ...approved, description: 'AI 擅自修改范围' }, approved.revision)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    const changed = value(service.save(productOwner, { ...approved, description: '经负责人修改范围' }, approved.revision));
    expect(changed.status).toBe('pending');
    expect(value(service.get('REVIEW-003'))).toMatchObject({ status: 'pending', revision: 3 });
    const trace = value(service.trace('IOT-TENANT-001'));
    const change = trace.related.find(row => row.kind === 'change');
    expect(change).toMatchObject({ id: expect.stringMatching(/^CHG-20260920-/), requirementIds: ['IOT-TENANT-001'] });
    expect(change?.evidence).toContain(`IOT-TENANT-001#${changed.revision}`);
    expect(service.checkRelease({ environment: 'production', version: 'v0.3.0', previousVersion: 'v0.2.0', changeSummary: '范围变更', testEvidence: ['本地测试'], rollbackSteps: '恢复旧版', requirementIds: ['IOT-TENANT-001'] }).blocked.join(' ')).toContain('关联需求未批准');
    const latestReview = value(service.get('REVIEW-003'));
    value(service.decideReview(reviewer, 'REVIEW-003', 'approved', '新范围已复核', latestReview.revision));
    const reopened = value(service.get('IOT-TENANT-001')) as DeliveryRecord;
    expect(value(service.save(productOwner, { ...reopened, status: 'approved' }, reopened.revision)).status).toBe('approved');
  });

  it('permits a simulated release only after the blocker is resolved and records a reversible rollback', () => {
    const service = new DeliveryService();
    const issue = value(service.get('ISSUE-20260920-001')) as DeliveryRecord;
    value(service.save({ id: 'tech-lead', role: 'techLead' }, { ...issue, kind: 'issue', status: 'done', resolution: '权限契约已由负责人统一' }, issue.revision));
    value(service.decideReview({ id: 'tech-lead', role: 'techLead' }, 'REVIEW-003', 'approved', '模拟审核材料齐全', 1));
    const requirement = value(service.get('IOT-TENANT-001')) as DeliveryRecord;
    value(service.save(productOwner, { ...requirement, status: 'approved', owner: 'product-lead', acceptance: ['成员权限已核对'] }, requirement.revision));
    expect(service.checkRelease({ environment: 'production', version: 'v0.2.0', previousVersion: 'v0.1.0', changeSummary: '租户配额', testEvidence: ['本地测试'], rollbackSteps: '恢复 v0.1.0', requirementIds: ['IOT-TENANT-001'] }).blocked.join(' ')).toContain('REVIEW-005');
    value(service.decideReview(releaseLead, 'REVIEW-005', 'approved', '模拟发布审核通过', 1));
    const input: Omit<DeliveryRelease, 'id' | 'kind' | 'revision' | 'updatedAt' | 'publishedAt'> = {
      title: '模拟正式版', status: 'draft', priority: 'P1', phase: '发布', owner: 'release-lead', requirementIds: ['IOT-TENANT-001'], description: '本地演示', acceptance: [], evidence: [], risk: '', history: [],
      environment: 'production', version: 'v0.2.0', previousVersion: 'v0.1.0', changeSummary: '租户配额', testEvidence: ['diagnose:59/59', 'e2e:60/60'], rollbackSteps: '恢复 v0.1.0', knownRisks: [],
    };
    expect(service.checkRelease(input).ready).toBe(true);
    const created = value(service.createRelease(releaseLead, input));
    const published = value(service.publish(releaseLead, created.id, created.revision));
    expect(published).toMatchObject({ status: 'done', publishedAt: expect.any(String) });
    const rolled = value(service.rollback(releaseLead, published.id, '模拟异常', '模拟复验通过', published.revision));
    expect(rolled).toMatchObject({ status: 'blocked', rollback: { toVersion: 'v0.1.0', reason: '模拟异常', verification: '模拟复验通过' } });
    expect(rolled.history.map(item => item.action)).toEqual(['创建发布记录', '标记模拟发布', '记录模拟回滚']);
  });
});
