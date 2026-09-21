import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { GeoItem } from './geography';
import { geoMapPoints } from './geo-cluster';
import { geoPointColor } from './geo-status';
import { world } from './world';

echarts.registerMap('iot-geo-world', world as unknown as Parameters<typeof echarts.registerMap>[1]);
export default function GeoChart({ items, status, onSelect, onClear }: { items: GeoItem[]; status: string; onSelect: (item: GeoItem) => void; onClear: () => void }) {
  const element = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const updateRef = useRef<() => void>(() => {});
  const zoom = (factor: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    const option = chart.getOption() as { geo?: { zoom?: number }[] };
    const current = option.geo?.[0]?.zoom ?? 1;
    chart.setOption({ geo: { zoom: Math.max(1, Math.min(8, current * factor)) } });
    updateRef.current();
  };
  const reset = () => { chartRef.current?.setOption({ geo: { center: [0, 0], zoom: 1 } }); updateRef.current(); };
  useEffect(() => {
    if (!element.current) return;
    const chart = echarts.init(element.current, undefined, { renderer: 'svg' });
    chartRef.current = chart;
    chart.setOption({ animation: false, tooltip: { trigger: 'item', formatter: (param: { name: string }) => param.name },
      geo: { map: 'iot-geo-world', roam: true, scaleLimit: { min: 1, max: 8 }, itemStyle: { areaColor: '#123a58', borderColor: '#35607a' }, emphasis: { itemStyle: { areaColor: '#27678d' } } },
      series: [{ type: 'scatter', coordinateSystem: 'geo', symbolSize: (value: number[]) => Math.min(30, 12 + value[2] * 3),
        itemStyle: { color: '#40d8f1', shadowBlur: 12, shadowColor: '#40d8f1' }, label: { show: true, formatter: (param: { data: { count: number } }) => `${param.data.count}`, color: '#fff', fontSize: 10 }, data: [] }],
    });
    const currentZoom = () => (chart.getOption() as { geo?: { zoom?: number }[] }).geo?.[0]?.zoom ?? 1;
    const updatePoints = () => chart.setOption({ series: [{ data: geoMapPoints(items, currentZoom()).map(point => ({ name: point.name, value: [...point.coordinates, point.devices], id: point.id, count: point.devices, cluster: point.cluster, memberIds: point.memberIds, coordinates: point.coordinates, itemStyle: { color: geoPointColor(items.filter(item => point.memberIds.includes(item.id)), status) } })) }] });
    updateRef.current = updatePoints;
    updatePoints();
    chart.on('georoam', updatePoints);
    chart.on('click', event => { const point = event.data as { id?: string; cluster?: boolean; coordinates?: [number, number] } | undefined; if (point?.cluster && point.coordinates) { chart.setOption({ geo: { center: point.coordinates, zoom: Math.min(8, currentZoom() * 1.5) } }); updatePoints(); return; } const item = items.find(candidate => candidate.id === point?.id); if (item) onSelect(item); });
    chart.getZr().on('click', event => { if (!event.target) onClear(); });
    const observer = new ResizeObserver(() => { if (!chart.isDisposed() && element.current?.clientWidth && element.current.clientHeight) chart.resize(); });
    observer.observe(element.current);
    return () => { observer.disconnect(); chart.dispose(); if (chartRef.current === chart) chartRef.current = null; updateRef.current = () => {}; };
  }, [items, status, onSelect, onClear]);
  return <div className="geo-map"><div className="geo-chart" ref={element} role="img" aria-label="全球节点地图；所有地图对象也可通过列表选择" /><div className="geo-map-controls" aria-label="地图控件"><button type="button" aria-label="放大地图" onClick={() => zoom(1.5)}>＋</button><button type="button" aria-label="缩小地图" onClick={() => zoom(1 / 1.5)}>－</button><button type="button" aria-label="定位到全球" onClick={reset}>全球</button></div></div>;
}
