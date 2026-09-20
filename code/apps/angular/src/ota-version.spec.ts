import { describe, expect, it } from 'vitest';
import { otaVersionDistribution } from './ota-version';

describe('IOT-OTA-001 current version distribution', () => {
  it('uses the latest attempt per device and keeps unstarted targets visible', () => {
    const task = {
      targetSelector: { deviceIds: ['a', 'b', 'c', 'd'], tags: [] },
      executions: [
        { deviceId: 'a', fromVersion: '1.0', toVersion: '2.0', status: 'failed' },
        { deviceId: 'a', fromVersion: '1.0', toVersion: '2.0', status: 'succeeded' },
        { deviceId: 'b', fromVersion: '1.1', toVersion: '2.0', status: 'failed' },
        { deviceId: 'c', fromVersion: '1.0', toVersion: '2.0', status: 'downloading' },
      ],
    } as const;
    expect(otaVersionDistribution(task)).toEqual([
      { version: '1.0', count: 1 }, { version: '1.1', count: 1 },
      { version: '2.0', count: 1 }, { version: '未采集', count: 1 },
    ]);
  });
});
