import { describe, expect, it } from 'vitest';
import { getSummary, type Context, type DashboardQuery } from './dashboard';
import { DeviceEventService } from './device-events';
import { getTopology } from './geography';
import { ota } from './ota';

const context: Context = { actorId: 'usr_202609_001', role: 'tenantAdmin', tenantId: 'ten_202609_001', seed: 42, scenario: 'normal' };
const query: DashboardQuery = { tenantId: 'ten_202609_001', from: '2026-09-10T00:00:00.000Z', to: '2026-09-17T00:00:00.000Z', seed: 42 };

describe('IOT-DOMAIN-001 / IOT-DASH-001 dashboard contract', () => {
  it('replays the same seed and aggregates one filter across every section', async () => {
    const first = await getSummary(context, query);
    expect(first).toEqual(await getSummary(context, query));
    if (!('data' in first)) throw new Error('Expected data');
    expect(first.data.metrics.devices).toBe(6);
    expect(first.data.metrics.onlineDevices).toBe(4);
    expect(first.data.metrics.activeAlarms).toBe(1);
    expect(first.data.metrics.activeAlarms).toBe(first.data.alarmDistribution.reduce((sum, row) => sum + row.count, 0));
    expect(first.data.metrics.otaSuccessRate).toBeNull();
    expect(first.data.metrics.messages).toBe(first.data.trend.reduce((sum, point) => sum + point.messages, 0));
    expect(first.data.updatedAt).toBe(query.to);
    expect(first.data.comparison.devices).toBe(first.data.metrics.devices);
    expect(first.data.comparison.messages).toBeGreaterThanOrEqual(0);
    expect(first.data.metrics.devices).toBe(first.data.continents.reduce((sum, row) => sum + row.devices, 0));
    expect(first.data.metrics.messages).toBe(first.data.countries.reduce((sum, row) => sum + row.messages, 0));
    expect(first.data.nodes.every(node => node.coordinates !== null && node.coordinates.length === 2)).toBe(true);
    expect(first.data.nodes.every(node => node.deviceIds.length === node.devices)).toBe(true);
    expect(new Set(first.data.nodes.flatMap(node => node.deviceIds)).size).toBe(first.data.metrics.devices);
    expect(first.data.events.every(event => event.tenantId === query.tenantId)).toBe(true);
    expect(first.data.events.map(event => event.occurredAt)).toEqual([...first.data.events.map(event => event.occurredAt)].sort().reverse());
  });

  it('filters tenant, region, product and time; empty range has no online rate', async () => {
    const result = await getSummary(context, { ...query, region: 'AS', productId: 'prod_as_001', from: '2026-09-16T00:00:00.000Z' });
    if (!('data' in result)) throw new Error('Expected data');
    expect(result.data.metrics.devices).toBe(1);
    expect(result.data.nodes.flatMap(node => node.deviceIds)).toEqual(['dev_as_001']);
    expect(result.data.continents.map(item => item.id)).toEqual(['AS']);
    expect(result.data.trend).toHaveLength(1);
    const empty = await getSummary(context, { ...query, region: 'unknown' });
    if (!('data' in empty)) throw new Error('Expected data');
    expect(empty.data.metrics).toMatchObject({ devices: 0, onlineRate: null, messages: 0, otaSuccessRate: null });
  });

  it('changes generated message data only when the explicit seed changes', async () => {
    const original = await getSummary(context, query);
    const changed = await getSummary({ ...context, seed: 77 }, { ...query, seed: 77 });
    if (!('data' in original) || !('data' in changed)) throw new Error('Expected data');
    expect(changed.data.metrics.devices).toBe(original.data.metrics.devices);
    expect(changed.data.trend).not.toEqual(original.data.trend);
  });

  it('uses the half-open time range for partial UTC days', async () => {
    const full = await getSummary(context, { ...query, from: '2026-09-16T00:00:00.000Z' });
    const half = await getSummary(context, { ...query, from: '2026-09-16T12:00:00.000Z' });
    if (!('data' in full) || !('data' in half)) throw new Error('Expected data');
    expect(half.data.metrics.messages).toBeLessThan(full.data.metrics.messages);
    expect(half.data.metrics.messages).toBe(half.data.nodes.reduce((sum, node) => sum + node.messages, 0));
  });

  it('rejects UTC calendar overflow while accepting a real leap day', async () => {
    expect(await getSummary(context, { ...query, from: '2026-09-31T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' })).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { range: expect.any(String) } } });
    expect(await getSummary(context, { ...query, from: '2024-02-29T00:00:00.000Z', to: '2024-03-01T00:00:00.000Z' })).toHaveProperty('data');
  });

  it('rejects cross-tenant access before revealing data or validation details', async () => {
    expect(await getSummary(context, { ...query, tenantId: 'ten_202609_002', from: 'bad' })).toEqual({ error: { code: 'FORBIDDEN', message: '无权查看该租户数据', retryable: false } });
    const all = await getSummary({ ...context, role: 'platformAdmin' }, { ...query, tenantId: 'all' });
    if (!('data' in all)) throw new Error('Expected data');
    expect(all.data.metrics.devices).toBe(12);
  });

  it('reflects an acknowledged device alarm without changing its historical event', async () => {
    const eventService = new DeviceEventService(null);
    const sources = { deviceEvents: eventService, ota };
    const before = await getSummary(context, query, sources);
    if (!('data' in before)) throw new Error('Expected data');
    expect(before.data.metrics.activeAlarms).toBe(1);
    const ack = await eventService.acknowledge(context, 'dev_na_001', 'alarm_fault_dev_na_001');
    if (!('data' in ack)) throw new Error('Expected alarm');
    const after = await getSummary(context, query, sources);
    if (!('data' in after)) throw new Error('Expected data');
    expect(after.data.metrics.activeAlarms).toBe(0);
    expect(after.data.events.find(event => event.id === 'alarm_fault_dev_na_001')).toMatchObject({ severity: 'critical' });
  });

  it('refreshes after a saved telemetry message creates a rule alarm', async () => {
    const eventService = new DeviceEventService(null);
    const sources = { deviceEvents: eventService, ota };
    const before = await getSummary(context, query, sources);
    if (!('data' in before)) throw new Error('Expected data');
    let notifications = 0;
    const changed = () => { notifications++; };
    window.addEventListener('iot-atlas-mock-changed', changed);
    try {
      const point = { deviceId: 'dev_as_001', metric: 'temperature', timestamp: '2026-09-16T15:00:00.000Z', value: 82, unit: '°C', quality: 'good' as const };
      expect(await eventService.recordTelemetry(context, point.deviceId, [point])).toHaveProperty('data');
      expect(notifications).toBe(2);
      const after = await getSummary(context, query, sources);
      if (!('data' in after)) throw new Error('Expected data');
      expect(after.data.metrics.activeAlarms).toBe(before.data.metrics.activeAlarms + 1);
      expect(after.data.events).toEqual(expect.arrayContaining([expect.objectContaining({ severity: 'minor', resourceId: point.deviceId })]));
    } finally { window.removeEventListener('iot-atlas-mock-changed', changed); }
  });

  it('adds recorded telemetry once to dashboard trend and geography using the same time window', async () => {
    const eventService = new DeviceEventService(null);
    const sources = { deviceEvents: eventService, ota };
    const before = await getSummary(context, query, sources);
    const beforeGeo = await getTopology(context, query, eventService);
    if (!('data' in before) || !('data' in beforeGeo)) throw new Error('Expected data');
    expect(before.data.metrics.messages).toBe(beforeGeo.data.summary.messages);
    const point = { deviceId: 'dev_as_001', metric: 'temperature', timestamp: '2026-09-16T12:00:00.000Z', value: 25, unit: '°C', quality: 'good' as const };
    const recorded = await eventService.recordTelemetry(context, point.deviceId, [point]);
    if (!('data' in recorded)) throw new Error('Expected recorded message');
    await eventService.recordTelemetry(context, point.deviceId, [point]);
    await eventService.recordTelemetry(context, point.deviceId, [{ ...point, timestamp: query.to }]);
    const after = await getSummary(context, query, sources);
    const afterGeo = await getTopology(context, query, eventService);
    if (!('data' in after) || !('data' in afterGeo)) throw new Error('Expected data');
    expect(after.data.metrics.messages).toBe(before.data.metrics.messages + 1);
    expect(after.data.metrics.messages).toBe(after.data.trend.reduce((sum, item) => sum + item.messages, 0));
    expect(after.data.metrics.messages).toBe(after.data.nodes.reduce((sum, item) => sum + item.messages, 0));
    expect(afterGeo.data.summary.messages).toBe(beforeGeo.data.summary.messages + 1);
    expect(afterGeo.data.summary.messages).toBe(after.data.metrics.messages);
    expect(after.data.events.filter(event => event.id === recorded.data?.id)).toMatchObject([{ severity: 'info' }]);
  });

  it('returns validation, partial failure and retryable offline states', async () => {
    expect(await getSummary(context, { ...query, from: query.to })).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { range: expect.any(String) } } });
    expect(await getSummary(context, { ...query, from: '2026-09-10' })).toMatchObject({ error: { code: 'VALIDATION_ERROR', fieldErrors: { range: expect.any(String) } } });
    const partial = await getSummary({ ...context, scenario: 'partialFailure' }, query);
    if (!('data' in partial)) throw new Error('Expected data');
    expect(partial.data.metrics.devices).toBe(6);
    expect(partial.data.continents).toEqual([]);
    expect(partial.data.unavailable).toEqual(['geography']);
    expect(await getSummary({ ...context, scenario: 'offline' }, query)).toMatchObject({ error: { code: 'SCENARIO_TIMEOUT', retryable: true } });
  });
});
