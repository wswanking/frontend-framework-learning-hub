import type { GeoItem } from './geography';

export type GeoMapPoint = { id: string; name: string; coordinates: [number, number]; devices: number; count: number; memberIds: string[]; cluster: boolean };

// City-level demonstration coordinates. Only device points cluster; higher levels are already aggregates.
export function geoMapPoints(items: GeoItem[], zoom: number): GeoMapPoint[] {
  const valid = items.filter((item): item is GeoItem & { coordinates: [number, number] } => item.coordinates !== null);
  if (!valid.length) return [];
  const cell = 16 / Math.max(1, Math.min(8, zoom));
  const groups = new Map<string, typeof valid>();
  for (const item of valid) {
    const key = item.kind === 'device'
      ? `${Math.floor((item.coordinates[0] + 180) / cell)}:${Math.floor((item.coordinates[1] + 90) / cell)}`
      : item.id;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()].map(group => {
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const cluster = sorted.length > 1;
    return {
      id: cluster ? `cluster:${sorted.map(item => item.id).join('|')}` : sorted[0].id,
      name: cluster ? `${sorted.length} 台设备` : sorted[0].name,
      coordinates: cluster
        ? [sorted.reduce((sum, item) => sum + item.coordinates[0], 0) / sorted.length, sorted.reduce((sum, item) => sum + item.coordinates[1], 0) / sorted.length] as [number, number]
        : sorted[0].coordinates,
      devices: sorted.reduce((sum, item) => sum + item.devices, 0),
      count: sorted.length,
      memberIds: sorted.map(item => item.id),
      cluster,
    };
  }).sort((a, b) => b.devices - a.devices || a.id.localeCompare(b.id));
}
