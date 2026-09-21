import { describe, expect, it } from 'vitest';
import { getTopology, type GeoQuery } from './geography';
import type { Context } from './dashboard';

const context: Context = { actorId: 'usr_202609_001', role: 'platformAdmin', tenantId: 'all', seed: 42, scenario: 'normal' };
const query: GeoQuery = { tenantId: 'all', from: '2026-09-15T00:00:00.000Z', to: '2026-09-16T00:00:00.000Z', seed: 42 };
const data = async (value: GeoQuery = query, actor: Context = context) => {
  const result = await getTopology(actor, value);
  if ('error' in result) throw new Error(result.error.message);
  return result.data;
};

describe('IOT-GEO-001 topology contract', () => {
  it('is deterministic, counts all devices and keeps unlocated devices accessible', async () => {
    const first = await data();
    expect(first).toEqual(await data());
    expect(first.summary.devices).toBe(12);
    expect(first.items).toHaveLength(6);
    expect(first.summary.unlocated).toBe(1);
    expect(first.summary.alarms).toBe(4);
    expect(first.unlocated[0]).toMatchObject({ id: 'dev_oc_002', countryCode: 'NZ', coordinates: null, status: 'online' });
    expect(first.items.reduce((sum, item) => sum + item.messages, 0)).toBe(first.summary.messages);
  });

  it('applies the same filters through continent, country, node and device levels', async () => {
    const filtered = { ...query, continent: 'AS', tenantId: 'ten_202609_001' };
    const global = await data(filtered);
    expect(global.summary.devices).toBe(1);
    expect(global.items.map(item => item.id)).toEqual(['AS']);
    const countries = await data({ ...filtered, level: 'continent', parentId: 'AS' });
    expect(countries.items.map(item => item.id)).toEqual(['CN']);
    const nodes = await data({ ...filtered, level: 'country', parentId: 'CN' });
    expect(nodes.items.map(item => item.id)).toEqual(['node_cn_001']);
    const devices = await data({ ...filtered, level: 'node', parentId: 'node_cn_001' });
    expect(devices.items[0]).toMatchObject({ id: 'dev_as_001', status: 'online', coordinates: [121.47, 31.23] });
    expect(devices.items[0].messages).toBe(nodes.items[0].messages);
    expect((await data({ ...query, countryCode: 'ZA', nodeId: 'node_za_001', status: 'offline' })).summary.devices).toBe(1);
    expect((await data({ ...query, countryCode: 'CN', nodeId: 'node_za_001' })).summary.devices).toBe(0);
  });

  it('rejects tenant escape and invalid hierarchy before showing data', async () => {
    expect(await getTopology({ ...context, role: 'viewer', tenantId: 'ten_202609_001' }, query)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await getTopology(context, { ...query, level: 'country' })).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { parentId: expect.any(String) } } });
    expect(await getTopology(context, { ...query, seed: 1 })).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects UTC calendar overflow while accepting a real leap day', async () => {
    expect(await getTopology(context, { ...query, from: '2026-09-31T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' })).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { range: expect.any(String) } } });
    expect(await getTopology(context, { ...query, from: '2024-02-29T00:00:00.000Z', to: '2024-03-01T00:00:00.000Z' })).toHaveProperty('data');
  });

  it('provides a list fallback when the map data fails', async () => {
    const result = await data(query, { ...context, scenario: 'partialFailure' });
    expect(result.mapAvailable).toBe(false);
    expect(result.items).toHaveLength(6);
    expect(result.unlocated).toHaveLength(1);
    expect(await getTopology({ ...context, scenario: 'offline' }, query)).toMatchObject({ error: { code: 'SCENARIO_TIMEOUT', retryable: true } });
  });
});
