import { describe, expect, it } from 'vitest';
import { summarizeOperations } from './dashboard-operations';
import type { DeviceFact } from './device-facts';
import type { DeviceAlarm } from './device-events';
import type { OtaTask } from './ota';

const from = Date.parse('2026-09-16T00:00:00.000Z'), to = Date.parse('2026-09-17T00:00:00.000Z');
const devices = [{ id: 'dev_a' }, { id: 'dev_b' }] as DeviceFact[];
const alarm = (id: string, deviceId: string, severity: DeviceAlarm['severity'], status: DeviceAlarm['status'], occurredAt = '2026-09-16T12:00:00.000Z'): DeviceAlarm =>
  ({ id, deviceId, tenantId: 'ten_1', severity, status, occurredAt, source: 'device', description: id });
const execution = (deviceId: string, attempt: number, status: 'succeeded' | 'failed', endedAt = '2026-09-16T13:00:00.000Z') =>
  ({ deviceId, attempt, status, endedAt, startedAt: endedAt });
const task = (id: string, executions: ReturnType<typeof execution>[], alarmCreated = false, status: OtaTask['status'] = 'succeeded'): OtaTask =>
  ({ id, tenantId: 'ten_1', targetSelector: { deviceIds: executions.map(item => item.deviceId), tags: [] }, alarmCreated, status, updatedAt: '2026-09-16T14:00:00.000Z', executions }) as unknown as OtaTask;

describe('IOT-DASH-001 operational aggregation', () => {
  it('counts open alarms and latest completed OTA attempt within the selected time and devices', () => {
    const result = summarizeOperations(devices, [
      alarm('critical', 'dev_a', 'critical', 'open'),
      alarm('acknowledged', 'dev_b', 'warning', 'acknowledged'),
      alarm('outside-device', 'dev_c', 'critical', 'open'),
      alarm('outside-time', 'dev_b', 'warning', 'open', '2026-09-17T00:00:00.000Z'),
      { ...alarm('alarm_ota_ota_b_dev_b', 'dev_b', 'major', 'open'), source: 'ota', taskId: 'ota_b' },
    ], [
      task('ota_a', [execution('dev_a', 1, 'failed'), execution('dev_a', 2, 'succeeded')]),
      task('ota_b', [execution('dev_b', 1, 'failed')], true, 'paused'),
      task('ota_outside', [execution('dev_c', 1, 'succeeded')]),
    ], from, to);
    expect(result.alarmDistribution).toEqual([
      { severity: 'critical', count: 1 }, { severity: 'major', count: 1 }, { severity: 'minor', count: 0 },
    ]);
    expect(result.activeAlarms).toBe(2);
    expect(result.otaSuccessRate).toBe(1 / 2);
    expect(result.alarmEvents.map(item => item.id).sort()).toEqual(['acknowledged', 'alarm_ota_ota_b', 'critical']);
    expect(result.alarmEvents).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'critical', severity: 'critical' }), expect.objectContaining({ id: 'acknowledged', severity: 'minor' }), expect.objectContaining({ id: 'alarm_ota_ota_b', severity: 'major' })]));
    const acknowledged = summarizeOperations(devices, [{ ...alarm('alarm_ota_ota_b_dev_b', 'dev_b', 'major', 'acknowledged'), source: 'ota', taskId: 'ota_b' }],
      [task('ota_b', [execution('dev_b', 1, 'failed')], true, 'paused')], from, to);
    expect(acknowledged.alarmDistribution[1].count).toBe(0);
  });
  it('returns an empty rate with no completed executions and uses a half-open window', () => {
    expect(summarizeOperations(devices, [alarm('before', 'dev_a', 'critical', 'open', '2026-09-15T23:59:59.999Z')],
      [task('later', [execution('dev_a', 1, 'succeeded', '2026-09-17T00:00:00.000Z')])], from, to))
      .toMatchObject({ activeAlarms: 0, otaSuccessRate: null, alarmEvents: [] });
  });
});
