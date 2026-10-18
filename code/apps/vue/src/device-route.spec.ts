import { describe, expect, it } from 'vitest';
import { readDeviceQuery, writeDeviceQuery } from './device-route';

describe('IOT-DEVICE-001 M2 recoverable URL state', () => {
  it('round trips every applied list field without losing the selected device', () => {
    const query = { tenantId: 'ten_202609_001', seed: 42, productId: 'prod_as_001', status: 'online' as const, region: 'AS', tag: '演示', keyword: '设备 & name', lastActiveFrom: '2026-09-16T00:00:00.000Z', page: 2, pageSize: 2, sortBy: 'name' as const, sortDirection: 'asc' as const };
    const url = writeDeviceQuery(query, new URLSearchParams('device=dev_as_001'));
    expect(readDeviceQuery(url)).toEqual(query);
    expect(url.get('device')).toBe('dev_as_001');
    expect(url.has('seed')).toBe(false);
  });
  it('normalizes invalid pagination and enums without accepting a different seed', () => {
    const query = readDeviceQuery(new URLSearchParams('tenant=all&page=-2&pageSize=999&sortBy=version&sortDirection=bad&status=bad&seed=9'));
    expect(query).toMatchObject({ tenantId: 'all', page: 1, pageSize: 10, sortBy: 'lastActiveAt', sortDirection: 'desc', seed: 42 });
    expect(query.status).toBeUndefined();
  });
  it('removes cleared filters and retains explicit tenant and page', () => {
    const query = readDeviceQuery(new URLSearchParams('tenant=all&page=2&pageSize=2'));
    const url = writeDeviceQuery(query, new URLSearchParams('keyword=old&tag=old&region=EU'));
    expect(url.has('keyword')).toBe(false);
    expect(url.has('tag')).toBe(false);
    expect(url.has('region')).toBe(false);
    expect(url.get('page')).toBe('2');
    expect(url.get('tenant')).toBe('all');
  });
});
