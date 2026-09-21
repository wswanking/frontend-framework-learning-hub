import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';
import * as echarts from 'echarts';
import type { DashboardData } from './dashboard';
import { countryNames, world } from './world';

echarts.registerMap('iot-world', world as unknown as Parameters<typeof echarts.registerMap>[1]);

@Component({
  selector: 'app-dashboard-chart', standalone: true,
  template: `<div [class.dashboard-map]="kind === 'world'"><div #host [class]="kind + '-chart'" role="img" [attr.aria-label]="kind === 'world' ? '全球节点地图；可在下方国家排行中键盘选择国家' : kind === 'trend' ? '消息吞吐趋势图；各时间点数值见下方表格' : '告警等级分布图；数量见下方列表'"></div>@if (kind === 'world') { <div class="dashboard-map-controls" role="group" aria-label="地图控件"><button type="button" aria-label="放大地图" (click)="zoom(1.5)">＋</button><button type="button" aria-label="缩小地图" (click)="zoom(1 / 1.5)">－</button><button type="button" aria-label="定位到全球" (click)="reset()">全球</button></div> }</div>`,
  styles: [':host { display: block; width: 100%; } .world-chart { width: 100%; height: 22rem; } .trend-chart, .alarm-chart { width: 100%; height: 13rem; } .dashboard-map { position: relative; min-width: 0; } .dashboard-map-controls { position: absolute; top: 0.5rem; left: 0.5rem; display: grid; gap: 0.25rem; padding: 0.2rem; border: 1px solid var(--line); border-radius: 0.35rem; background: var(--panel); } .dashboard-map-controls button { min-width: 2rem; min-height: 2rem; padding: 0.15rem; border: 1px solid var(--line); border-radius: 0.25rem; color: var(--text); background: var(--panel); cursor: pointer; } .dashboard-map-controls button:focus-visible { outline: 2px solid #40d8f1; outline-offset: 2px; }'],
})
export class DashboardChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) kind: 'world' | 'trend' | 'alarm' = 'world';
  @Input({ required: true }) data!: DashboardData;
  @Output() country = new EventEmitter<string>();
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  private chart: echarts.ECharts | null = null;
  private resize: ResizeObserver | null = null;
  ngAfterViewInit() {
    this.chart = echarts.init(this.host.nativeElement, undefined, { renderer: 'svg' });
    this.chart.on('click', event => {
      const row = event.data as { countryCode?: string } | undefined;
      const code = row?.countryCode ?? countryNames[event.name];
      if (code) this.country.emit(code);
    });
    this.resize = new ResizeObserver(() => { if (this.chart && !this.chart.isDisposed() && this.host.nativeElement.clientWidth && this.host.nativeElement.clientHeight) this.chart.resize(); });
    this.resize.observe(this.host.nativeElement);
    this.draw();
  }
  ngOnChanges() { this.draw(); }
  ngOnDestroy() { this.resize?.disconnect(); this.chart?.dispose(); }
  zoom(factor: number) {
    if (!this.chart) return;
    const current = (this.chart.getOption() as { geo?: { zoom?: number }[] }).geo?.[0]?.zoom ?? 1;
    this.chart.setOption({ geo: { zoom: Math.max(1, Math.min(5, current * factor)) } });
  }
  reset() { this.chart?.setOption({ geo: { center: [0, 0], zoom: 1 } }); }
  private draw() {
    if (!this.chart || !this.data) return;
    if (this.kind === 'world') this.chart.setOption({
      backgroundColor: 'transparent', animation: false, tooltip: { trigger: 'item' },
      geo: { map: 'iot-world', roam: true, scaleLimit: { min: 1, max: 5 }, itemStyle: { areaColor: '#123a58', borderColor: '#35607a' }, emphasis: { itemStyle: { areaColor: '#27678d' } } },
      series: [{ type: 'scatter', coordinateSystem: 'geo', symbolSize: 13, itemStyle: { color: '#4de1fa', shadowBlur: 12, shadowColor: '#4de1fa' }, data: this.data.nodes.filter(node => node.coordinates !== null).map(node => ({ name: node.id, value: [...node.coordinates!, node.devices], countryCode: node.countryCode })) }],
    }, true);
    if (this.kind === 'trend') this.chart.setOption({
      backgroundColor: 'transparent', animation: false, tooltip: { trigger: 'axis' }, grid: { left: 54, right: 12, top: 20, bottom: 35 },
      xAxis: { type: 'category', data: this.data.trend.map(point => point.timestamp.slice(5, 10)), axisLabel: { color: '#9db8c6' }, axisLine: { lineStyle: { color: '#426073' } } },
      yAxis: { type: 'value', axisLabel: { color: '#9db8c6' }, splitLine: { lineStyle: { color: '#284357' } } },
      series: [{ type: 'line', smooth: true, areaStyle: { color: 'rgba(50, 195, 236, .18)' }, lineStyle: { color: '#39d3ef', width: 3 }, itemStyle: { color: '#39d3ef' }, data: this.data.trend.map(point => point.messages) }],
    }, true);
    if (this.kind === 'alarm') this.chart.setOption({
      backgroundColor: 'transparent', animation: false, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: '#9db8c6' } },
      series: [{ type: 'pie', radius: ['52%', '72%'], center: ['50%', '43%'], label: { show: false }, data: this.data.alarmDistribution.map(item => ({ name: { critical: '紧急', major: '重要', minor: '一般' }[item.severity], value: item.count, itemStyle: { color: { critical: '#ff6570', major: '#ffb451', minor: '#ffe287' }[item.severity] } })) }],
    }, true);
  }
}
