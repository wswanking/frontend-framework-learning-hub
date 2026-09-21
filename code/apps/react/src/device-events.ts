// IOT-DEVICE-001. Device messages and acknowledgable Mock alarms belong to this app.
import type { Context } from './dashboard';
import { devices, initialDeviceReport, type Device, type DeviceResult, type DeviceService, type TelemetryPoint } from './devices';
import { RuleService } from './rules';
import { OtaService } from './ota';
import { firmwares } from './firmware';
import { TenantService } from './tenants';

export type DeviceMessage = { id: string; tenantId: string; deviceId: string; productId: string; occurredAt: string; kind: 'property'; payload: Record<string, number | string | boolean> };
export type DeviceAlarm = { id: string; tenantId: string; deviceId: string; occurredAt: string; severity: 'warning' | 'critical' | 'major'; source: 'device' | 'rule' | 'ota'; taskId?: string; description: string; status: 'open' | 'acknowledged'; acknowledgedAt?: string; acknowledgedBy?: string };
const MESSAGE_KEY = 'iot-atlas-device-messages-v1';
const ACK_KEY = 'iot-atlas-device-alarm-acks-v1';
const clone = <T>(value: T): T => structuredClone(value);
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const validUtc = (value: string) => UTC.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);

export class DeviceEventService {
  private messages: DeviceMessage[] = [];
  private acknowledgements: Record<string, { at: string; actorId: string }> = {};
  constructor(private storage: Storage | null = null, private deviceService: DeviceService = devices, private otaService: OtaService = new OtaService(storage, firmwares, deviceService), private ruleService: RuleService = new RuleService(storage)) { this.sync(); }
  private sync() {
    if (!this.storage) return;
    try {
      const messages = JSON.parse(this.storage.getItem(MESSAGE_KEY) ?? '[]') as DeviceMessage[];
      if (Array.isArray(messages)) this.messages = messages.filter(item => item && typeof item.id === 'string' && typeof item.deviceId === 'string' && typeof item.occurredAt === 'string' && item.payload);
      const acks = JSON.parse(this.storage.getItem(ACK_KEY) ?? '{}') as Record<string, { at: string; actorId: string }>;
      if (acks && !Array.isArray(acks) && typeof acks === 'object') this.acknowledgements = acks;
    } catch { /* Invalid local demo data does not hide seed events. */ }
  }
  private commit() { try { this.storage?.setItem(MESSAGE_KEY, JSON.stringify(this.messages)); this.storage?.setItem(ACK_KEY, JSON.stringify(this.acknowledgements)); if (typeof window !== 'undefined') window.dispatchEvent(new Event('iot-atlas-mock-changed')); } catch { /* Keep the current session usable. */ } }
  private async device(context: Context, id: string): Promise<DeviceResult<Device>> { return this.deviceService.get(context, id); }
  async listMessages(context: Context, id: string): Promise<DeviceResult<DeviceMessage[]>> {
    const found = await this.device(context, id); if ('error' in found) return found;
    this.sync(); const device = found.data;
    const report = initialDeviceReport(id);
    const initial: DeviceMessage[] = report ? [{ id: `msg_seed_${id}`, tenantId: device.tenantId, deviceId: id, productId: device.productId, occurredAt: report.lastActiveAt, kind: 'property', payload: report.attributes }] : [];
    const items = [...initial, ...this.messages.filter(item => item.deviceId === id && item.tenantId === device.tenantId)].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
    return { data: clone(items), meta: found.meta };
  }
  async recordTelemetry(context: Context, id: string, points: TelemetryPoint[]): Promise<DeviceResult<DeviceMessage | null>> {
    const found = await this.device(context, id); if ('error' in found) return found;
    const device = found.data;
    if (!points.length) return { data: null, meta: found.meta };
    const occurredAt = points[0].timestamp;
    if (!validUtc(occurredAt) || points.some(point => point.deviceId !== id || point.timestamp !== occurredAt || !(point.metric in device.attributes) || point.value !== null && !Number.isFinite(point.value) || !['good', 'stale', 'invalid', 'missing'].includes(point.quality))) return { error: { code: 'VALIDATION_ERROR', message: '遥测点与设备不匹配' } };
    const valid = points.filter(point => point.value !== null && point.quality !== 'invalid' && point.quality !== 'missing');
    if (!valid.length) return { data: null, meta: found.meta };
    this.sync();
    const key = `msg_${id}_${occurredAt}`;
    const existing = this.messages.find(item => item.id === key);
    if (existing) return { data: clone(existing), meta: found.meta };
    const beforeCount = this.messages.filter(item => item.tenantId === device.tenantId && !item.id.startsWith('msg_seed_')).length;
    const quotaContext = context.role === 'operator' || context.role === 'viewer' ? { ...context, role: 'tenantAdmin' as const } : context;
    const capacity = await new TenantService(this.storage).checkCapacity(quotaContext, device.tenantId, 'messages');
    if ('error' in capacity) return { error: { code: capacity.error.code, message: capacity.error.message } };
    this.sync();
    const concurrent = this.messages.find(item => item.id === key);
    if (concurrent) return { data: clone(concurrent), meta: found.meta };
    const latestCount = this.messages.filter(item => item.tenantId === device.tenantId && !item.id.startsWith('msg_seed_')).length;
    const used = capacity.data.used + latestCount - (this.storage ? beforeCount : 0);
    if (used >= capacity.data.limit) return { error: { code: 'CONFLICT', message: `已达到 messages 配额上限：已用 ${used}/${capacity.data.limit}；请清理资源或申请提高配额` } };
    const payload: DeviceMessage['payload'] = {};
    for (const point of valid) payload[point.metric] = point.value as number;
    const saved: DeviceMessage = { id: key, tenantId: device.tenantId, deviceId: id, productId: device.productId, occurredAt, kind: 'property', payload };
    this.messages.unshift(saved); this.commit();
    if (context.role !== 'viewer') {
      for (let page = 1; ; page++) {
        const eligible = await this.ruleService.list(context, { tenantId: device.tenantId, productId: device.productId, enabled: true, page, pageSize: 100, seed: context.seed });
        if ('error' in eligible) break;
        for (const flow of eligible.data.items) await this.ruleService.consumeEvent(context, flow.id, { deviceId: id, productId: device.productId, occurredAt, properties: { ...device.attributes, ...payload } });
        if (page * eligible.data.pageSize >= eligible.data.total) break;
      }
    }
    return { data: clone(saved), meta: found.meta };
  }
  async listAlarms(context: Context, id: string): Promise<DeviceResult<DeviceAlarm[]>> {
    const found = await this.device(context, id); if ('error' in found) return found;
    this.sync(); const device = found.data;
    const items: DeviceAlarm[] = device.status === 'fault' ? [{ id: `alarm_fault_${id}`, tenantId: device.tenantId, deviceId: id, occurredAt: device.lastActiveAt ?? device.updatedAt, severity: 'critical', source: 'device', description: '设备故障状态', status: 'open' }] : [];
    for (let page = 1; ; page++) {
      const logs = await this.ruleService.logsFor(context, { tenantId: device.tenantId, deviceId: id, page, pageSize: 100, seed: context.seed });
      if ('error' in logs) return { error: { code: logs.error.code, message: logs.error.message } };
      for (const execution of logs.data.items.filter(item => item.deviceId === id && item.alarmCreated)) items.push({ id: `alarm_rule_${execution.id}`, tenantId: device.tenantId, deviceId: id, occurredAt: execution.occurredAt, severity: 'warning', source: 'rule', description: `规则 ${execution.ruleId} 触发模拟告警`, status: 'open' });
      if (page * logs.data.pageSize >= logs.data.total) break;
    }
    const history = await this.otaService.historyForDevice(context, id);
    if ('error' in history) return { error: { code: history.error.code, message: history.error.message } };
    for (const taskId of new Set(history.data.filter(item => item.execution.status === 'failed').map(item => item.taskId))) {
      const task = await this.otaService.get(context, taskId);
      if ('error' in task) return { error: { code: task.error.code, message: task.error.message } };
      if (!task.data.alarmCreated) continue;
      const event = task.data.events.find(item => item.type === 'threshold.exceeded');
      if (!event) continue;
      items.push({ id: `alarm_ota_${taskId}_${id}`, tenantId: device.tenantId, deviceId: id, occurredAt: event.at, severity: 'major', source: 'ota', taskId, description: `OTA ${taskId} 灰度失败超过阈值`, status: 'open' });
    }
    for (const item of items) { const ack = this.acknowledgements[item.id]; if (ack) { item.status = 'acknowledged'; item.acknowledgedAt = ack.at; item.acknowledgedBy = ack.actorId; } }
    items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
    return { data: clone(items), meta: found.meta };
  }
  async acknowledge(context: Context, deviceId: string, alarmId: string): Promise<DeviceResult<DeviceAlarm>> {
    const found = await this.device(context, deviceId); if ('error' in found) return found;
    if (context.role === 'viewer') return { error: { code: 'FORBIDDEN', message: '观察员不能确认告警' } };
    const listed = await this.listAlarms(context, deviceId); if ('error' in listed) return listed;
    const alarm = listed.data.find(item => item.id === alarmId);
    if (!alarm) return { error: { code: 'NOT_FOUND', message: '告警不存在' } };
    if (alarm.status === 'acknowledged') return { data: alarm, meta: found.meta };
    const at = '2026-09-16T12:00:00.000Z';
    this.acknowledgements[alarmId] = { at, actorId: context.actorId }; this.commit();
    return { data: { ...alarm, status: 'acknowledged', acknowledgedAt: at, acknowledgedBy: context.actorId }, meta: found.meta };
  }
}

export const deviceEvents = new DeviceEventService(typeof localStorage === 'undefined' ? null : localStorage);
