import { Component, computed, signal, type OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { delivery, type DeliveryActor, type DeliveryEntry, type DeliveryFilter, type DeliveryIssue, type DeliveryKind, type DeliveryPriority, type DeliveryRecord, type DeliveryRelease, type DeliveryReview, type DeliveryRole, type DeliveryStatus } from './delivery';
import { mountDeliveryDialog } from './delivery-dialog';

const actorFor = (role: DeliveryRole): DeliveryActor => ({ id: role === 'techLead' ? 'tech-lead' : role === 'releaseLead' ? 'release-lead' : role === 'productOwner' ? 'product-lead' : 'ai', role });
const emptyFilter = (): Omit<DeliveryFilter, 'kind'> => ({ page: 1, pageSize: 10 });
const emptyRelease = (): Omit<DeliveryRelease, 'id' | 'kind' | 'revision' | 'updatedAt' | 'publishedAt'> => ({ title: '', status: 'draft', priority: 'P1', phase: '预览', owner: 'release-lead', requirementIds: [], description: '', acceptance: [], evidence: [], risk: '', history: [], environment: 'preview', version: '', previousVersion: '', changeSummary: '', testEvidence: [], rollbackSteps: '', knownRisks: [] });

@Component({ selector: 'app-delivery', standalone: true, imports: [MatButtonModule, MatCardModule], templateUrl: './delivery.component.html', styleUrls: ['./dashboard.css', './delivery.css'] })
export class DeliveryComponent implements OnDestroy {
  private modalTrigger: HTMLElement | null = null;
  private dialogCleanup: (() => void) | null = null;
  private dialogFrame = 0;
  private rememberModalTrigger() { this.modalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null; }
  private openDialog(kind: 'requirement' | 'task' | 'issue' | 'release') {
    this.rememberModalTrigger();
    this.editor.set(kind);
    this.dialogFrame = requestAnimationFrame(() => { this.dialogCleanup = mountDeliveryDialog(() => this.closeDialog()); });
  }
  closeDialog(restoreFocus = true) {
    cancelAnimationFrame(this.dialogFrame);
    this.dialogCleanup?.(); this.dialogCleanup = null; this.editor.set(null);
    if (restoreFocus) requestAnimationFrame(() => this.modalTrigger?.isConnected && this.modalTrigger.focus());
  }
  ngOnDestroy() { cancelAnimationFrame(this.dialogFrame); this.dialogCleanup?.(); }
  readonly Math = Math;
  readonly delivery = delivery;
  readonly kinds: { id: DeliveryKind; label: string }[] = [{ id: 'requirement', label: '需求' }, { id: 'task', label: '任务' }, { id: 'issue', label: 'Issue' }, { id: 'review', label: '待审核' }];
  readonly statuses: Record<DeliveryStatus, string> = { draft: '草案', pending: '待处理', inProgress: '进行中', blocked: '阻塞', done: '已完成', approved: '已通过', rejected: '已驳回', needsChanges: '需修改', waived: '已豁免' };
  readonly statusEntries = Object.entries(this.statuses).map(([id, label]) => ({ id, label }));
  readonly roles: { id: DeliveryRole; label: string }[] = [{ id: 'contributor', label: '普通贡献者 / AI' }, { id: 'productOwner', label: '产品负责人' }, { id: 'techLead', label: '技术负责人' }, { id: 'releaseLead', label: '发布负责人' }];
  readonly priorities: DeliveryPriority[] = ['P0', 'P1', 'P2', 'P3'];
  readonly themeChoice = signal(localStorage.getItem('iot-atlas-theme') || 'dark');
  readonly role = signal<DeliveryRole>('contributor');
  readonly actor = computed(() => actorFor(this.role()));
  readonly filter = signal(emptyFilter());
  readonly draft = signal(emptyFilter());
  readonly pages = signal<Record<DeliveryKind, number>>({ requirement: 1, task: 1, issue: 1, review: 1, release: 1, change: 1 });
  readonly selectedId = signal('IOT-TENANT-001');
  readonly editor = signal<'requirement' | 'task' | 'issue' | 'release' | null>(null);
  readonly editingRequirementId = signal<string | null>(null);
  readonly editingReleaseId = signal<string | null>(null);
  readonly title = signal(''); readonly newId = signal(''); readonly description = signal(''); readonly owner = signal(''); readonly requirementId = signal('IOT-TENANT-001'); readonly priority = signal<DeliveryPriority>('P1'); readonly severity = signal<DeliveryIssue['severity']>('medium'); readonly acceptance = signal('');
  readonly reviewVerdict = signal<DeliveryReview['verdict']>('needsChanges'); readonly reviewReason = signal('');
  readonly statusDraft = signal<DeliveryStatus>('pending'); readonly resolution = signal('');
  readonly releaseDraft = signal(emptyRelease()); readonly message = signal(''); readonly reload = signal(0);
  readonly rollbackReason = signal(''); readonly rollbackVerification = signal('');
  readonly columns = computed(() => { this.reload(); return this.kinds.map(kind => { const result = delivery.list({ ...this.filter(), kind: kind.id, page: this.pages()[kind.id] }); return { ...kind, items: 'data' in result ? result.data.items : [], total: 'data' in result ? result.data.total : 0 }; }); });
  readonly selected = computed(() => { this.reload(); const result = delivery.get(this.selectedId()); return 'data' in result ? result.data : null; });
  readonly related = computed(() => { this.reload(); const item = this.selected(); if (!item) return []; const result = delivery.trace(item.id); return 'data' in result ? result.data.related : []; });
  readonly requirements = computed(() => { this.reload(); const result = delivery.list({ kind: 'requirement', page: 1, pageSize: 100 }); return 'data' in result ? result.data.items : []; });
  readonly releases = computed(() => { this.reload(); const result = delivery.list({ kind: 'release', page: 1, pageSize: 100 }); return 'data' in result ? result.data.items : []; });
  readonly releaseCheck = computed(() => delivery.checkRelease(this.releaseDraft()));
  releaseGroups() { const check = this.releaseCheck(); return [{ name: '通过', items: check.passed }, { name: '警告', items: check.warnings }, { name: '阻塞', items: check.blocked }]; }
  checkGroups(item: DeliveryRelease) { const check = delivery.checkRelease(item); return [{ name: '通过', items: check.passed }, { name: '警告', items: check.warnings }, { name: '阻塞', items: check.blocked }]; }
  releaseAction(reason: string) {
    const id = reason.match(/REVIEW-\d{3}|ISSUE-\d{8}-\d{3}|IOT-[A-Z]+-\d{3}/)?.[0];
    if (id) return { owner: id.startsWith('REVIEW') ? '指定审核人' : id.startsWith('ISSUE') ? '产品或技术负责人' : '产品负责人', target: id };
    const field = reason.includes('目标版本') ? '目标版本' : reason.includes('有效的关联需求') ? '发布关联需求' : reason.includes('变更摘要') ? '变更摘要' : reason.includes('测试证据') ? '测试证据' : reason.includes('回滚步骤') ? (this.releaseDraft().previousVersion ? '回滚步骤' : '上一已验证版本') : '';
    return { owner: '发布负责人', target: field };
  }
  openReleaseAction(reason: string) {
    const { target } = this.releaseAction(reason);
    if (target.startsWith('REVIEW-') || target.startsWith('ISSUE-') || target.startsWith('IOT-')) { const row = delivery.get(target); if ('data' in row) { this.choose(row.data); this.closeDialog(false); requestAnimationFrame(() => { const detail = document.querySelector<HTMLElement>('.delivery-detail'); detail?.scrollIntoView({ block: 'start' }); detail?.focus(); }); } }
    else document.querySelector<HTMLElement>(`.delivery-modal [aria-label="${target}"]`)?.focus();
  }

  constructor() { this.setTheme(this.themeChoice()); }
  setTheme(value: string) { this.themeChoice.set(value); const dark = value === 'dark' || (value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset['theme'] = dark ? 'dark' : 'light'; localStorage.setItem('iot-atlas-theme', value); }
  setDraft(key: keyof Omit<DeliveryFilter, 'kind'>, value: string) { this.draft.update(current => ({ ...current, [key]: value || undefined })); }
  setRelease(key: keyof DeliveryRelease, value: unknown) { this.releaseDraft.update(current => ({ ...current, [key]: value })); }
  setTestEvidence(value: string) { this.setRelease('testEvidence', value.split('\n').map(item => item.trim()).filter(Boolean)); }
  isIssue(item: DeliveryEntry): item is DeliveryIssue { return item.kind === 'issue'; }
  isReview(item: DeliveryEntry): item is DeliveryReview { return item.kind === 'review'; }
  isRelease(item: DeliveryEntry): item is DeliveryRelease { return item.kind === 'release'; }
  show(result: { error: { message: string } } | { data: DeliveryEntry }) { if ('error' in result) { this.message.set(result.error.message); return; } this.message.set(`${result.data.id} 已保存到本端模拟记录`); this.selectedId.set(result.data.id); this.closeDialog(); this.reload.update(value => value + 1); }
  startCreate(kind: 'requirement' | 'task' | 'issue' | 'release') { this.editingRequirementId.set(null); this.editingReleaseId.set(null); this.openDialog(kind); this.message.set(''); this.title.set(''); this.newId.set(''); this.description.set(''); this.owner.set(''); this.requirementId.set('IOT-TENANT-001'); this.priority.set('P1'); this.severity.set('medium'); this.acceptance.set(''); this.releaseDraft.set(emptyRelease()); }
  startEditRequirement(item: DeliveryEntry) { if (item.kind !== 'requirement') return; this.editingRequirementId.set(item.id); this.openDialog('requirement'); this.message.set(''); this.title.set(item.title); this.newId.set(item.id); this.description.set(item.description); this.owner.set(item.owner); this.priority.set(item.priority); this.acceptance.set(item.acceptance.join('\n')); }
  startEditRelease(item: DeliveryRelease) { this.editingReleaseId.set(item.id); this.editingRequirementId.set(null); this.releaseDraft.set(item); this.openDialog('release'); this.message.set(''); }
  saveNew() {
    if (this.editor() === 'task') this.show(delivery.createTask(this.actor(), { title: this.title(), requirementIds: this.requirementId() ? [this.requirementId()] : [], owner: this.owner(), priority: this.priority(), description: this.description() }));
    if (this.editor() === 'issue') this.show(delivery.createIssue(this.actor(), { title: this.title(), requirementIds: this.requirementId() ? [this.requirementId()] : [], owner: this.owner(), priority: this.priority(), description: this.description(), severity: this.severity() }));
    if (this.editor() === 'requirement') {
      const input: DeliveryRecord = { id: this.newId(), kind: 'requirement', title: this.title(), status: 'pending', priority: this.priority(), phase: '需求', owner: this.owner(), requirementIds: [this.newId()], description: this.description(), acceptance: this.acceptance().split('\n').map(item => item.trim()).filter(Boolean), evidence: [], risk: '', updatedAt: '', revision: 0, history: [] };
      const current = this.editingRequirementId() ? delivery.get(this.editingRequirementId()!) : null;
      if (current && 'data' in current) this.show(delivery.save(this.actor(), { ...current.data, ...input, status: current.data.status, phase: current.data.phase, evidence: current.data.evidence, risk: current.data.risk } as DeliveryRecord, current.data.revision));
      else this.show(delivery.save(this.actor(), input));
    }
    if (this.editor() === 'release') { const current = this.editingReleaseId() ? delivery.get(this.editingReleaseId()!) : null; if (current && 'data' in current && this.isRelease(current.data)) this.show(delivery.updateRelease(this.actor(), current.data.id, this.releaseDraft(), current.data.revision)); else this.show(delivery.createRelease(this.actor(), this.releaseDraft())); }
  }
  choose(item: DeliveryEntry) { this.selectedId.set(item.id); this.statusDraft.set(item.status); this.resolution.set(this.isIssue(item) ? item.resolution ?? '' : ''); this.message.set(''); }
  saveStatus() { const item = this.selected(); if (!item || ['review', 'release'].includes(item.kind)) return; const input = { ...item, status: this.statusDraft(), ...(this.isIssue(item) ? { resolution: this.resolution() } : {}) } as DeliveryRecord | DeliveryIssue; this.show(delivery.save(this.actor(), input, item.revision)); }
  decide() { const item = this.selected(); if (item && this.isReview(item)) this.show(delivery.decideReview(this.actor(), item.id, this.reviewVerdict(), this.reviewReason(), item.revision)); }
  publish() { const item = this.selected(); if (item && this.isRelease(item)) this.show(delivery.publish(this.actor(), item.id, item.revision)); }
  rollback() { const item = this.selected(); if (item && this.isRelease(item)) this.show(delivery.rollback(this.actor(), item.id, this.rollbackReason(), this.rollbackVerification(), item.revision)); }
  apply() { this.filter.set({ ...this.draft(), page: 1 }); this.pages.set({ requirement: 1, task: 1, issue: 1, review: 1, release: 1, change: 1 }); }
  reset() { this.draft.set(emptyFilter()); this.filter.set(emptyFilter()); this.pages.set({ requirement: 1, task: 1, issue: 1, review: 1, release: 1, change: 1 }); }
  page(kind: DeliveryKind, delta: number) { this.pages.update(current => ({ ...current, [kind]: current[kind] + delta })); }
}
