import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { LAB_CHART_LABELS, LAB_CHART_UNIT, LAB_CHART_VALUES, renderLabChart, type LabChartKind, type LabChartLibrary } from './lab-chart';

@Component({ selector: 'app-lab-charts', standalone: true, styles: [':host{display:block}.lab-charts{margin-top:18px;padding:18px;border:1px solid #31536a;border-radius:12px;background:#132b3b;color:#edf9ff}.lab-controls{display:grid;grid-template-columns:repeat(2,minmax(0,220px));gap:12px}.lab-controls label{display:grid;gap:5px}.lab-controls select{width:100%;min-height:38px;padding:7px;border:1px solid #68849a;border-radius:6px;background:#102433;color:#fff}.lab-chart-host{width:100%;height:300px;min-width:0}.lab-chart-host svg{width:100%;height:100%}@media(max-width:700px){.lab-controls{grid-template-columns:1fr}}'], template: `<section class="lab-charts" aria-label="图表库对比"><h2>图表库对比</h2><div class="lab-controls"><label>图表库<select aria-label="实验图表库" [value]="library()" (change)="setLibrary($any($event.target).value)"><option value="echarts">Apache ECharts</option><option value="chartjs">Chart.js</option><option value="d3">D3.js</option></select></label><label>图表类型<select aria-label="实验图表类型" [value]="kind()" (change)="setKind($any($event.target).value)"><option value="trend">趋势图</option><option value="bar">柱状图</option><option value="pie">饼图</option></select></label></div><p>同一固定数据集：{{ description }}</p><div #chartHost class="lab-chart-host" role="img" [attr.aria-label]="chartLabel()"></div>@if (error()) { <p role="alert">图表加载失败：{{ error() }} <button (click)="reset()">恢复默认图表</button></p> }<p>渲染库：{{ libraryName() }}；示例数据不随库切换而改变。</p></section>` })
export class LabChartsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartHost') private host?: ElementRef<HTMLElement>;
  readonly library = signal<LabChartLibrary>('echarts');
  readonly kind = signal<LabChartKind>('trend');
  readonly error = signal('');
  readonly description = LAB_CHART_LABELS.map((label, index) => `${label} ${LAB_CHART_VALUES[index]} ${LAB_CHART_UNIT}`).join(' · ');
  private request = 0;
  private cleanup?: () => void;
  ngAfterViewInit() { void this.render(); }
  ngOnDestroy() { this.request++; this.cleanup?.(); }
  libraryName() { return { echarts: 'Apache ECharts', chartjs: 'Chart.js', d3: 'D3.js' }[this.library()]; }
  chartLabel() { return `${this.libraryName()} ${{ trend: '趋势图', bar: '柱状图', pie: '饼图' }[this.kind()]}，数据为 ${LAB_CHART_VALUES.join('、')}`; }
  setLibrary(value: LabChartLibrary) { this.library.set(value); void this.render(); }
  setKind(value: LabChartKind) { this.kind.set(value); void this.render(); }
  reset() { this.library.set('echarts'); this.kind.set('trend'); void this.render(); }
  private async render() {
    const target = this.host?.nativeElement;
    if (!target) return;
    const current = ++this.request;
    this.cleanup?.(); this.cleanup = undefined; this.error.set('');
    const library = this.library(), kind = this.kind();
    try { const dispose = await renderLabChart(target, library, kind, () => current === this.request); if (current === this.request) { this.cleanup = dispose; target.dataset['renderedLibrary'] = library; target.dataset['renderedKind'] = kind; } else dispose(); }
    catch (cause) { if (current === this.request) this.error.set((cause as Error).message); }
  }
}
