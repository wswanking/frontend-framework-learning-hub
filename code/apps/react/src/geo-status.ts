import type { DeviceStatus, GeoItem } from './geography';

export const geoLegendOptions: { status: '' | DeviceStatus; label: string; color: string }[] = [
  { status: '', label: '全部', color: '#40d8f1' },
  { status: 'online', label: '在线', color: '#42d79e' },
  { status: 'offline', label: '离线', color: '#a4bfcb' },
  { status: 'fault', label: '故障', color: '#ff8278' },
  { status: 'unactivated', label: '未激活', color: '#a998ff' },
  { status: 'maintenance', label: '维护', color: '#ffd275' },
  { status: 'alarm', label: '告警', color: '#ffac64' },
];

export function geoPointColor(members: GeoItem[], activeStatus: string): string {
  if (activeStatus) return geoLegendOptions.find(option => option.status === activeStatus)?.color ?? '#40d8f1';
  const statuses = new Set(members.map(item => item.status).filter(Boolean));
  return statuses.size === 1 ? geoLegendOptions.find(option => option.status === [...statuses][0])?.color ?? '#40d8f1' : '#40d8f1';
}
