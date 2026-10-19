import type { DeviceListQuery, DeviceStatus } from './devices';

/** URL owns applied list state; filter inputs remain a local draft until Query. */
export function readDeviceQuery(params: URLSearchParams): DeviceListQuery {
  const page = Number(params.get('page') || 1), size = Number(params.get('pageSize') || 10);
  const status = params.get('status'), sort = params.get('sortBy');
  return {
    tenantId: params.get('tenant') || localStorage.getItem('iot-atlas-current-tenant-v1') || 'all', seed: 42,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: [2, 10, 20].includes(size) ? size : 10,
    sortBy: sort === 'name' || sort === 'status' ? sort : 'lastActiveAt',
    sortDirection: params.get('sortDirection') === 'asc' ? 'asc' : 'desc',
    productId: params.get('productId') || undefined,
    status: status && ['unactivated', 'online', 'offline', 'fault', 'maintenance'].includes(status) ? status as DeviceStatus : undefined,
    region: params.get('region') || undefined, tag: params.get('tag') || undefined,
    keyword: params.get('keyword') || undefined, lastActiveFrom: params.get('lastActiveFrom') || undefined,
  };
}
export function writeDeviceQuery(query: DeviceListQuery, current: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(current);
  for (const key of ['productId', 'status', 'region', 'tag', 'keyword', 'lastActiveFrom', 'page', 'pageSize', 'sortBy', 'sortDirection'] as const) {
    const value = query[key];
    if (value !== undefined && value !== '') params.set(key, String(value)); else params.delete(key);
  }
  params.set('tenant', query.tenantId);
  return params;
}
