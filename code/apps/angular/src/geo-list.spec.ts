import { describe, expect, it } from 'vitest';
import { geoListPage } from './geo-list';
import type { GeoItem } from './geography';

const item = (id: string, devices: number): GeoItem => ({ id, name: `节点${id}`, kind: 'node', continent: 'AS', countryCode: 'CN', nodeId: id, coordinates: null, devices, onlineDevices: 0, messages: 0, alarms: 0, onlineRate: null, lastActiveAt: null });
describe('IOT-GEO-001 sortable list fallback', () => {
  it('paginates without changing the source or dropping ties', () => {
    const input = Array.from({ length: 23 }, (_, index) => item(`node_${String(index).padStart(2, '0')}`, index % 3));
    const first = geoListPage(input, 'devices', 'desc', 1), last = geoListPage(input, 'devices', 'desc', 3);
    expect(first).toMatchObject({ page: 1, pages: 3, total: 23 });
    expect(first.items).toHaveLength(10);
    expect(first.items.slice(0, 7).map(row => row.id)).toEqual(['node_02', 'node_05', 'node_08', 'node_11', 'node_14', 'node_17', 'node_20']);
    expect(last.items).toHaveLength(3);
    expect(new Set([...geoListPage(input, 'devices', 'desc', 1).items, ...geoListPage(input, 'devices', 'desc', 2).items, ...last.items].map(row => row.id)).size).toBe(23);
    expect(input[0].id).toBe('node_00');
    expect(geoListPage(input, 'devices', 'desc', 99).page).toBe(3);
    expect(geoListPage([], 'name', 'asc', 4)).toMatchObject({ page: 1, pages: 1, total: 0, items: [] });
  });
});
