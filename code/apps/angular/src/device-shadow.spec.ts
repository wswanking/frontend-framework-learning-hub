import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceService } from './devices';
import { ProductService } from './products';
import type { Context } from './dashboard';

const operator: Context = { actorId: 'usr_202609_001', role: 'operator', tenantId: 'ten_202609_001', seed: 42, scenario: 'normal' };
const viewer: Context = { ...operator, role: 'viewer' };
function storage(): Storage { const values = new Map<string, string>(); return { get length() { return values.size; }, clear: () => values.clear(), getItem: key => values.get(key) ?? null, key: index => [...values.keys()][index] ?? null, removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); } }; }
afterEach(() => vi.useRealTimers());

describe('IOT-DEVICE-001 device shadow', () => {
  it('shows a pending desired value, then reconciles the reported value and persists it', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-16T12:00:00.000Z'));
    const store = storage(), current = new DeviceService(store, new ProductService());
    expect(await current.getShadow(viewer, 'dev_as_001')).toMatchObject({ data: { entries: expect.arrayContaining([{ identifier: 'sampling_interval', reported: 60, desired: null, desiredCommandId: null }]) } });
    expect(await current.executeCommand(operator, 'dev_as_001', 'tm_sampling_interval', 120)).toMatchObject({ data: { status: 'pending' } });
    expect(await current.getShadow(viewer, 'dev_as_001')).toMatchObject({ data: { entries: expect.arrayContaining([{ identifier: 'sampling_interval', reported: 60, desired: 120, desiredCommandId: expect.stringContaining('cmd_') }]) } });
    vi.advanceTimersByTime(601);
    expect(await current.getShadow(viewer, 'dev_as_001')).toMatchObject({ data: { entries: expect.arrayContaining([{ identifier: 'sampling_interval', reported: 120, desired: null, desiredCommandId: null }]) } });
    expect(await new DeviceService(store, new ProductService()).getShadow(viewer, 'dev_as_001')).toMatchObject({ data: { entries: expect.arrayContaining([{ identifier: 'sampling_interval', reported: 120, desired: null, desiredCommandId: null }]) } });
  });
  it('rejects cross tenant and missing device access', async () => {
    const current = new DeviceService(null, new ProductService());
    expect(await current.getShadow(viewer, 'dev_as_002')).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await current.getShadow(viewer, 'missing')).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
  it('persists valid live reports without filling gaps or replaying older values', async () => {
    const store = storage(), current = new DeviceService(store, new ProductService());
    const point = { deviceId: 'dev_as_001', metric: 'temperature', timestamp: '2026-09-16T13:00:00.000Z', value: 31.4, unit: '°C', quality: 'good' as const };
    const gap = { ...point, metric: 'humidity', value: null, quality: 'missing' as const };
    expect(await current.applyTelemetry(viewer, point.deviceId, [point, gap])).toMatchObject({ data: { lastActiveAt: point.timestamp, entries: expect.arrayContaining([
      { identifier: 'temperature', reported: 31.4, desired: null, desiredCommandId: null },
      { identifier: 'humidity', reported: 58.2, desired: null, desiredCommandId: null },
    ]) } });
    expect(await current.applyTelemetry(viewer, point.deviceId, [{ ...point, timestamp: '2026-09-16T12:30:00.000Z', value: 11 }])).toMatchObject({ data: { entries: expect.arrayContaining([{ identifier: 'temperature', reported: 31.4, desired: null, desiredCommandId: null }]) } });
    expect(await current.applyTelemetry(viewer, point.deviceId, [{ ...gap, timestamp: '2026-09-16T14:00:00.000Z' }])).toMatchObject({ data: { lastActiveAt: point.timestamp } });
    expect(await current.applyTelemetry(viewer, point.deviceId, [{ ...point, metric: 'unknown' }])).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await current.applyTelemetry(viewer, 'dev_as_002', [{ ...point, deviceId: 'dev_as_002' }])).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await new DeviceService(store, new ProductService()).getShadow(viewer, point.deviceId)).toMatchObject({ data: { entries: expect.arrayContaining([{ identifier: 'temperature', reported: 31.4, desired: null, desiredCommandId: null }]) } });
  });
});
