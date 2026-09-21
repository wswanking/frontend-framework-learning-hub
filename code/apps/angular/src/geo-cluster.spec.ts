import { describe, expect, it } from 'vitest';
import { geoMapPoints } from './geo-cluster';
import { geoPointColor } from './geo-status';
import type { GeoItem } from './geography';
const device = (id: string, coordinates: [number, number] | null): GeoItem => ({ id, name: id, kind: 'device', continent: 'AS', countryCode: 'CN', nodeId: 'node_cn_001', coordinates, devices: 1, onlineDevices: 1, messages: 1, alarms: 0, onlineRate: 1, lastActiveAt: null, status: 'online' });
describe('IOT-GEO-001 deterministic map clustering', () => {
  it('groups dense device points, splits by zoom, and leaves unlocated items in the source list', () => {
    const items = [device('dev_b', [121.48, 31.24]), device('dev_a', [121.47, 31.23]), device('dev_c', [123, 31.2]), device('dev_missing', null)];
    const wide = geoMapPoints(items, 1);
    expect(wide).toHaveLength(1);
    expect(wide[0]).toMatchObject({ count: 3, devices: 3, memberIds: ['dev_a', 'dev_b', 'dev_c'], cluster: true });
    const close = geoMapPoints(items, 8);
    expect(close).toHaveLength(2);
    expect(close[0].memberIds).toEqual(['dev_a', 'dev_b']);
    expect(close[1].memberIds).toEqual(['dev_c']);
    expect(items).toHaveLength(4);
  });
  it('uses device status colors and a neutral color for mixed clusters', () => {
    const online = device('online', [121, 31]);
    const offline = { ...device('offline', [121, 31]), status: 'offline' as const };
    expect(geoPointColor([online], '')).toBe('#42d79e');
    expect(geoPointColor([online, offline], '')).toBe('#40d8f1');
    expect(geoPointColor([online, offline], 'fault')).toBe('#ff8278');
  });
  it('does not merge already aggregated node points and has stable ordering', () => {
    const a = { ...device('node_a', [121, 31]), kind: 'node' as const, devices: 3 };
    const b = { ...device('node_b', [121, 31]), kind: 'node' as const, devices: 3 };
    expect(geoMapPoints([b, a], 1).map(point => point.id)).toEqual(['node_a', 'node_b']);
  });
});
