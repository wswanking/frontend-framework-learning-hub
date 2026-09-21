import { describe, expect, it } from 'vitest';
import { otaTrend, otaTrendPath } from './ota-trend';

const event = (id: number, type: string, deviceId: string) => ({ id: `oevt_${id}`, taskId: 'ota_1', deviceId, at: `2026-09-20T00:00:0${id}.000Z`, type, detail: type });

describe('IOT-OTA-001 device progress history', () => {
  it('keeps failure and retry in the timeline while reflecting the latest device status', () => {
    const task = {
      createdAt: '2026-09-20T00:00:00.000Z', targetSelector: { deviceIds: ['a', 'b'], tags: [] },
      executions: [
        { deviceId: 'a', events: [event(1, 'device.queued', 'a'), event(2, 'device.failed', 'a')] },
        { deviceId: 'a', events: [event(3, 'device.retry', 'a'), event(4, 'device.succeeded', 'a')] },
        { deviceId: 'b', events: [event(5, 'device.queued', 'b'), event(6, 'device.succeeded', 'b')] },
      ],
    };
    const points = otaTrend(task);
    expect(points.map(({ succeeded, failed, pending }) => [succeeded, failed, pending])).toEqual([
      [0, 0, 2], [0, 0, 2], [0, 1, 1], [0, 0, 2], [1, 0, 1], [1, 0, 1], [2, 0, 0],
    ]);
    expect(otaTrendPath(points, 'succeeded')).toMatch(/^M0\.00,40\.00/);
    expect(otaTrendPath(points, 'succeeded')).toMatch(/L100\.00,4\.00$/);
  });
  it('counts cancelled devices separately from pending devices', () => {
    const cancelled = { ...event(2, 'task.cancelled', 'a'), deviceId: undefined };
    const task = { createdAt: '2026-09-20T00:00:00.000Z', targetSelector: { deviceIds: ['a'], tags: [] }, executions: [{ deviceId: 'a', events: [event(1, 'device.queued', 'a'), cancelled] }] };
    expect(otaTrend(task).at(-1)).toMatchObject({ succeeded: 0, failed: 0, pending: 0, cancelled: 1 });
  });
});
