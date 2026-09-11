import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { Button as AntButton, Card as AntCard, ConfigProvider, Form as AntForm, Input as AntInput, Modal as AntModal, Table as AntTable } from "antd";
import Chart from "chart.js/auto";
import * as d3 from "d3";
import { createMockApi } from "../../../packages/mock-api/index.ts";
import "./labs.css";

const context = { actorId: "usr_001", role: "tenantAdmin" as const, tenantId: "ten_cn_001", seed: 20260829 };
const range = { from: "2026-08-28T00:00:00.000Z", to: "2026-08-29T00:00:00.000Z" };
const api = createMockApi(context);

function ChartsLab() {
  const echartsHost = useRef<HTMLDivElement>(null); const chartHost = useRef<HTMLCanvasElement>(null); const d3Host = useRef<SVGSVGElement>(null);
  const regions = api.getDashboard({ tenantId: context.tenantId, seed: context.seed, ...range }).data!.regions.filter(item => item.devices > 0);
  useEffect(() => {
    let disposed = false; let echart: import("echarts").ECharts | undefined;
    void import("echarts").then(echarts => { if (disposed) return; echart = echarts.init(echartsHost.current!); echart.setOption({ xAxis: { type: "category", data: regions.map(item => item.continent) }, yAxis: { type: "value" }, series: [{ type: "bar", data: regions.map(item => item.messages) }] }); });
    const chart = new Chart(chartHost.current!, { type: "line", data: { labels: regions.map(item => item.continent), datasets: [{ label: "同数据消息趋势", data: regions.map(item => item.messages), borderColor: "#22d3ee" }] } });
    const svg = d3.select(d3Host.current); const pie = d3.pie<(typeof regions)[number]>().value(item => item.messages)(regions); const arc = d3.arc<d3.PieArcDatum<(typeof regions)[number]>>().innerRadius(28).outerRadius(75); svg.attr("viewBox", "0 0 180 180").selectAll("path").data(pie).join("path").attr("transform", "translate(90,90)").attr("d", arc).attr("fill", (_, index) => ["#22d3ee", "#8b5cf6", "#f59e0b"][index % 3]);
    return () => { disposed = true; echart?.dispose(); chart?.destroy(); svg.selectAll("*").remove(); };
  }, [regions]);
  return <section className="lab-panel"><h2>图表实验室 · 相同 seed / 租户 / 时间范围</h2><div className="lab-chart-grid"><article><h3>ECharts 柱状图</h3><div ref={echartsHost} /></article><article><h3>Chart.js 趋势图</h3><canvas ref={chartHost} /></article><article><h3>D3.js 饼图</h3><svg ref={d3Host} aria-label="D3 地域消息占比饼图" /></article></div><p>体积/API：ECharts 功能完整但当前异步 chunk 约 1.1 MB；Chart.js Canvas API 紧凑；D3 提供底层 SVG 数据绑定，定制自由度最高。</p></section>;
}

export default function ReactLabs() {
  const [library, setLibrary] = useState("MUI"); const [open, setOpen] = useState(false); const rows = [{ key: "dev_001", name: "环境传感器-001", status: "online" }];
  return <main className="lab-scope"><Typography variant="h4">React 组件与图表实验室</Typography><Stack direction="row" spacing={1}>{["MUI", "Ant Design", "shadcn/ui"].map(item => <Button key={item} onClick={() => setLibrary(item)} variant={library === item ? "contained" : "outlined"}>{item}</Button>)}</Stack>{library === "MUI" && <Card className="lab-panel"><CardContent><Typography variant="h6">MUI · 表格 / 表单 / 弹窗 / 导航 / 主题</Typography><table><tbody>{rows.map(row => <tr key={row.key}><td>{row.name}</td><td>{row.status}</td></tr>)}</tbody></table><TextField label="设备名称" defaultValue={rows[0].name} /><Button onClick={() => setOpen(true)}>打开弹窗</Button><Dialog open={open} onClose={() => setOpen(false)}><DialogTitle>MUI 弹窗</DialogTitle><DialogContent>主题通过 sx 与设计令牌适配。</DialogContent><DialogActions><Button onClick={() => setOpen(false)}>关闭</Button></DialogActions></Dialog></CardContent></Card>}{library === "Ant Design" && <ConfigProvider theme={{ token: { colorPrimary: "#0891b2" } }}><AntCard className="lab-panel" title="Ant Design · 企业组件能力"><AntTable pagination={false} dataSource={rows} columns={[{ title: "设备", dataIndex: "name" }, { title: "状态", dataIndex: "status" }]} /><AntForm layout="inline"><AntForm.Item label="设备名称"><AntInput defaultValue={rows[0].name} /></AntForm.Item></AntForm><AntButton onClick={() => setOpen(true)}>打开弹窗</AntButton><AntModal open={open} onCancel={() => setOpen(false)} onOk={() => setOpen(false)}>Ant Design 导航与主题由 ConfigProvider 隔离。</AntModal></AntCard></ConfigProvider>}{library === "shadcn/ui" && <section className="lab-panel shadcn-lab"><h2>shadcn/ui · source-owned primitives</h2><nav><button>设备</button><button>规则</button></nav><table><tbody>{rows.map(row => <tr key={row.key}><td>{row.name}</td><td>{row.status}</td></tr>)}</tbody></table><label>设备名称<input defaultValue={rows[0].name} /></label><button onClick={() => setOpen(true)}>打开组合弹窗</button>{open && <div role="dialog" aria-modal="true" className="shadcn-dialog"><h3>shadcn/ui 弹窗</h3><p>组件源码归应用所有，主题使用 CSS 变量。</p><button onClick={() => setOpen(false)}>关闭</button></div>}<Alert severity="info">该示例采用官方推荐的源码所有权方式，不引入全局运行时。</Alert></section>}<ChartsLab /></main>;
}
