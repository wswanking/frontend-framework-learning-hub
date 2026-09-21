import { describe, expect, it } from 'vitest';
import { telemetryWindow } from './telemetry-range';

describe('IOT-DEVICE-001 UTC telemetry range', () => {
  it('retains preset windows and accepts a custom inclusive 30 day interval', () => {
    expect(telemetryWindow(1, '', '')).toEqual({ ok: true, from: '2026-09-15T12:00:00.000Z', to: '2026-09-16T12:00:00.000Z' });
    expect(telemetryWindow(0, '2026-08-17T12:00', '2026-09-16T12:00')).toEqual({ ok: true, from: '2026-08-17T12:00:00.000Z', to: '2026-09-16T12:00:00.000Z' });
  });
  it('rejects invalid, reversed and overlong intervals before querying', () => {
    expect(telemetryWindow(0, '2026-02-30T12:00', '2026-03-01T12:00').ok).toBe(false);
    expect(telemetryWindow(0, '2026-09-16T12:00', '2026-09-15T12:00').ok).toBe(false);
    expect(telemetryWindow(0, '2026-08-17T11:59', '2026-09-16T12:00').ok).toBe(false);
  });
});
