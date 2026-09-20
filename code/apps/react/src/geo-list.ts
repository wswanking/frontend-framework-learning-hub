import type { GeoItem } from './geography';

export type GeoSort = 'devices' | 'name';
export type GeoDirection = 'asc' | 'desc';
export function geoListPage(items: GeoItem[], sort: GeoSort, direction: GeoDirection, page: number, pageSize = 10) {
  const ordered = [...items].sort((a, b) => {
    const comparison = sort === 'devices' ? a.devices - b.devices : a.name.localeCompare(b.name, 'zh-CN');
    return (direction === 'asc' ? comparison : -comparison) || a.id.localeCompare(b.id);
  });
  const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), pages);
  return { items: ordered.slice((currentPage - 1) * pageSize, currentPage * pageSize), page: currentPage, pages, total: ordered.length };
}
