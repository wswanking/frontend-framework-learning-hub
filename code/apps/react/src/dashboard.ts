// IOT-DOMAIN-001 / IOT-DASH-001. This project owns its Mock implementation.
import { currentDeviceFacts, type DeviceFact } from './device-facts';
import { deviceEvents } from './device-events';
import { ota, type OtaTask } from './ota';
import { summarizeOperations } from './dashboard-operations';
import { recordedCount, recordedMessagesInRange } from './message-volume';
import { tenants } from './tenants';
export type Role = 'platformAdmin' | 'tenantAdmin' | 'operator' | 'viewer';
export type Scenario = 'normal' | 'slow' | 'partialFailure' | 'forbidden' | 'offline';
export type Context = { actorId: string; role: Role; tenantId: string; seed: number; scenario: Scenario };
export type DashboardQuery = { tenantId: string; from: string; to: string; seed: number; region?: string; productId?: string };
export type ApiError = { error: { code: 'VALIDATION_ERROR' | 'FORBIDDEN' | 'SCENARIO_TIMEOUT'; message: string; fieldErrors?: Record<string, string>; retryable?: boolean } };
export type ApiSuccess<T> = { data: T; meta: { requestId: string; seed: number; generatedAt: string } };
export type ApiResult<T> = ApiSuccess<T> | ApiError;

type Device = DeviceFact;
const NODE_COORDINATES: Record<string, [number, number]> = {
  node_cn_001: [121.47, 31.23], node_de_001: [13.41, 52.52], node_us_001: [-74.01, 40.71],
  node_br_001: [-46.63, -23.55], node_za_001: [28.05, -26.2], node_au_001: [151.21, -33.87],
  node_jp_001: [139.69, 35.68], node_fr_001: [2.35, 48.86], node_ca_001: [-79.38, 43.65],
  node_ar_001: [-58.38, -34.6], node_eg_001: [31.24, 30.04], node_nz_001: [174.76, -36.85],
};

export type DashboardData = {
  metrics: { devices: number; onlineDevices: number; onlineRate: number | null; messages: number; activeAlarms: number; otaSuccessRate: number | null };
  comparison: { devices: number; onlineDevices: number; onlineRate: number | null; messages: number; activeAlarms: number; otaSuccessRate: number | null };
  updatedAt: string;
  continents: { id: string; devices: number; messages: number }[];
  countries: { id: string; continent: string; devices: number; messages: number }[];
  nodes: { id: string; countryCode: string; coordinates: [number, number] | null; devices: number; messages: number; deviceIds: string[] }[];
  trend: { timestamp: string; messages: number }[];
  alarmDistribution: { severity: 'critical' | 'major' | 'minor'; count: number }[];
  events: { id: string; type: 'telemetry.appended' | 'alarm.created'; occurredAt: string; tenantId: string; resourceId: string; payload: { messages: number }; severity: 'critical' | 'major' | 'minor' | 'info'; seed: number }[];
  unavailable: ('geography')[];
};

const DAY = 86_400_000;
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
function validUtc(value: string, epoch: number): boolean {
  return UTC_ISO.test(value) && Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 19) === value.slice(0, 19);
}
function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}
function failure(code: ApiError['error']['code'], message: string, fieldErrors?: Record<string, string>): ApiError {
  return { error: { code, message, ...(fieldErrors ? { fieldErrors } : {}), retryable: code === 'SCENARIO_TIMEOUT' } };
}
function countFor(device: Device, day: number, seed: number): number {
  return device.online ? 70 + hash(`${seed}:${device.id}:${day}`) % 61 : 0;
}
type DayPart = { day: number; ratio: number };
function dayParts(from: number, to: number): DayPart[] {
  const parts: DayPart[] = [];
  for (let day = Math.floor(from / DAY); day * DAY < to; day++) parts.push({ day, ratio: (Math.min(to, (day + 1) * DAY) - Math.max(from, day * DAY)) / DAY });
  return parts;
}
function messagesFor(device: Device, days: DayPart[], seed: number): number {
  return days.reduce((sum, part) => sum + Math.round(countFor(device, part.day, seed) * part.ratio), 0);
}
function group<K extends string>(devices: Device[], key: (device: Device) => K, seed: number, days: DayPart[], recorded: Parameters<typeof recordedCount>[0], from: number, to: number): { id: K; devices: number; messages: number }[] {
  const result = new Map<K, { id: K; devices: number; messages: number }>();
  for (const device of devices) {
    const id = key(device);
    const item = result.get(id) ?? { id, devices: 0, messages: 0 };
    item.devices++;
    item.messages += messagesFor(device, days, seed) + recordedCount(recorded, device.id, from, to);
    result.set(id, item);
  }
  return [...result.values()].sort((a, b) => b.devices - a.devices || a.id.localeCompare(b.id));
}

export async function getSummary(context: Context, query: DashboardQuery, sources: { deviceEvents: typeof deviceEvents; ota: typeof ota } = { deviceEvents, ota }): Promise<ApiResult<DashboardData>> {
  if (context.scenario === 'forbidden' || (context.role !== 'platformAdmin' && (context.tenantId !== query.tenantId || query.tenantId === 'all'))) {
    return failure('FORBIDDEN', '无权查看该租户数据');
  }
  if (context.scenario === 'offline') return failure('SCENARIO_TIMEOUT', '模拟服务暂不可用');
  const from = Date.parse(query.from), to = Date.parse(query.to);
  const errors: Record<string, string> = {};
  if (!Number.isInteger(query.seed) || query.seed !== context.seed) errors.seed = 'seed 必须与请求上下文一致';
  if (!validUtc(query.from, from) || !validUtc(query.to, to) || from >= to || to - from > 30 * DAY) errors.range = '时间范围必须为 UTC 且有效，并且不超过 30 天';
  if (query.tenantId !== 'all' && 'error' in await tenants.get(context, query.tenantId)) errors.tenantId = '未知租户';
  if (Object.keys(errors).length) return failure('VALIDATION_ERROR', '查询条件无效', errors);
  if (context.scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 80));
  const inventory = await currentDeviceFacts(context, query.tenantId);
  if ('error' in inventory) return failure(inventory.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : inventory.error.code === 'VALIDATION_ERROR' ? 'VALIDATION_ERROR' : 'SCENARIO_TIMEOUT', inventory.error.message);
  const selected = inventory.data.filter(device => (query.tenantId === 'all' || device.tenantId === query.tenantId) && (!query.region || device.continent === query.region) && (!query.productId || device.productId === query.productId));
  const messageResults = await Promise.all(selected.map(device => sources.deviceEvents.listMessages(context, device.id)));
  const messageFailure = messageResults.find(result => 'error' in result);
  if (messageFailure && 'error' in messageFailure) return failure(messageFailure.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'SCENARIO_TIMEOUT', messageFailure.error.message);
  const recorded = messageResults.flatMap(result => 'data' in result ? result.data : []).filter(message => !message.id.startsWith('msg_seed_'));
  const alarmResults = await Promise.all(selected.map(device => sources.deviceEvents.listAlarms(context, device.id)));
  const alarmFailure = alarmResults.find(result => 'error' in result);
  if (alarmFailure && 'error' in alarmFailure) return failure(alarmFailure.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'SCENARIO_TIMEOUT', alarmFailure.error.message);
  const alarms = alarmResults.flatMap(result => 'data' in result ? result.data : []);
  const tasks: OtaTask[] = [];
  for (let page = 1; ; page++) {
    const result = await sources.ota.list(context, { tenantId: query.tenantId, seed: query.seed, page, pageSize: 100 });
    if ('error' in result) return failure(result.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : result.error.code === 'VALIDATION_ERROR' ? 'VALIDATION_ERROR' : 'SCENARIO_TIMEOUT', result.error.message);
    tasks.push(...result.data.items);
    if (tasks.length >= result.data.total || !result.data.items.length) break;
  }
  const operations = summarizeOperations(selected, alarms, tasks, from, to);
  const previousOperations = summarizeOperations(selected, alarms, tasks, from - (to - from), from);
  const days = dayParts(from, to);
  const previousDays = dayParts(from - (to - from), from);
  const trend = days.map(part => ({ timestamp: new Date(Math.max(from, part.day * DAY)).toISOString(), messages: selected.reduce((sum, device) => sum + Math.round(countFor(device, part.day, query.seed) * part.ratio) + recordedCount(recorded, device.id, Math.max(from, part.day * DAY), Math.min(to, (part.day + 1) * DAY)), 0) }));
  const messages = trend.reduce((sum, bucket) => sum + bucket.messages, 0);
  const onlineDevices = selected.filter(device => device.online).length;
  const continents = group(selected, device => device.continent, query.seed, days, recorded, from, to);
  const countries = group(selected, device => device.countryCode, query.seed, days, recorded, from, to).map(item => ({ ...item, continent: selected.find(device => device.countryCode === item.id)!.continent }));
  const nodes = group(selected, device => device.nodeId, query.seed, days, recorded, from, to).map(item => ({ ...item, countryCode: selected.find(device => device.nodeId === item.id)!.countryCode, coordinates: NODE_COORDINATES[item.id] ?? selected.find(device => device.nodeId === item.id && device.location)?.location ?? null, deviceIds: selected.filter(device => device.nodeId === item.id).map(device => device.id).sort() }));
  const telemetryEvents = selected.filter(device => device.online).map((device, index) => ({
    id: `evt_${device.id}_${query.seed}`,
    type: 'telemetry.appended' as const,
    occurredAt: new Date(Math.max(from, to - (index + 1) * 60_000)).toISOString(),
    tenantId: device.tenantId, resourceId: device.id, payload: { messages: messages ? 1 : 0 }, severity: 'info' as const, seed: query.seed,
  }));
  const alarmEvents = operations.alarmEvents.map(alarm => ({ ...alarm, type: 'alarm.created' as const, payload: { messages: 0 }, seed: query.seed }));
  const recordedEvents = recordedMessagesInRange(recorded, from, to).map(message => ({ id: message.id, type: 'telemetry.appended' as const, occurredAt: message.occurredAt, tenantId: message.tenantId, resourceId: message.deviceId, payload: { messages: 1 }, severity: 'info' as const, seed: query.seed }));
  const events: DashboardData['events'] = [...telemetryEvents, ...alarmEvents, ...recordedEvents].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id));
  const metrics = { devices: selected.length, onlineDevices, onlineRate: selected.some(device => device.status !== 'unactivated') ? onlineDevices / selected.filter(device => device.status !== 'unactivated').length : null, messages, activeAlarms: operations.activeAlarms, otaSuccessRate: operations.otaSuccessRate };
  const comparison = { ...metrics, messages: selected.reduce((sum, device) => sum + messagesFor(device, previousDays, query.seed) + recordedCount(recorded, device.id, from - (to - from), from), 0), activeAlarms: previousOperations.activeAlarms, otaSuccessRate: previousOperations.otaSuccessRate };
  return {
    data: {
      metrics, comparison, updatedAt: new Date(to).toISOString(),
      continents: context.scenario === 'partialFailure' ? [] : continents,
      countries: context.scenario === 'partialFailure' ? [] : countries,
      nodes: context.scenario === 'partialFailure' ? [] : nodes,
      trend, alarmDistribution: operations.alarmDistribution, events, unavailable: context.scenario === 'partialFailure' ? ['geography'] : [],
    },
    meta: { requestId: `req_${hash(JSON.stringify([context.actorId, query]))}`, seed: query.seed, generatedAt: new Date(to).toISOString() },
  };
}
