import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatTableModule } from "@angular/material/table";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { DialogModule } from "primeng/dialog";
import { InputTextModule } from "primeng/inputtext";
import { TableModule } from "primeng/table";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzCardModule } from "ng-zorro-antd/card";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzTableModule } from "ng-zorro-antd/table";
import Chart from "chart.js/auto";
import * as d3 from "d3";
import { createMockApi } from "../../../packages/mock-api/index.ts";
import "./labs.css";

const context = { actorId: "usr_001", role: "tenantAdmin" as const, tenantId: "ten_cn_001", seed: 20260829 };
const api = createMockApi(context); const range = { from: "2026-08-28T00:00:00.000Z", to: "2026-08-29T00:00:00.000Z" };

@Component({
  selector: "framework-labs",
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatTableModule, ButtonModule, CardModule, DialogModule, InputTextModule, TableModule, NzButtonModule, NzCardModule, NzInputModule, NzModalModule, NzTableModule],
  template: `<section class="lab-scope"><h1>Angular 组件与图表实验室</h1><nav><button *ngFor="let item of libraries" (click)="library=item">{{item}}</button></nav><mat-card *ngIf="library==='Angular Material'" class="lab-panel"><h2>Angular Material · 表格 / 表单 / 弹窗 / 导航 / 主题</h2><table mat-table [dataSource]="rows"><ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>设备</th><td mat-cell *matCellDef="let row">{{row.name}}</td></ng-container><ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>状态</th><td mat-cell *matCellDef="let row">{{row.status}}</td></ng-container><tr mat-header-row *matHeaderRowDef="columns"></tr><tr mat-row *matRowDef="let row;columns:columns"></tr></table><mat-form-field><mat-label>设备名称</mat-label><input matInput [value]="rows[0].name"/></mat-form-field><button matButton="filled" (click)="dialogOpen=true">打开弹窗</button><mat-card *ngIf="dialogOpen" role="dialog" aria-modal="true" class="lab-dialog">Material 主题由当前实验组件作用域适配<button matButton (click)="dialogOpen=false">关闭</button></mat-card></mat-card><p-card *ngIf="library==='PrimeNG'" class="lab-panel"><h2>PrimeNG · 表格 / 表单 / 弹窗 / 导航 / 主题</h2><p-table [value]="rows"><ng-template #header><tr><th>设备</th><th>状态</th></tr></ng-template><ng-template #body let-row><tr><td>{{row.name}}</td><td>{{row.status}}</td></tr></ng-template></p-table><input pInputText [value]="rows[0].name"/><p-button label="打开弹窗" (onClick)="dialogOpen=true"/><p-dialog header="PrimeNG 弹窗" [(visible)]="dialogOpen" [modal]="true">主题 preset 仅用于实验组件。</p-dialog></p-card><nz-card *ngIf="library==='NG-ZORRO'" class="lab-panel" nzTitle="NG-ZORRO · 表格 / 表单 / 弹窗 / 导航 / 主题"><nz-table #table [nzData]="rows" [nzShowPagination]="false"><thead><tr><th>设备</th><th>状态</th></tr></thead><tbody><tr *ngFor="let row of table.data"><td>{{row.name}}</td><td>{{row.status}}</td></tr></tbody></nz-table><input nz-input [value]="rows[0].name"/><button nz-button nzType="primary" (click)="dialogOpen=true">打开弹窗</button><nz-modal [(nzVisible)]="dialogOpen" nzTitle="NG-ZORRO 弹窗" (nzOnCancel)="dialogOpen=false" (nzOnOk)="dialogOpen=false"><ng-container *nzModalContent>Ant Design 主题变量仅在实验组件中使用。</ng-container></nz-modal></nz-card><section class="lab-panel"><h2>图表实验室 · 相同 seed / 租户 / 时间范围</h2><div class="lab-chart-grid"><article><h3>ECharts 柱状图</h3><div #echartsHost></div></article><article><h3>Chart.js 趋势图</h3><canvas #chartHost></canvas></article><article><h3>D3.js 饼图</h3><svg #d3Host aria-label="D3 地域消息占比饼图"></svg></article></div><p>体积/API：ECharts 功能完整；Chart.js Canvas API 紧凑；D3 提供底层 SVG 数据绑定与最高定制自由度。</p></section></section>`,
})
export class FrameworkLabsComponent implements AfterViewInit, OnDestroy {
  library = "Angular Material"; libraries = ["Angular Material", "PrimeNG", "NG-ZORRO"]; dialogOpen = false; columns = ["name", "status"]; rows = [{ key: "dev_001", name: "环境传感器-001", status: "online" }];
  @ViewChild("echartsHost") echartsHost!: ElementRef<HTMLDivElement>; @ViewChild("chartHost") chartHost!: ElementRef<HTMLCanvasElement>; @ViewChild("d3Host") d3Host!: ElementRef<SVGSVGElement>; private chart?: Chart; private echart?: import("echarts").ECharts;
  ngAfterViewInit() { const regions = api.getDashboard({ tenantId: context.tenantId, seed: context.seed, ...range }).data!.regions.filter(item => item.devices > 0); void import("echarts").then(echarts => { this.echart = echarts.init(this.echartsHost.nativeElement); this.echart.setOption({ xAxis: { type: "category", data: regions.map(item => item.continent) }, yAxis: { type: "value" }, series: [{ type: "bar", data: regions.map(item => item.messages) }] }); }); this.chart = new Chart(this.chartHost.nativeElement, { type: "line", data: { labels: regions.map(item => item.continent), datasets: [{ label: "同数据消息趋势", data: regions.map(item => item.messages), borderColor: "#22d3ee" }] } }); const svg = d3.select(this.d3Host.nativeElement); const pie = d3.pie<(typeof regions)[number]>().value(item => item.messages)(regions); const arc = d3.arc<d3.PieArcDatum<(typeof regions)[number]>>().innerRadius(28).outerRadius(75); svg.attr("viewBox", "0 0 180 180").selectAll("path").data(pie).join("path").attr("transform", "translate(90,90)").attr("d", arc).attr("fill", (_, index) => ["#22d3ee", "#8b5cf6", "#f59e0b"][index % 3]); }
  ngOnDestroy() { this.chart?.destroy(); this.echart?.dispose(); if (this.d3Host) d3.select(this.d3Host.nativeElement).selectAll("*").remove(); }
}
