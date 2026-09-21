import { describe, expect, it } from 'vitest';
import { LAB_DEVICES, LAB_SEED, labRows } from './lab-data';

describe('IOT-LEARNING-001 fixed comparison data', () => {
  it('keeps the same three rows and filters without changing the seed', () => {
    expect(LAB_SEED).toBe('iot-atlas-demo-001');
    expect(LAB_DEVICES.map(row => row.id)).toEqual(['lab-001', 'lab-002', 'lab-003']);
    expect(labRows('传感器', 'online').map(row => row.id)).toEqual(['lab-001']);
    expect(labRows('', 'all')).toHaveLength(3);
  });
});
