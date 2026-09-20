// IOT-GEO-001. Keep an independent copy of this Mock in each application.
import type { ApiResult, Context } from './dashboard';
import { currentDeviceFacts } from './device-facts';
import { deviceEvents } from './device-events';
import { recordedCount } from './message-volume';
import { tenants } from './tenants';
import { products } from './products';

export type GeoLevel = 'global' | 'continent' | 'country' | 'node';
export type DeviceStatus = 'unactivated' | 'online' | 'offline' | 'fault' | 'maintenance' | 'alarm';
export type GeoQuery = {
  tenantId: string; from: string; to: string; seed: number;
  productId?: string; status?: DeviceStatus; continent?: string; countryCode?: string; nodeId?: string;
  level?: GeoLevel; parentId?: string;
};
export type GeoItem = {
  id: string; name: string; kind: 'continent' | 'country' | 'node' | 'device';
  continent: string; countryCode?: string; nodeId?: string; coordinates: [number, number] | null;
  devices: number; onlineDevices: number; messages: number; alarms: number;
  onlineRate: number | null; lastActiveAt: string | null; status?: DeviceStatus;
};
export type GeoData = {
  level: GeoLevel; parentId: string | null; items: GeoItem[]; unlocated: GeoItem[];
  summary: { devices: number; onlineDevices: number; messages: number; alarms: number; unlocated: number };
  updatedAt: string; mapAvailable: boolean;
};

type Device = { id: string; tenantId: string; productId: string; continent: string; countryCode: string; nodeId: string; status: Exclude<DeviceStatus, 'alarm'>; location: [number, number] | null; lastActiveAt: string | null };
const NODE_LOCATION: Record<string, [number, number]> = {
  node_cn_001: [121.47, 31.23], node_de_001: [13.41, 52.52], node_us_001: [-74.01, 40.71],
  node_br_001: [-46.63, -23.55], node_za_001: [28.05, -26.2], node_au_001: [151.21, -33.87],
  node_jp_001: [139.69, 35.68], node_fr_001: [2.35, 48.86], node_ca_001: [-79.38, 43.65],
  node_ar_001: [-58.38, -34.6], node_eg_001: [31.24, 30.04], node_nz_001: [174.76, -36.85],
};
const CONTINENT_CENTER: Record<string, [number, number]> = { AS: [100, 38], EU: [15, 52], NA: [-101, 42], SA: [-60, -16], AF: [20, 4], OC: [136, -24] };
const COUNTRY_CENTER: Record<string, [number, number]> = { CN: [104, 35], DE: [10, 51], US: [-98, 39], BR: [-52, -10], ZA: [25, -29], AU: [134, -25], JP: [138, 36], FR: [2, 47], CA: [-106, 57], AR: [-64, -35], EG: [30, 27], NZ: [172, -41] };
const ALARMS = new Set(['dev_na_001', 'dev_af_001', 'dev_eu_002', 'dev_sa_002']);
const CONTINENTS: Record<string, string> = { AS: '亚洲', EU: '欧洲', NA: '北美洲', SA: '南美洲', AF: '非洲', OC: '大洋洲' };
const COUNTRIES: Record<string, string> = { CN: '中国', DE: '德国', US: '美国', BR: '巴西', ZA: '南非', AU: '澳大利亚', JP: '日本', FR: '法国', CA: '加拿大', AR: '阿根廷', EG: '埃及', NZ: '新西兰' };
export const geoNames = { continents: CONTINENTS, countries: COUNTRIES };
const DAY = 86_400_000;
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
function validUtc(value: string, epoch: number): boolean {
  return UTC_ISO.test(value) && Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 19) === value.slice(0, 19);
}
function hash(value: string): number { let result = 2166136261; for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619); return result >>> 0; }
function messages(device: Device, from: number, to: number, seed: number, recorded: Parameters<typeof recordedCount>[0]): number {
  if (device.status !== 'online') return recordedCount(recorded, device.id, from, to);
  let total = 0;
  for (let day = Math.floor(from / DAY); day * DAY < to; day++) {
    const fraction = (Math.min(to, (day + 1) * DAY) - Math.max(from, day * DAY)) / DAY;
    total += Math.round((70 + hash(`${seed}:${device.id}:${day}`) % 61) * fraction);
  }
  return total + recordedCount(recorded, device.id, from, to);
}
function aggregate(devices: Device[], kind: GeoItem['kind'], id: string, from: number, to: number, seed: number, recorded: Parameters<typeof recordedCount>[0]): GeoItem {
  const first = devices[0];
  const onlineDevices = devices.filter(device => device.status === 'online').length;
  const lastActiveAt = devices.map(device => device.lastActiveAt).filter((value): value is string => !!value).sort().at(-1) ?? null;
  return {
    id, kind, name: kind === 'continent' ? CONTINENTS[id] ?? id : kind === 'country' ? COUNTRIES[id] ?? id : kind === 'node' ? `${COUNTRIES[first.countryCode] ?? first.countryCode}节点` : id,
    continent: first.continent, countryCode: kind === 'continent' ? undefined : first.countryCode,
    nodeId: kind === 'node' || kind === 'device' ? first.nodeId : undefined,
    coordinates: kind === 'continent' ? CONTINENT_CENTER[id] ?? null : kind === 'country' ? COUNTRY_CENTER[id] ?? null : kind === 'node' ? NODE_LOCATION[first.nodeId] ?? first.location : first.location,
    devices: devices.length, onlineDevices, messages: devices.reduce((sum, device) => sum + messages(device, from, to, seed, recorded), 0),
    alarms: devices.filter(device => ALARMS.has(device.id)).length,
    onlineRate: devices.length ? onlineDevices / devices.length : null, lastActiveAt,
    status: kind === 'device' ? first.status : undefined,
  };
}
function group(devices: Device[], kind: GeoItem['kind'], key: (device: Device) => string, from: number, to: number, seed: number, recorded: Parameters<typeof recordedCount>[0]): GeoItem[] {
  const grouped = new Map<string, Device[]>();
  for (const device of devices) grouped.set(key(device), [...(grouped.get(key(device)) ?? []), device]);
  return [...grouped].map(([id, members]) => aggregate(members, kind, id, from, to, seed, recorded))
    .sort((a, b) => b.devices - a.devices || a.id.localeCompare(b.id));
}
function failure(code: 'FORBIDDEN' | 'SCENARIO_TIMEOUT' | 'VALIDATION_ERROR', message: string, fieldErrors?: Record<string, string>): ApiResult<GeoData> {
  return { error: { code, message, ...(fieldErrors ? { fieldErrors } : {}), retryable: code === 'SCENARIO_TIMEOUT' } };
}

export async function getTopology(context: Context, query: GeoQuery, eventSource: typeof deviceEvents = deviceEvents): Promise<ApiResult<GeoData>> {
  if (context.scenario === 'forbidden' || (context.role !== 'platformAdmin' && (query.tenantId === 'all' || query.tenantId !== context.tenantId))) return failure('FORBIDDEN', '无权查看该租户数据');
  if (context.scenario === 'offline') return failure('SCENARIO_TIMEOUT', '模拟地理服务暂不可用');
  const from = Date.parse(query.from), to = Date.parse(query.to);
  const errors: Record<string, string> = {};
  if (query.seed !== context.seed || !Number.isInteger(query.seed)) errors.seed = 'seed 必须与请求上下文一致';
  if (!validUtc(query.from, from) || !validUtc(query.to, to) || from >= to || to - from > 30 * DAY) errors.range = '时间范围必须为 UTC 且有效，并且不超过 30 天';
  if (query.tenantId !== 'all' && 'error' in await tenants.get(context, query.tenantId)) errors.tenantId = '未知租户';
  if (query.productId && 'error' in await products.get(context, query.productId)) errors.productId = '未知产品';
  if (query.status && !['unactivated', 'online', 'offline', 'fault', 'maintenance', 'alarm'].includes(query.status)) errors.status = '未知状态';
  if (query.continent && !/^[A-Z]{2}$/.test(query.continent)) errors.continent = '洲代码无效';
  if (query.countryCode && !/^[A-Z]{2}$/.test(query.countryCode)) errors.countryCode = '国家代码无效';
  if (query.nodeId && !/^node_[a-z]{2}_(?:\d{3}|local)$/.test(query.nodeId)) errors.nodeId = '节点代码无效';
  const level = query.level ?? 'global';
  if (!['global', 'continent', 'country', 'node'].includes(level)) errors.level = '未知层级';
  if (level !== 'global' && !query.parentId) errors.parentId = '下钻层级需要 parentId';
  if (level === 'continent' && query.parentId && !/^[A-Z]{2}$/.test(query.parentId)) errors.parentId = '洲代码无效';
  if (level === 'country' && query.parentId && !/^[A-Z]{2}$/.test(query.parentId)) errors.parentId = '国家代码无效';
  if (level === 'node' && query.parentId && !/^node_[a-z]{2}_(?:\d{3}|local)$/.test(query.parentId)) errors.parentId = '节点代码无效';
  if (Object.keys(errors).length) return failure('VALIDATION_ERROR', '地理查询条件无效', errors);
  if (context.scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 80));
  const inventory = await currentDeviceFacts(context, query.tenantId);
  if ('error' in inventory) return failure(inventory.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : inventory.error.code === 'VALIDATION_ERROR' ? 'VALIDATION_ERROR' : 'SCENARIO_TIMEOUT', inventory.error.message);
  const selected = inventory.data.map(item => ({ id: item.id, tenantId: item.tenantId, productId: item.productId, continent: item.continent, countryCode: item.countryCode, nodeId: item.nodeId, location: item.location, lastActiveAt: item.lastActiveAt, status: item.status })).filter(device =>
    (query.tenantId === 'all' || device.tenantId === query.tenantId) &&
    (!query.productId || device.productId === query.productId) &&
    (!query.status || (query.status === 'alarm' ? ALARMS.has(device.id) || device.status === 'fault' : device.status === query.status)) &&
    (!query.continent || device.continent === query.continent) &&
    (!query.countryCode || device.countryCode === query.countryCode) &&
    (!query.nodeId || device.nodeId === query.nodeId) &&
    (level === 'global' || (level === 'continent' ? device.continent : level === 'country' ? device.countryCode : device.nodeId) === query.parentId));
  const messageResults = await Promise.all(selected.map(device => eventSource.listMessages(context, device.id)));
  const messageFailure = messageResults.find(result => 'error' in result);
  if (messageFailure && 'error' in messageFailure) return failure(messageFailure.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'SCENARIO_TIMEOUT', messageFailure.error.message);
  const recorded = messageResults.flatMap(result => 'data' in result ? result.data : []).filter(message => !message.id.startsWith('msg_seed_'));
  const items = level === 'global' ? group(selected, 'continent', device => device.continent, from, to, query.seed, recorded)
    : level === 'continent' ? group(selected, 'country', device => device.countryCode, from, to, query.seed, recorded)
      : level === 'country' ? group(selected, 'node', device => device.nodeId, from, to, query.seed, recorded)
        : group(selected, 'device', device => device.id, from, to, query.seed, recorded);
  const unlocated = group(selected.filter(device => !device.location), 'device', device => device.id, from, to, query.seed, recorded);
  return {
    data: {
      level, parentId: query.parentId ?? null, items, unlocated,
      summary: { devices: selected.length, onlineDevices: selected.filter(device => device.status === 'online').length,
        messages: selected.reduce((sum, device) => sum + messages(device, from, to, query.seed, recorded), 0),
        alarms: selected.filter(device => ALARMS.has(device.id)).length, unlocated: unlocated.length },
      updatedAt: new Date(to).toISOString(), mapAvailable: context.scenario !== 'partialFailure',
    },
    meta: { requestId: `req_${hash(JSON.stringify([context.actorId, query]))}`, seed: query.seed, generatedAt: new Date(to).toISOString() },
  };
}
