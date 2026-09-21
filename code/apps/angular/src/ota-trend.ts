// IOT-OTA-001: derive a historical chart from immutable per-device Mock events.
import type { OtaTask } from './ota';

export type OtaTrendPoint = { at: string; succeeded: number; failed: number; pending: number; cancelled: number };

export function otaTrend(task: { createdAt: string; targetSelector: { deviceIds: string[] }; executions: { deviceId: string; events: OtaTask['executions'][number]['events'] }[] }): OtaTrendPoint[] {
  const targetIds = new Set(task.targetSelector.deviceIds);
  const state = new Map<string, 'pending' | 'succeeded' | 'failed' | 'cancelled'>([...targetIds].map(id => [id, 'pending'] as const));
  const events = [...new Map(task.executions.flatMap(execution => execution.events.map(event => ({ event, deviceId: event.deviceId ?? (event.type === 'task.cancelled' ? execution.deviceId : '') })))
    .filter(item => targetIds.has(item.deviceId) && (item.event.type.startsWith('device.') || item.event.type === 'task.cancelled'))
    .map(item => [`${item.event.id}:${item.deviceId}`, item])).values()]
    .sort((a, b) => a.event.at.localeCompare(b.event.at) || a.event.id.localeCompare(b.event.id) || a.deviceId.localeCompare(b.deviceId));
  const snapshot = (at: string): OtaTrendPoint => ({ at, succeeded: [...state.values()].filter(value => value === 'succeeded').length, failed: [...state.values()].filter(value => value === 'failed').length, pending: [...state.values()].filter(value => value === 'pending').length, cancelled: [...state.values()].filter(value => value === 'cancelled').length });
  const points = [snapshot(task.createdAt)];
  for (const { event, deviceId } of events) {
    const next = event.type === 'device.succeeded' ? 'succeeded' : event.type === 'device.failed' ? 'failed' : event.type === 'task.cancelled' ? 'cancelled' : 'pending';
    state.set(deviceId, next);
    points.push(snapshot(event.at));
  }
  return points;
}

export function otaTrendPath(points: OtaTrendPoint[], key: 'succeeded' | 'failed' | 'cancelled'): string {
  if (!points.length) return '';
  const start = Date.parse(points[0].at), end = Date.parse(points.at(-1)!.at);
  const span = Math.max(1, end - start);
  const total = Math.max(1, points[0].pending + points[0].succeeded + points[0].failed + points[0].cancelled);
  return points.map((point, index) => `${index ? 'L' : 'M'}${((Date.parse(point.at) - start) / span * 100).toFixed(2)},${(40 - point[key] / total * 36).toFixed(2)}`).join(' ');
}
