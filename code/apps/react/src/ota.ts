// IOT-OTA-001 / IOT-DOMAIN-001. Deterministic, browser-only OTA event service.
import type { Context } from './dashboard';
import { devices, type Device, type DeviceService } from './devices';
import { firmwares, type FirmwareService } from './firmware';
import { TenantService } from './tenants';

export type OtaStage = 'queued' | 'downloading' | 'verifying' | 'installing' | 'rebooting' | 'succeeded' | 'failed' | 'cancelled';
export type OtaTaskStatus = 'draft' | 'queued' | 'downloading' | 'verifying' | 'installing' | 'rebooting' | 'paused' | 'succeeded' | 'failed' | 'cancelled' | 'rollingBack' | 'rolledBack';
export type FailureMode = 'download' | 'checksum' | 'reboot';
export type OtaEvent = { id: string; taskId: string; deviceId?: string; at: string; type: string; detail: string };
export type OtaExecution = { id: string; otaTaskId: string; deviceId: string; batch: number; attempt: number; status: OtaStage; fromVersion: string; toVersion: string; startedAt: string; endedAt?: string; reason?: string; events: OtaEvent[] };
export type OtaTask = {
  id: string; tenantId: string; firmwareId: string; productId: string; targetSelector: { deviceIds: string[]; tags: string[] };
  batches: number[]; failureThreshold: number; status: OtaTaskStatus; kind: 'upgrade' | 'rollback'; sourceTaskId?: string;
  failureModes: Record<string, FailureMode>; createdBy: string; createdAt: string; updatedAt: string;
  revision: number; currentBatch: number; executions: OtaExecution[]; events: OtaEvent[]; alarmCreated: boolean;
};
export type OtaInput = Pick<OtaTask, 'tenantId' | 'firmwareId' | 'productId' | 'targetSelector' | 'batches' | 'failureThreshold' | 'failureModes'>;
export type OtaQuery = { tenantId: string; seed: number; firmwareId?: string; status?: OtaTaskStatus; page: number; pageSize: number };
export type OtaError = { error: { code: 'FORBIDDEN' | 'VALIDATION_ERROR' | 'CONFLICT' | 'NOT_FOUND' | 'SCENARIO_TIMEOUT'; message: string; fieldErrors?: Record<string, string>; retryable?: boolean } };
export type OtaResult<T> = { data: T; meta: { requestId: string; seed: number; generatedAt: string } } | OtaError;
export type OtaPreview = { firmwareId: string; productId: string; devices: { id: string; name: string; status: Device['status']; currentVersion: string; compatible: boolean; reason?: string }[]; batchCounts: number[]; total: number; offline: number; failureThreshold: number };

const FIXED_AT = '2026-09-16T12:00:00.000Z';
const STORAGE_KEY = 'iot-atlas-ota-v1';
const clone = <T>(value: T): T => structuredClone(value);
const time = (n: number) => new Date(Date.parse(FIXED_AT) + n * 1000).toISOString();
const terminal = (stage: OtaStage) => ['succeeded', 'failed', 'cancelled'].includes(stage);
const error = (code: OtaError['error']['code'], message: string, fieldErrors?: Record<string, string>): OtaError => ({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}), retryable: code === 'SCENARIO_TIMEOUT' } });
const ok = <T>(context: Context, data: T, key: string): OtaResult<T> => ({ data: clone(data), meta: { requestId: `req_${context.seed}_${key}`, seed: context.seed, generatedAt: FIXED_AT } });
function access(context: Context, tenantId: string, mode: 'read' | 'create' | 'operate' | 'cancel'): OtaError | null {
  if (context.scenario === 'forbidden') return error('FORBIDDEN', '无权访问 OTA 任务');
  if ((mode === 'create' || mode === 'cancel') && !['platformAdmin', 'tenantAdmin'].includes(context.role)) return error('FORBIDDEN', '无权创建或取消 OTA');
  if (mode === 'operate' && context.role === 'viewer') return error('FORBIDDEN', '观察员只能查看 OTA');
  if (context.role !== 'platformAdmin' && (tenantId === 'all' || tenantId !== context.tenantId)) return error('FORBIDDEN', '无权访问该租户 OTA');
  if (mode !== 'read' && tenantId === 'all') return error('VALIDATION_ERROR', '写入须选择目标租户', { tenantId: '请选择目标租户' });
  if (context.scenario === 'offline') return error('SCENARIO_TIMEOUT', '模拟 OTA 服务暂不可用');
  return null;
}
const slow = async (context: Context) => { if (context.scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 80)); };
function batchCounts(total: number, percentages: number[]): number[] {
  let previous = 0, sum = 0;
  return percentages.map((percent, index) => { sum += percent; const boundary = index === percentages.length - 1 ? total : Math.ceil(total * sum / 100); const count = boundary - previous; previous = boundary; return count; });
}
function validate(input: OtaInput): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!Array.isArray(input.batches) || !input.batches.length || input.batches.length > 10 || input.batches.some(value => !Number.isInteger(value) || value <= 0) || input.batches.reduce((sum, value) => sum + value, 0) !== 100) fields.batches = '灰度批次为 1–10 个正整数百分比，总和须为 100';
  if (!Number.isFinite(input.failureThreshold) || input.failureThreshold < 0 || input.failureThreshold > 1) fields.failureThreshold = '失败阈值须在 0–100% 之间';
  if (!input.targetSelector || !Array.isArray(input.targetSelector.deviceIds) || !Array.isArray(input.targetSelector.tags) || input.targetSelector.deviceIds.length > 100 || new Set(input.targetSelector.deviceIds).size !== input.targetSelector.deviceIds.length) fields.targetSelector = '目标设备或标签无效';
  if (!input.firmwareId || !input.productId) fields.firmwareId = '请选择固件及产品';
  if (!input.failureModes || Object.entries(input.failureModes).some(([id, mode]) => !id || !['download', 'checksum', 'reboot'].includes(mode))) fields.failureModes = '模拟失败场景无效';
  return fields;
}

export class OtaService {
  private tasks: OtaTask[] = [];
  private listeners = new Set<(event: OtaEvent) => void>();
  private eventCounter = 0;
  constructor(private storage: Storage | null = null, private firmwareService: FirmwareService = firmwares, private deviceService: DeviceService = devices, private tenantService = new TenantService(storage)) { this.sync(); }
  private async checkConcurrent(context: Context, tenantId: string): Promise<OtaError | null> {
    const quotaContext = context.role === 'operator' ? { ...context, role: 'tenantAdmin' as const } : context;
    const activeCount = this.tasks.filter(task => task.tenantId === tenantId && !['draft', 'paused', 'succeeded', 'failed', 'cancelled', 'rolledBack'].includes(task.status)).length;
    const capacity = await this.tenantService.checkCapacity(quotaContext, tenantId, 'otaConcurrent', activeCount);
    return 'error' in capacity ? error(capacity.error.code, capacity.error.message, capacity.error.fieldErrors) : null;
  }
  private sync() { if (!this.storage) return; try { const value = this.storage.getItem(STORAGE_KEY); if (!value) return; const rows = JSON.parse(value) as OtaTask[];
    if (Array.isArray(rows) && rows.every(row => row && typeof row.id === 'string' && Number.isInteger(row.revision) && Array.isArray(row.executions) && Array.isArray(row.events))) {
      this.tasks = rows;
      this.eventCounter = Math.max(this.eventCounter, ...rows.flatMap(row => [...row.events, ...row.executions.flatMap(execution => execution.events)].map(event => Number(event.id.slice(5)) || 0)), 0);
    }
  } catch { /* Malformed local demo storage leaves current session usable. */ } }
  private commit() { try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.tasks)); } catch { /* Current session remains usable. */ } }
  private publish(events: OtaEvent[]) { for (const event of events) for (const listener of this.listeners) listener(clone(event)); }
  subscribe(listener: (event: OtaEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private event(taskId: string, type: string, detail: string, deviceId?: string): OtaEvent {
    const count = ++this.eventCounter;
    return { id: `oevt_${String(count).padStart(5, '0')}`, taskId, ...(deviceId ? { deviceId } : {}), at: time(count), type, detail };
  }
  private save(task: OtaTask, emitted: OtaEvent[] = []) {
    task.revision += 1; task.updatedAt = time(this.tasks.length + task.revision + task.events.length);
    this.tasks = this.tasks.map(item => item.id === task.id ? task : item); this.commit(); this.publish(emitted);
  }
  private currentVersion(deviceId: string, productId: string): string {
    const successful = this.tasks.flatMap(task => task.executions.filter(execution => execution.deviceId === deviceId && execution.status === 'succeeded').map(execution => ({ version: execution.toVersion, at: execution.endedAt ?? execution.startedAt })));
    successful.sort((a, b) => b.at.localeCompare(a.at));
    return successful[0]?.version ?? (productId === 'prod_as_001' ? '2.3.0' : '1.5.1');
  }
  private async targets(context: Context, input: OtaInput): Promise<OtaResult<Device[]>> {
    const selected = new Set(input.targetSelector.deviceIds);
    if (input.targetSelector.tags.length) {
      const listed = await this.deviceService.list(context, { tenantId: input.tenantId, seed: context.seed, productId: input.productId, page: 1, pageSize: 100 });
      if ('error' in listed) return error(listed.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'VALIDATION_ERROR', listed.error.message);
      listed.data.items.filter(device => input.targetSelector.tags.every(tag => device.tags.includes(tag))).forEach(device => selected.add(device.id));
    }
    if (!selected.size) return error('VALIDATION_ERROR', '至少选择一台目标设备', { targetSelector: '请选择设备或标签' });
    const rows: Device[] = [];
    for (const id of selected) {
      const response = await this.deviceService.get(context, id);
      if ('error' in response) return error(response.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'VALIDATION_ERROR', '目标设备不存在或无权访问');
      if (response.data.tenantId !== input.tenantId || response.data.productId !== input.productId) return error('VALIDATION_ERROR', '目标设备与所选租户或产品不兼容', { targetSelector: id });
      rows.push(response.data);
    }
    return ok(context, rows.sort((a, b) => a.id.localeCompare(b.id)), 'targets');
  }
  async preview(context: Context, input: OtaInput): Promise<OtaResult<OtaPreview>> {
    const denied = access(context, input.tenantId, 'create'); if (denied) return denied;
    const fields = validate(input); if (Object.keys(fields).length) return error('VALIDATION_ERROR', 'OTA 创建条件无效', fields);
    const firmware = await this.firmwareService.eligible(context, input.firmwareId, input.productId);
    if ('error' in firmware) return error(firmware.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'VALIDATION_ERROR', firmware.error.message);
    if (firmware.data.tenantId !== input.tenantId) return error('VALIDATION_ERROR', '固件与目标租户不一致');
    const targets = await this.targets(context, input); if ('error' in targets) return targets;
    const rows = targets.data.map(device => ({ id: device.id, name: device.name, status: device.status, currentVersion: this.currentVersion(device.id, device.productId), compatible: device.status === 'online', ...(device.status === 'online' ? {} : { reason: '设备离线或不可升级，执行时记为失败' }) }));
    return ok(context, { firmwareId: input.firmwareId, productId: input.productId, devices: rows, batchCounts: batchCounts(rows.length, input.batches), total: rows.length, offline: rows.filter(row => !row.compatible).length, failureThreshold: input.failureThreshold }, 'preview');
  }
  async create(context: Context, input: OtaInput): Promise<OtaResult<OtaTask>> {
    this.sync(); const preview = await this.preview(context, input); if ('error' in preview) return preview;
    await slow(context); this.sync();
    const id = `ota_new_${String(this.tasks.length + 1).padStart(3, '0')}`, now = time(this.tasks.length + 1);
    const event = this.event(id, 'created', `创建草稿，目标 ${preview.data.total} 台设备`);
    const task: OtaTask = { ...clone(input), targetSelector: { deviceIds: preview.data.devices.map(device => device.id), tags: [...input.targetSelector.tags] },
      id, status: 'draft', kind: 'upgrade', createdBy: context.actorId, createdAt: now, updatedAt: now, revision: 1, currentBatch: -1, executions: [], events: [event], alarmCreated: false };
    this.tasks.push(task); this.commit(); this.publish([event]); return ok(context, task, id);
  }
  async list(context: Context, query: OtaQuery): Promise<OtaResult<{ items: OtaTask[]; total: number; page: number; pageSize: number }>> {
    this.sync(); const denied = access(context, query.tenantId, 'read'); if (denied) return denied;
    if (query.seed !== context.seed || !Number.isInteger(query.seed) || !Number.isInteger(query.page) || query.page < 1 || !Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) return error('VALIDATION_ERROR', '查询条件无效');
    await slow(context); const rows = this.tasks.filter(task => (query.tenantId === 'all' || task.tenantId === query.tenantId) && (!query.firmwareId || task.firmwareId === query.firmwareId) && (!query.status || task.status === query.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    return ok(context, { items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: rows.length, page: query.page, pageSize: query.pageSize }, `otas_${query.page}`);
  }
  async get(context: Context, id: string): Promise<OtaResult<OtaTask>> {
    this.sync(); const task = this.tasks.find(item => item.id === id); const denied = access(context, task?.tenantId ?? context.tenantId, 'read'); if (denied) return denied;
    if (!task) return error('NOT_FOUND', 'OTA 任务不存在'); return ok(context, task, id);
  }
  private authorizedTask(context: Context, id: string, mode: 'operate' | 'cancel'): OtaTask | OtaError {
    this.sync(); const task = this.tasks.find(item => item.id === id); const denied = access(context, task?.tenantId ?? context.tenantId, mode); if (denied) return denied;
    return task ? clone(task) : error('NOT_FOUND', 'OTA 任务不存在');
  }
  private launchBatch(task: OtaTask, index: number): OtaEvent[] {
    const counts = batchCounts(task.targetSelector.deviceIds.length, task.batches);
    const start = counts.slice(0, index).reduce((sum, count) => sum + count, 0), ids = task.targetSelector.deviceIds.slice(start, start + counts[index]);
    const events: OtaEvent[] = [];
    task.currentBatch = index; task.status = task.kind === 'rollback' ? 'rollingBack' : 'queued';
    const base = this.event(task.id, 'batch.started', `批次 ${index + 1} 开始，${ids.length} 台设备`); task.events.push(base); events.push(base);
    for (const id of ids) {
      const fromVersion = this.currentVersion(id, task.productId), toVersion = task.kind === 'rollback' ? task.sourceTaskId ? this.rollbackVersion(task.sourceTaskId, id) : fromVersion : '';
      const firmwareVersion = task.kind === 'rollback' ? toVersion : this.firmwareVersion(task.firmwareId);
      const event = this.event(task.id, 'device.queued', `设备 ${id} 等待升级`, id);
      const execution: OtaExecution = { id: `oexe_${task.id}_${id}_1`, otaTaskId: task.id, deviceId: id, batch: index, attempt: 1, status: 'queued', fromVersion, toVersion: firmwareVersion, startedAt: event.at, events: [event] };
      task.executions.push(execution); events.push(event);
    }
    return events;
  }
  private firmwareVersion(id: string): string { return id === 'fw_as_001' ? '2.4.1' : id === 'fw_as_002' ? '2.3.0' : id === 'fw_as_003' ? '1.5.2' : this.firmwareVersions.get(id) ?? 'unknown'; }
  private firmwareVersions = new Map<string, string>();
  private rollbackVersion(sourceTaskId: string, deviceId: string): string {
    return this.tasks.find(task => task.id === sourceTaskId)?.executions.find(execution => execution.deviceId === deviceId && execution.status === 'succeeded')?.fromVersion ?? 'unknown';
  }
  async start(context: Context, id: string, expectedRevision: number): Promise<OtaResult<OtaTask>> {
    const task = this.authorizedTask(context, id, 'cancel'); if ('error' in task) return task;
    if (task.revision !== expectedRevision) return error('CONFLICT', '任务版本已变化，请刷新');
    if (task.status !== 'draft') return error('CONFLICT', '只有草稿可开始');
    const quotaError = await this.checkConcurrent(context, task.tenantId); if (quotaError) return quotaError;
    const firmware = await this.firmwareService.get(context, task.firmwareId); if ('error' in firmware) return error('VALIDATION_ERROR', '目标固件不可用');
    this.firmwareVersions.set(task.firmwareId, firmware.data.version);
    const eligible = await this.firmwareService.eligible(context, task.firmwareId, task.productId); if ('error' in eligible) return error('VALIDATION_ERROR', eligible.error.message);
    const emitted = this.launchBatch(task, 0); this.save(task, emitted); return ok(context, task, id);
  }
  async advance(context: Context, id: string): Promise<OtaResult<OtaTask>> {
    const task = this.authorizedTask(context, id, 'operate'); if ('error' in task) return task;
    if (['draft', 'paused', 'cancelled', 'succeeded', 'failed', 'rolledBack'].includes(task.status)) return error('CONFLICT', '当前任务不能推进');
    const emitted: OtaEvent[] = [];
    const active = task.executions.filter(execution => execution.batch === task.currentBatch && !terminal(execution.status));
    for (const execution of active) {
      const device = await this.deviceService.get(context, execution.deviceId);
      const mode = task.failureModes[execution.deviceId];
      let next: OtaStage, reason: string | undefined;
      if ('error' in device || device.data.status !== 'online') { next = 'failed'; reason = '设备离线或不可升级'; }
      else if (execution.status === 'queued') next = 'downloading';
      else if (execution.status === 'downloading') { next = mode === 'download' ? 'failed' : 'verifying'; if (next === 'failed') reason = '模拟下载失败'; }
      else if (execution.status === 'verifying') { next = mode === 'checksum' ? 'failed' : 'installing'; if (next === 'failed') reason = '模拟校验失败'; }
      else if (execution.status === 'installing') next = 'rebooting';
      else { next = mode === 'reboot' ? 'failed' : 'succeeded'; if (next === 'failed') reason = '模拟重启超时'; }
      execution.status = next; execution.reason = reason;
      const event = this.event(task.id, `device.${next}`, reason ?? `设备 ${execution.deviceId} 进入 ${next}`, execution.deviceId);
      execution.events.push(event); emitted.push(event);
      if (terminal(next)) execution.endedAt = event.at;
    }
    const current = [...new Map(task.executions.filter(execution => execution.batch === task.currentBatch).map(execution => [execution.deviceId, execution])).values()];
    if (current.every(execution => terminal(execution.status))) {
      const finished = [...new Map(task.executions.map(execution => [execution.deviceId, execution])).values()].filter(execution => terminal(execution.status));
      const failed = finished.filter(execution => execution.status === 'failed').length;
      const rate = finished.length ? failed / finished.length : 0;
      if (rate > task.failureThreshold) {
        task.status = 'paused'; task.alarmCreated = true;
        const event = this.event(task.id, 'threshold.exceeded', `失败率 ${(rate * 100).toFixed(1)}% 超过阈值 ${(task.failureThreshold * 100).toFixed(1)}%，已自动暂停并创建模拟告警`);
        task.events.push(event); emitted.push(event);
      } else if (task.currentBatch < task.batches.length - 1) emitted.push(...this.launchBatch(task, task.currentBatch + 1));
      else {
        task.status = failed ? 'failed' : task.kind === 'rollback' ? 'rolledBack' : 'succeeded';
        const event = this.event(task.id, 'task.completed', `任务结束：${task.status}`); task.events.push(event); emitted.push(event);
      }
    } else if (active.length) task.status = task.kind === 'rollback' ? 'rollingBack' : active[0].status === 'failed' ? 'queued' : active[0].status;
    this.save(task, emitted); return ok(context, task, id);
  }
  async pause(context: Context, id: string, expectedRevision: number): Promise<OtaResult<OtaTask>> {
    const task = this.authorizedTask(context, id, 'operate'); if ('error' in task) return task;
    if (task.revision !== expectedRevision) return error('CONFLICT', '任务版本已变化，请刷新');
    if (['draft', 'paused', 'cancelled', 'succeeded', 'failed', 'rolledBack'].includes(task.status)) return error('CONFLICT', '当前任务不能暂停');
    task.status = 'paused'; const event = this.event(id, 'task.paused', '人工暂停 OTA'); task.events.push(event); this.save(task, [event]); return ok(context, task, id);
  }
  async resume(context: Context, id: string, expectedRevision: number): Promise<OtaResult<OtaTask>> {
    const task = this.authorizedTask(context, id, 'operate'); if ('error' in task) return task;
    if (task.revision !== expectedRevision) return error('CONFLICT', '任务版本已变化，请刷新');
    if (task.status !== 'paused') return error('CONFLICT', '只有已暂停任务可继续');
    const quotaError = await this.checkConcurrent(context, task.tenantId); if (quotaError) return quotaError;
    const current = [...new Map(task.executions.filter(execution => execution.batch === task.currentBatch).map(execution => [execution.deviceId, execution])).values()];
    const event = this.event(id, 'task.resumed', '人工确认后继续 OTA'); task.events.push(event);
    const emitted = [event];
    if (current.length && current.every(execution => terminal(execution.status)) && task.currentBatch < task.batches.length - 1) emitted.push(...this.launchBatch(task, task.currentBatch + 1));
    else task.status = task.kind === 'rollback' ? 'rollingBack' : current.find(execution => !terminal(execution.status))?.status ?? 'queued';
    this.save(task, emitted); return ok(context, task, id);
  }
  async cancel(context: Context, id: string, expectedRevision: number): Promise<OtaResult<OtaTask>> {
    const task = this.authorizedTask(context, id, 'cancel'); if ('error' in task) return task;
    if (task.revision !== expectedRevision) return error('CONFLICT', '任务版本已变化，请刷新');
    if (['cancelled', 'succeeded', 'failed', 'rolledBack'].includes(task.status)) return error('CONFLICT', '终态任务不能取消');
    const event = this.event(id, 'task.cancelled', '管理员取消 OTA'); task.events.push(event); task.status = 'cancelled';
    for (const execution of task.executions.filter(item => !terminal(item.status))) { execution.status = 'cancelled'; execution.endedAt = event.at; execution.events.push(event); }
    this.save(task, [event]); return ok(context, task, id);
  }
  async retry(context: Context, id: string, deviceId: string, expectedRevision: number): Promise<OtaResult<OtaTask>> {
    const task = this.authorizedTask(context, id, 'operate'); if ('error' in task) return task;
    if (task.revision !== expectedRevision) return error('CONFLICT', '任务版本已变化，请刷新');
    if (['draft', 'cancelled', 'rolledBack'].includes(task.status)) return error('CONFLICT', '当前任务不能重试');
    const failed = [...task.executions].reverse().find(execution => execution.deviceId === deviceId && execution.status === 'failed');
    if (!failed) return error('VALIDATION_ERROR', '该设备没有失败尝试');
    const current = task.executions.filter(execution => execution.deviceId === deviceId);
    if (current.some(execution => !terminal(execution.status) || execution.status === 'succeeded')) return error('CONFLICT', '该设备已有进行中或成功的尝试');
    if (task.status === 'paused' || task.status === 'failed' || task.status === 'succeeded') {
      const quotaError = await this.checkConcurrent(context, task.tenantId); if (quotaError) return quotaError;
    }
    const event = this.event(id, 'device.retry', `设备 ${deviceId} 发起第 ${current.length + 1} 次尝试`, deviceId);
    task.events.push(event); task.executions.push({ ...clone(failed), id: `oexe_${id}_${deviceId}_${current.length + 1}`, attempt: current.length + 1, status: 'queued', reason: undefined, startedAt: event.at, endedAt: undefined, events: [event] });
    task.currentBatch = failed.batch; task.status = 'queued'; task.failureModes = { ...task.failureModes }; delete task.failureModes[deviceId];
    this.save(task, [event]); return ok(context, task, id);
  }
  async rollback(context: Context, id: string, expectedRevision: number): Promise<OtaResult<OtaTask>> {
    const source = this.authorizedTask(context, id, 'cancel'); if ('error' in source) return source;
    if (source.revision !== expectedRevision) return error('CONFLICT', '任务版本已变化，请刷新');
    if (source.kind !== 'upgrade' || !['succeeded', 'failed', 'paused'].includes(source.status)) return error('CONFLICT', '该任务不能回滚');
    const succeeded = source.executions.filter(execution => execution.status === 'succeeded');
    if (!succeeded.length) return error('VALIDATION_ERROR', '尚无成功升级设备可回滚');
    const priorVersion = succeeded[0].fromVersion;
    if (succeeded.some(execution => execution.fromVersion !== priorVersion)) return error('VALIDATION_ERROR', '目标设备的原始固件版本不一致，须分别回滚');
    const candidates = await this.firmwareService.list(context, { tenantId: source.tenantId, productId: source.productId, seed: context.seed, page: 1, pageSize: 100 });
    if ('error' in candidates) return error('VALIDATION_ERROR', '无法读取回滚固件');
    const prior = candidates.data.items.find(firmware => firmware.version === priorVersion && firmware.status === 'released' && firmware.checksumValid);
    if (!prior) return error('VALIDATION_ERROR', `原版本 ${priorVersion} 没有已发布固件`);
    const rollbackIds = [...new Set(succeeded.map(execution => execution.deviceId))];
    const newId = `ota_new_${String(this.tasks.length + 1).padStart(3, '0')}`, now = time(this.tasks.length + 1);
    const event = this.event(newId, 'rollback.created', `从 ${id} 创建反向升级任务，目标 ${rollbackIds.length} 台设备`);
    const task: OtaTask = { id: newId, tenantId: source.tenantId, firmwareId: prior.id, productId: source.productId,
      targetSelector: { deviceIds: rollbackIds, tags: [] }, batches: [100], failureThreshold: 1, status: 'draft', kind: 'rollback', sourceTaskId: id,
      failureModes: {}, createdBy: context.actorId, createdAt: now, updatedAt: now, revision: 1, currentBatch: -1, executions: [], events: [event], alarmCreated: false };
    this.tasks.push(task); this.commit(); this.publish([event]); return ok(context, task, newId);
  }
  async historyForDevice(context: Context, deviceId: string): Promise<OtaResult<{ taskId: string; taskStatus: OtaTaskStatus; execution: OtaExecution }[]>> {
    const device = await this.deviceService.get(context, deviceId); if ('error' in device) return error(device.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'NOT_FOUND', device.error.message);
    this.sync(); const rows = this.tasks.filter(task => task.tenantId === device.data.tenantId).flatMap(task => task.executions.filter(execution => execution.deviceId === deviceId).map(execution => ({ taskId: task.id, taskStatus: task.status, execution })));
    return ok(context, rows.sort((a, b) => b.execution.startedAt.localeCompare(a.execution.startedAt)), `device_${deviceId}`);
  }
}
function browserStorage(): Storage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
export const ota = new OtaService(browserStorage());
