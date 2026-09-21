import { describe, expect, it } from 'vitest';
import { utcMinuteToIso } from './device-filter-time';

describe('IOT-DEVICE-001 UTC list filter', () => {
  it('keeps the entered UTC minute independent of browser timezone', () => {
    expect(utcMinuteToIso('2026-09-16T11:57')).toBe('2026-09-16T11:57:00.000Z');
    expect(utcMinuteToIso('2026-02-30T11:57')).toBeUndefined();
    expect(utcMinuteToIso('')).toBeUndefined();
  });
});
