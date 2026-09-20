import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { DashboardData } from './dashboard';
import { countryNames, world } from './world';

echarts.registerMap('iot-world', world as unknown as Parameters<typeof echarts.registerMap>[1]);

export function WorldChart({ data, onCountry }: { data: DashboardData; onCountry: (code: string) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const zoom = (factor: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    const current = (chart.getOption() as { geo?: { zoom?: number }[] }).geo?.[0]?.zoom ?? 1;
    chart.setOption({ geo: { zoom: Math.max(1, Math.min(5, current * factor)) } });
  };
  const reset = () => chartRef.current?.setOption({ geo: { center: [0, 0], zoom: 1 } });
  useEffect(() => {
    if (!element.current) return;
    const chart = echarts.init(element.current, undefined, { renderer: 'svg' });
    chartRef.current = chart;
    chart.setOption({
      backgroundColor: 'transparent', animation: false,
      tooltip: { trigger: 'item' },
      geo: { map: 'iot-world', roam: true, scaleLimit: { min: 1, max: 5 }, itemStyle: { areaColor: '#123a58', borderColor: '#35607a' }, emphasis: { itemStyle: { areaColor: '#27678d' } } },
      series: [{ type: 'scatter', coordinateSystem: 'geo', symbolSize: 13, itemStyle: { color: '#4de1fa', shadowBlur: 12, shadowColor: '#4de1fa' }, data: data.nodes.filter(node => node.coordinates !== null).map(node => ({ name: node.id, value: [...node.coordinates!, node.devices], countryCode: node.countryCode })) }],
    });
    chart.on('click', event => {
      const row = event.data as { countryCode?: string } | undefined;
      const code = row?.countryCode ?? countryNames[event.name];
      if (code) onCountry(code);
    });
    const resize = new ResizeObserver(() => { if (!chart.isDisposed() && element.current?.clientWidth && element.current.clientHeight) chart.resize(); });
    resize.observe(element.current);
    return () => { resize.disconnect(); chartRef.current = null; chart.dispose(); };
  }, [data, onCountry]);
  return <div className="dashboard-map"><div className="world-chart" ref={element} role="img" aria-label="全球节点地图；可在下方国家排行中键盘选择国家" /><div className="dashboard-map-controls" role="group" aria-label="地图控件"><button type="button" aria-label="放大地图" onClick={() => zoom(1.5)}>＋</button><button type="button" aria-label="缩小地图" onClick={() => zoom(1 / 1.5)}>－</button><button type="button" aria-label="定位到全球" onClick={reset}>全球</button></div></div>;
}

export function TrendChart({ data }: { data: DashboardData }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const chart = echarts.init(element.current, undefined, { renderer: 'svg' });
    chart.setOption({
      backgroundColor: 'transparent', animation: false,
      tooltip: { trigger: 'axis' },
      grid: { left: 54, right: 12, top: 20, bottom: 35 },
      xAxis: { type: 'category', data: data.trend.map(point => point.timestamp.slice(5, 10)), axisLabel: { color: '#9db8c6' }, axisLine: { lineStyle: { color: '#426073' } } },
      yAxis: { type: 'value', axisLabel: { color: '#9db8c6' }, splitLine: { lineStyle: { color: '#284357' } } },
      series: [{ type: 'line', smooth: true, areaStyle: { color: 'rgba(50, 195, 236, .18)' }, lineStyle: { color: '#39d3ef', width: 3 }, itemStyle: { color: '#39d3ef' }, data: data.trend.map(point => point.messages) }],
    });
    const resize = new ResizeObserver(() => { if (!chart.isDisposed() && element.current?.clientWidth && element.current.clientHeight) chart.resize(); });
    resize.observe(element.current);
    return () => { resize.disconnect(); chart.dispose(); };
  }, [data]);
  return <div className="trend-chart" ref={element} role="img" aria-label="消息吞吐趋势图；各时间点数值见下方表格" />;
}

export function AlarmChart({ data }: { data: DashboardData }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const chart = echarts.init(element.current, undefined, { renderer: 'svg' });
    chart.setOption({
      backgroundColor: 'transparent', animation: false,
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: '#9db8c6' } },
      series: [{ type: 'pie', radius: ['52%', '72%'], center: ['50%', '43%'], label: { show: false }, data: data.alarmDistribution.map(item => ({ name: { critical: '紧急', major: '重要', minor: '一般' }[item.severity], value: item.count, itemStyle: { color: { critical: '#ff6570', major: '#ffb451', minor: '#ffe287' }[item.severity] } })) }],
    });
    const resize = new ResizeObserver(() => { if (!chart.isDisposed() && element.current?.clientWidth && element.current.clientHeight) chart.resize(); });
    resize.observe(element.current);
    return () => { resize.disconnect(); chart.dispose(); };
  }, [data]);
  return <div className="alarm-chart" ref={element} role="img" aria-label="告警等级分布图；数量见下方列表" />;
}
