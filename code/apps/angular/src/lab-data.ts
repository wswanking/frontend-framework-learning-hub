// IOT-LEARNING-001. This fixed dataset is maintained independently by each app.
export type LabDevice = { id: string; name: string; region: string; status: 'online' | 'offline'; lastSeen: string };
export const LAB_SEED = 'iot-atlas-demo-001';
export const LAB_DEVICES: readonly LabDevice[] = [
  { id: 'lab-001', name: '温湿度传感器', region: '华东 · 上海', status: 'online', lastSeen: '2026-09-16 10:23' },
  { id: 'lab-002', name: '门磁传感器', region: '华南 · 深圳', status: 'offline', lastSeen: '2026-09-16 09:18' },
  { id: 'lab-003', name: '摄像头', region: '华北 · 北京', status: 'online', lastSeen: '2026-09-16 11:02' },
];
export function labRows(keyword: string, status: 'all' | LabDevice['status']): LabDevice[] {
  const term = keyword.trim().toLocaleLowerCase();
  return LAB_DEVICES.filter(row => (status === 'all' || row.status === status) && (!term || `${row.id} ${row.name} ${row.region}`.toLocaleLowerCase().includes(term)));
}
