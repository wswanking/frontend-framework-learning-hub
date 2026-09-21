import type { DeviceFact } from './device-facts';
import type { DeviceAlarm } from './device-events';
import type { OtaTask } from './ota';

export type DashboardAlarmEvent = { id: string; occurredAt: string; tenantId: string; resourceId: string; severity: 'critical' | 'major' | 'minor' };
export type DashboardOperations = {
  activeAlarms: number;
  alarmDistribution: { severity: 'critical' | 'major' | 'minor'; count: number }[];
  alarmEvents: DashboardAlarmEvent[];
  otaSuccessRate: number | null;
};
const inRange = (value: string, from: number, to: number) => { const at = Date.parse(value); return Number.isFinite(at) && at >= from && at < to; };

export function summarizeOperations(devices: DeviceFact[], alarms: DeviceAlarm[], tasks: OtaTask[], from: number, to: number): DashboardOperations {
  const ids = new Set(devices.map(device => device.id));
  const visibleAlarms = alarms.filter(alarm => ids.has(alarm.deviceId) && inRange(alarm.occurredAt, from, to));
  const deviceAlarms = visibleAlarms.filter(alarm => alarm.source !== 'ota');
  const otaAlarms = [...new Map(visibleAlarms.filter(alarm => alarm.source === 'ota' && alarm.taskId)
    .map(alarm => [alarm.taskId!, alarm])).values()];
  const activeOtaTaskIds = new Set(visibleAlarms.filter(alarm => alarm.source === 'ota' && alarm.status === 'open').map(alarm => alarm.taskId));
  const alarmDistribution = [
    { severity: 'critical' as const, count: deviceAlarms.filter(alarm => alarm.status === 'open' && alarm.severity === 'critical').length },
    { severity: 'major' as const, count: activeOtaTaskIds.size },
    { severity: 'minor' as const, count: deviceAlarms.filter(alarm => alarm.status === 'open' && alarm.severity === 'warning').length },
  ];
  const alarmEvents = [
    ...deviceAlarms.map(alarm => ({ id: alarm.id, occurredAt: alarm.occurredAt, tenantId: alarm.tenantId, resourceId: alarm.deviceId, severity: alarm.severity === 'warning' ? 'minor' as const : alarm.severity })),
    ...otaAlarms.map(alarm => ({ id: `alarm_ota_${alarm.taskId}`, occurredAt: alarm.occurredAt, tenantId: alarm.tenantId, resourceId: alarm.taskId!, severity: 'major' as const })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id));
  const latest = new Map<string, OtaTask['executions'][number]>();
  for (const task of tasks) for (const execution of task.executions) {
    if (!ids.has(execution.deviceId) || !execution.endedAt || !inRange(execution.endedAt, from, to) || !['succeeded', 'failed'].includes(execution.status)) continue;
    const key = `${task.id}:${execution.deviceId}`;
    const prior = latest.get(key);
    if (!prior || execution.attempt > prior.attempt || execution.attempt === prior.attempt && execution.endedAt > (prior.endedAt ?? '')) latest.set(key, execution);
  }
  const completed = [...latest.values()];
  return {
    activeAlarms: alarmDistribution.reduce((sum, item) => sum + item.count, 0), alarmDistribution, alarmEvents,
    otaSuccessRate: completed.length ? completed.filter(execution => execution.status === 'succeeded').length / completed.length : null,
  };
}
