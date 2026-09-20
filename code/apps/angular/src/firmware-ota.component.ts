import { Component, OnDestroy, computed, effect, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import type { Context, Role, Scenario } from './dashboard';
import { devices, type Device } from './devices';
import { firmwares, inspectFirmwareFile, type FileInspection, type Firmware, type FirmwareInput, type FirmwareQuery } from './firmware';
import { ota, type FailureMode, type OtaInput, type OtaPreview, type OtaQuery, type OtaTask } from './ota';
import { otaTrend, otaTrendPath } from './ota-trend';
import { otaVersionDistribution } from './ota-version';
import { tenants } from './tenants';

type Action = 'verify' | 'release' | 'archive' | 'remove' | 'start' | 'pause' | 'resume' | 'cancel' | 'retry' | 'rollback';
const otaActionLabels: Record<Action, string> = { verify: '校验', release: '发布', archive: '归档', remove: '删除', start: '开始', pause: '暂停', resume: '继续', cancel: '取消', retry: '重试', rollback: '回滚' };
const fBase = (tenantId = localStorage.getItem('iot-atlas-current-tenant-v1') || 'all'): FirmwareQuery => ({ tenantId, seed: 42, page: 1, pageSize: 10 });
const oBase = (tenantId = localStorage.getItem('iot-atlas-current-tenant-v1') || 'all'): OtaQuery => ({ tenantId, seed: 42, page: 1, pageSize: 10 });
const emptyFirmware = (tenantId: string): Omit<FirmwareInput, keyof FileInspection> => ({ tenantId, productId: tenantId === 'ten_202609_002' ? 'prod_as_002' : 'prod_as_001', compatibleProductIds: [tenantId === 'ten_202609_002' ? 'prod_as_002' : 'prod_as_001'], name: '', version: '', description: '' });
const emptyOta = (tenantId: string): OtaInput => ({ tenantId, firmwareId: '', productId: tenantId === 'ten_202609_002' ? 'prod_as_002' : 'prod_as_001', targetSelector: { deviceIds: [], tags: [] }, batches: [10, 30, 60], failureThreshold: 0.2, failureModes: {} });
const finished = (status: OtaTask['status']) => ['draft', 'paused', 'succeeded', 'failed', 'cancelled', 'rolledBack'].includes(status);

@Component({ selector: 'app-firmware-ota', standalone: true, imports: [MatButtonModule, MatCardModule], templateUrl: './firmware-ota.component.html', styleUrls: ['./dashboard.css', './products.css', './firmware-ota.css'] })
export class FirmwareOtaComponent implements OnDestroy {
  readonly Math = Math;
  readonly Object = Object;
  readonly encodeURIComponent = encodeURIComponent;
  readonly tenants = [{ id: 'all', name: '全部租户' }, { id: 'ten_202609_001', name: '华东智联' }, { id: 'ten_202609_002', name: '全球能源' }];
  readonly products = [{ id: 'prod_as_001', name: '工业温湿度传感器' }, { id: 'prod_as_002', name: '能源网关' }];
  readonly productNames: Record<string, string> = { prod_as_001: '工业温湿度传感器', prod_as_002: '能源网关' };
  readonly firmwareStatus: Record<Firmware['status'], string> = { draft: '草稿', verified: '已校验', released: '已发布', archived: '已归档' };
  readonly taskStatus: Record<OtaTask['status'], string> = { draft: '草稿', queued: '等待', downloading: '下载', verifying: '校验', installing: '安装', rebooting: '重启', paused: '已暂停', succeeded: '成功', failed: '失败', cancelled: '已取消', rollingBack: '回滚中', rolledBack: '已回滚' };
  readonly firmwareSteps = ['选择文件', '确认元数据与校验', '适配产品与提交'];
  readonly otaSteps = ['选择固件', '选择目标设备', '灰度配置', '影响预览', '确认创建'];
  readonly tab = signal<'firmware' | 'ota'>(new URLSearchParams(location.search).get('tab') === 'ota' ? 'ota' : 'firmware');
  readonly role = signal<Role>('platformAdmin'); readonly scenario = signal<Scenario>('normal');
  readonly themeChoice = signal(localStorage.getItem('iot-atlas-theme') || 'dark');
  readonly systemDark = signal(matchMedia('(prefers-color-scheme: dark)').matches);
  readonly dark = computed(() => this.themeChoice() === 'dark' || (this.themeChoice() === 'system' && this.systemDark()));
  readonly canManage = computed(() => this.role() === 'platformAdmin' || this.role() === 'tenantAdmin');
  readonly canOperate = computed(() => this.role() !== 'viewer');
  readonly message = signal('');
  readonly fDraftFilter = signal<FirmwareQuery>(fBase()); readonly fFilter = signal<FirmwareQuery>(fBase()); readonly fRows = signal<Firmware[]>([]); readonly fTotal = signal(0);
  readonly selectedFirmware = signal<(Firmware & { referencedTaskIds: string[] }) | null>(null); readonly fStep = signal(0); readonly fileState = signal<'idle' | 'reading' | 'ready'>('idle'); readonly fileProgress = signal(0); readonly fileInfo = signal<FileInspection | null>(null); readonly fInput = signal(emptyFirmware('ten_202609_001'));
  readonly versionPeers = signal<Firmware[]>([]);
  readonly oDraftFilter = signal<OtaQuery>(oBase()); readonly oFilter = signal<OtaQuery>(oBase()); readonly oRows = signal<OtaTask[]>([]); readonly oTotal = signal(0);
  readonly task = signal<OtaTask | null>(null); readonly oStep = signal(0); readonly oInput = signal<OtaInput>(emptyOta('ten_202609_001')); readonly preview = signal<OtaPreview | null>(null); readonly options = signal<Firmware[]>([]); readonly targets = signal<Device[]>([]); readonly connected = signal(true);
  readonly capacityNote = signal('');
  private capacityRequest = 0;
  readonly confirm = signal<{ action: Action; deviceId?: string } | null>(null); readonly deviceFilter = signal<'all' | 'failed' | 'succeeded'>('all'); readonly reasonFilter = signal('');
  readonly latest = computed(() => this.task() ? [...new Map(this.task()!.executions.map(item => [item.deviceId, item])).values()] : []);
  readonly taskTrend = computed(() => this.task() ? otaTrend(this.task()!) : []);
  readonly versionDistribution = computed(() => this.task() ? otaVersionDistribution(this.task()!) : []);
  readonly otaTrendPath = otaTrendPath;
  readonly done = computed(() => this.latest().filter(item => item.status === 'succeeded').length);
  readonly failed = computed(() => this.latest().filter(item => item.status === 'failed').length);
  readonly progress = computed(() => this.task() ? Math.round((this.done() + this.failed()) / this.task()!.targetSelector.deviceIds.length * 100) : 0);
  readonly filteredExecutions = computed(() => this.task()?.executions.filter(item => (this.deviceFilter() === 'all' || item.status === this.deviceFilter()) && (!this.reasonFilter() || item.reason?.includes(this.reasonFilter()))) ?? []);
  readonly confirmationText = computed(() => { const confirm = this.confirm(); if (!confirm) return ''; const texts: Record<Action, string> = { verify: '验证固件 SHA-256 元数据。', release: '发布后可被 OTA 任务选择，正式版本不可覆盖。', archive: '归档后不可创建新的 OTA。', remove: '删除固件元数据；引用任务仍存在时会被阻止。', start: `开始影响 ${this.task()?.targetSelector.deviceIds.length ?? 0} 台设备的升级。`, pause: '暂停当前任务，设备进度暂不推进。', resume: '继续任务并可能启动下一灰度批次。', cancel: '取消任务并保留已产生的记录。', retry: `重试设备 ${confirm.deviceId ?? ''}，保留原失败尝试。`, rollback: `将 ${this.done()} 台成功设备恢复到原版本，并新建反向升级任务。` }; return texts[confirm.action]; });
  private media = matchMedia('(prefers-color-scheme: dark)');
  private updateMedia = () => { this.systemDark.set(this.media.matches); if (this.themeChoice() === 'system') this.applyTheme(); };
  private busy = false;
  private fileReadToken = 0;
  private timer: ReturnType<typeof setInterval>;
  constructor() { this.media.addEventListener('change', this.updateMedia); this.applyTheme(); void this.loadFirmware(); void this.loadOta(); const id = new URLSearchParams(location.search).get('task'); if (id) void this.openTask(id);
    this.timer = setInterval(() => void this.autoAdvance(), 900);
    effect(() => {
      const task = this.task(), role = this.role(); this.scenario();
      if (task && ['draft', 'paused'].includes(task.status) && role !== 'viewer') void this.loadOtaCapacity(task.tenantId, task.status);
      else { this.capacityRequest++; this.capacityNote.set(''); }
    });
  }
  ngOnDestroy() { this.media.removeEventListener('change', this.updateMedia); clearInterval(this.timer); }
  private context(): Context { return { actorId: 'usr_202609_001', role: this.role(), tenantId: this.role() === 'platformAdmin' ? 'all' : 'ten_202609_001', seed: 42, scenario: this.scenario() }; }
  private async loadOtaCapacity(tenantId: string, status: OtaTask['status']) { const request = ++this.capacityRequest; this.capacityNote.set('正在查询 OTA 并发配额…'); const context = this.context(); const quotaContext = context.role === 'operator' ? { ...context, role: 'tenantAdmin' as const } : context; const result = await tenants.checkCapacity(quotaContext, tenantId, 'otaConcurrent'); if (request !== this.capacityRequest) return; const action = status === 'paused' ? '继续' : '启动'; this.capacityNote.set('error' in result ? result.error.message : `OTA 并发已用 ${result.data.used}/${result.data.limit}${(result.data.used + 1) / result.data.limit * 100 >= result.data.warningAt ? `；${action}后达到 ${result.data.warningAt}% 预警阈值` : ''}`); }
  setTheme(value: string) { this.themeChoice.set(value); this.applyTheme(); }
  private applyTheme() { document.documentElement.dataset['theme'] = this.dark() ? 'dark' : 'light'; localStorage.setItem('iot-atlas-theme', this.themeChoice()); }
  setRole(value: Role) { this.role.set(value); const id = value === 'platformAdmin' ? 'all' : 'ten_202609_001'; this.fDraftFilter.set(fBase(id)); this.fFilter.set(fBase(id)); this.oDraftFilter.set(oBase(id)); this.oFilter.set(oBase(id)); this.selectedFirmware.set(null); this.task.set(null); this.fStep.set(0); this.oStep.set(0); this.message.set(''); void this.loadFirmware(); void this.loadOta(); }
  setScenario(value: Scenario) { this.scenario.set(value); void this.loadFirmware(); void this.loadOta(); }
  setFDraft(key: keyof FirmwareQuery, value: unknown) { this.fDraftFilter.update(current => ({ ...current, [key]: value })); }
  setODraft(key: keyof OtaQuery, value: unknown) { this.oDraftFilter.update(current => ({ ...current, [key]: value })); }
  applyF() { this.fFilter.set({ ...this.fDraftFilter(), page: 1 }); void this.loadFirmware(); }
  applyO() { this.oFilter.set({ ...this.oDraftFilter(), page: 1 }); void this.loadOta(); }
  changeFPage(delta: number) { this.fFilter.update(current => ({ ...current, page: current.page + delta })); void this.loadFirmware(); }
  changeOPage(delta: number) { this.oFilter.update(current => ({ ...current, page: current.page + delta })); void this.loadOta(); }
  async loadFirmware() { const result = await firmwares.list(this.context(), this.fFilter()); if ('error' in result) this.message.set(result.error.message); else { this.fRows.set(result.data.items); this.fTotal.set(result.data.total); } }
  async loadOta() { const result = await ota.list(this.context(), this.oFilter()); if ('error' in result) this.message.set(result.error.message); else { this.oRows.set(result.data.items); this.oTotal.set(result.data.total); } }
  async openFirmware(id: string) { const result = await firmwares.get(this.context(), id); if ('error' in result) { this.message.set(result.error.message); return; } this.selectedFirmware.set(result.data); this.fStep.set(0); const peers = await firmwares.list(this.context(), { tenantId: result.data.tenantId, productId: result.data.productId, seed: 42, page: 1, pageSize: 100 }); if ('data' in peers) this.versionPeers.set(peers.data.items); else this.message.set(peers.error.message); }
  newFirmware() { this.selectedFirmware.set(null); this.fInput.set(emptyFirmware(this.fFilter().tenantId === 'all' ? 'ten_202609_001' : this.fFilter().tenantId)); this.fileInfo.set(null); this.fileState.set('idle'); this.fStep.set(1); this.message.set(''); }
  cancelFile() { this.fileReadToken++; this.fileInfo.set(null); this.fileProgress.set(0); this.fileState.set('idle'); this.fStep.set(0); }
  async selectFile(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; const token = ++this.fileReadToken; this.fileState.set('reading'); this.fileProgress.set(0); this.fileInfo.set(null); const result = await inspectFirmwareFile(file, percent => { if (token === this.fileReadToken) this.fileProgress.set(percent); }); if (token !== this.fileReadToken) return; if ('error' in result) { this.message.set(result.error.message); this.fileState.set('idle'); this.fileProgress.set(0); return; } this.fileInfo.set(result); this.fileProgress.set(100); this.fileState.set('ready'); this.message.set('SHA-256 校验完成，文件内容仅用于本次读取'); }
  setFInput(key: keyof Omit<FirmwareInput, keyof FileInspection>, value: unknown) { this.fInput.update(current => ({ ...current, [key]: value })); }
  setNewTenant(id: string) { this.fInput.set(emptyFirmware(id)); }
  async saveFirmware() { const file = this.fileInfo(); if (!file) return; const result = await firmwares.create(this.context(), { ...this.fInput(), ...file }); if ('error' in result) { this.message.set(result.error.message); return; } this.fStep.set(0); await this.loadFirmware(); this.message.set('固件元数据已登记为草稿，请验证并发布'); await this.openFirmware(result.data.id); }
  async newOta() { const id = this.oFilter().tenantId === 'all' ? 'ten_202609_001' : this.oFilter().tenantId; this.task.set(null); this.oInput.set(emptyOta(id)); this.preview.set(null); this.oStep.set(1); this.message.set(''); await this.loadFirmwareOptions(id); }
  async loadFirmwareOptions(id: string) { const result = await firmwares.list(this.context(), { tenantId: id, seed: 42, page: 1, pageSize: 100 }); if ('data' in result) this.options.set(result.data.items.filter(row => row.status === 'released' && row.checksumValid)); else this.message.set(result.error.message); }
  setOtaTenant(id: string) { this.oInput.set(emptyOta(id)); void this.loadFirmwareOptions(id); }
  async chooseFirmware(id: string) { const row = this.options().find(item => item.id === id); this.oInput.update(current => ({ ...current, firmwareId: id, productId: row?.productId ?? current.productId, targetSelector: { deviceIds: [], tags: [] } })); if (row) { const result = await devices.list(this.context(), { tenantId: row.tenantId, seed: 42, productId: row.productId, page: 1, pageSize: 100 }); if ('data' in result) this.targets.set(result.data.items); else this.message.set(result.error.message); } }
  target(id: string, checked: boolean) { this.oInput.update(current => ({ ...current, targetSelector: { ...current.targetSelector, deviceIds: checked ? [...current.targetSelector.deviceIds, id] : current.targetSelector.deviceIds.filter(item => item !== id) } })); }
  setOtaTags(value: string) { this.oInput.update(current => ({ ...current, targetSelector: { ...current.targetSelector, tags: value.split(',').map(item => item.trim()).filter(Boolean) } })); }
  setBatches(value: string) { this.oInput.update(current => ({ ...current, batches: value.split(',').map(Number) })); }
  setThreshold(value: string) { this.oInput.update(current => ({ ...current, failureThreshold: Number(value) / 100 })); }
  setFailureDevice(id: string) { this.oInput.update(current => ({ ...current, failureModes: id ? { [id]: 'download' } : {} })); }
  setFailureMode(mode: FailureMode) { const id = Object.keys(this.oInput().failureModes)[0]; if (id) this.oInput.update(current => ({ ...current, failureModes: { [id]: mode } })); }
  async previewOta() { const result = await ota.preview(this.context(), this.oInput()); if ('error' in result) { this.message.set(result.error.message); return; } this.preview.set(result.data); this.oStep.set(4); this.message.set('影响预览已生成；请核对目标和失败阈值'); }
  async createOta() { const result = await ota.create(this.context(), this.oInput()); if ('error' in result) { this.message.set(result.error.message); return; } this.task.set(result.data); this.oStep.set(0); this.tab.set('ota'); await this.loadOta(); this.message.set('OTA 草稿已创建；确认后开始模拟'); }
  async openTask(id: string) { const result = await ota.get(this.context(), id); if ('error' in result) this.message.set(result.error.message); else { this.task.set(result.data); this.oStep.set(0); this.connected.set(true); this.tab.set('ota'); } }
  private async autoAdvance() { const current = this.task(); if (this.busy || !current || !this.connected() || finished(current.status)) return; this.busy = true; const result = await ota.advance(this.context(), current.id); if ('error' in result) { this.message.set(result.error.message); this.connected.set(false); } else { this.task.set(result.data); void this.loadOta(); } this.busy = false; }
  async manualAdvance() { const current = this.task(); if (!current) return; const result = await ota.advance(this.context(), current.id); if ('data' in result) { this.task.set(result.data); void this.loadOta(); } else this.message.set(result.error.message); }
  async runAction() { const confirm = this.confirm(); if (!confirm) return; const action = confirm.action; this.confirm.set(null);
    const selected = this.selectedFirmware(); if (['verify', 'release', 'archive', 'remove'].includes(action) && selected) { const result = action === 'remove' ? await firmwares.remove(this.context(), selected.id, selected.revision) : await firmwares.transition(this.context(), selected.id, action as 'verify' | 'release' | 'archive', selected.revision); if ('error' in result) { this.message.set(result.error.message); return; } if (action === 'remove') this.selectedFirmware.set(null); else await this.openFirmware(selected.id); this.message.set(`固件操作已完成：${action}`); await this.loadFirmware(); }
    else { const current = this.task(); if (!current) return; const id = current.id, version = current.revision; const result = action === 'start' ? await ota.start(this.context(), id, version) : action === 'pause' ? await ota.pause(this.context(), id, version) : action === 'resume' ? await ota.resume(this.context(), id, version) : action === 'cancel' ? await ota.cancel(this.context(), id, version) : action === 'retry' ? await ota.retry(this.context(), id, confirm.deviceId ?? '', version) : await ota.rollback(this.context(), id, version); if ('error' in result) { this.message.set(result.error.message); return; } this.task.set(result.data); this.connected.set(true); this.message.set(action === 'rollback' ? `已创建独立回滚任务 ${result.data.id}，原任务历史保留` : `OTA 操作已完成：${otaActionLabels[action]}`); await this.loadOta(); }
  }
  displayTime(value: string) { return new Date(value).toLocaleString('zh-CN'); }
  countFor(percentages: number[], total: number) { let cumulative = 0, previous = 0; return percentages.map((percent, index) => { cumulative += percent; const boundary = index === percentages.length - 1 ? total : Math.ceil(total * cumulative / 100); const count = boundary - previous; previous = boundary; return count; }); }
  hasNewerAttempt(deviceId: string, attempt: number) { return this.task()?.executions.some(item => item.deviceId === deviceId && item.attempt > attempt) ?? false; }
}
