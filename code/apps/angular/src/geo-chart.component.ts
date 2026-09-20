import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';
import * as echarts from 'echarts';
import type { GeoItem } from './geography';
import { geoMapPoints } from './geo-cluster';
import { geoPointColor } from './geo-status';
import { world } from './world';

echarts.registerMap('iot-geo-world', world as unknown as Parameters<typeof echarts.registerMap>[1]);
@Component({ selector: 'app-geo-chart', standalone: true, template: `<div class="geo-map"><div #host class="geo-chart" role="img" aria-label="全球节点地图；所有地图对象也可通过列表选择"></div><div class="geo-map-controls" aria-label="地图控件"><button type="button" aria-label="放大地图" (click)="zoom(1.5)">＋</button><button type="button" aria-label="缩小地图" (click)="zoom(1 / 1.5)">－</button><button type="button" aria-label="定位到全球" (click)="reset()">全球</button></div></div>`, styles: [':host { display: block; width: 100%; } .geo-chart { width: 100%; height: 29rem; } .geo-map { position: relative; min-width: 0; } .geo-map-controls { position: absolute; top: 0.65rem; right: 0.65rem; display: flex; gap: 0.3rem; padding: 0.3rem; border: 1px solid var(--line); border-radius: 0.4rem; background: var(--panel); } .geo-map-controls button { min-width: 2.3rem; min-height: 2.3rem; padding: 0.2rem 0.45rem; border: 1px solid var(--line); border-radius: 0.3rem; background: var(--panel); color: inherit; cursor: pointer; } .geo-map-controls button:focus-visible { outline: 2px solid #40d8f1; outline-offset: 2px; }'] })
export class GeoChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) items: GeoItem[] = [];
  @Input({ required: true }) status = '';
  @Output() selectItem = new EventEmitter<GeoItem>();
  @Output() clearSelection = new EventEmitter<void>();
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  private chart: echarts.ECharts | null = null;
  private observer: ResizeObserver | null = null;
  ngAfterViewInit() { this.chart = echarts.init(this.host.nativeElement, undefined, { renderer: 'svg' }); this.chart.on('georoam', () => this.updatePoints()); this.chart.on('click', event => { const point = event.data as { id?: string; cluster?: boolean; coordinates?: [number, number] } | undefined; if (point?.cluster && point.coordinates) { this.chart?.setOption({ geo: { center: point.coordinates, zoom: Math.min(8, this.currentZoom() * 1.5) } }); this.updatePoints(); return; } const item = this.items.find(candidate => candidate.id === point?.id); if (item) this.selectItem.emit(item); }); this.chart.getZr().on('click', event => { if (!event.target) this.clearSelection.emit(); }); this.observer = new ResizeObserver(() => { if (this.chart && !this.chart.isDisposed() && this.host.nativeElement.clientWidth && this.host.nativeElement.clientHeight) this.chart.resize(); }); this.observer.observe(this.host.nativeElement); this.draw(); }
  ngOnChanges() { this.draw(); }
  ngOnDestroy() { this.observer?.disconnect(); this.chart?.dispose(); }
  private currentZoom() { return (this.chart?.getOption() as { geo?: { zoom?: number }[] } | undefined)?.geo?.[0]?.zoom ?? 1; }
  private updatePoints() { this.chart?.setOption({ series: [{ data: geoMapPoints(this.items, this.currentZoom()).map(point => ({ name: point.name, value: [...point.coordinates, point.devices], id: point.id, count: point.devices, cluster: point.cluster, coordinates: point.coordinates, itemStyle: { color: geoPointColor(this.items.filter(item => point.memberIds.includes(item.id)), this.status) } })) }] }); }
  zoom(factor: number) { if (!this.chart) return; this.chart.setOption({ geo: { zoom: Math.max(1, Math.min(8, this.currentZoom() * factor)) } }); this.updatePoints(); }
  reset() { this.chart?.setOption({ geo: { center: [0, 0], zoom: 1 } }); this.updatePoints(); }
  private draw() { if (!this.chart) return; this.chart.setOption({ animation: false, tooltip: { trigger: 'item', formatter: (param: { name: string }) => param.name }, geo: { map: 'iot-geo-world', roam: true, scaleLimit: { min: 1, max: 8 }, itemStyle: { areaColor: '#123a58', borderColor: '#35607a' }, emphasis: { itemStyle: { areaColor: '#27678d' } } }, series: [{ type: 'scatter', coordinateSystem: 'geo', symbolSize: (value: number[]) => Math.min(30, 12 + value[2] * 3), itemStyle: { color: '#40d8f1', shadowBlur: 12, shadowColor: '#40d8f1' }, label: { show: true, formatter: (param: { data: { count: number } }) => `${param.data.count}`, color: '#fff', fontSize: 10 }, data: [] }] }, true); this.updatePoints(); }
}
