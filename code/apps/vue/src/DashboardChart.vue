<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { DashboardData } from './dashboard';
import { countryNames, world } from './world';

const props = defineProps<{ kind: 'world' | 'trend' | 'alarm'; data: DashboardData }>();
const emit = defineEmits<{ country: [code: string] }>();
const element = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let resize: ResizeObserver | null = null;
echarts.registerMap('iot-world', world as unknown as Parameters<typeof echarts.registerMap>[1]);

function zoom(factor: number) {
  if (!chart) return;
  const current = (chart.getOption() as { geo?: { zoom?: number }[] }).geo?.[0]?.zoom ?? 1;
  chart.setOption({ geo: { zoom: Math.max(1, Math.min(5, current * factor)) } });
}
function reset() { chart?.setOption({ geo: { center: [0, 0], zoom: 1 } }); }

function draw() {
  if (!chart) return;
  if (props.kind === 'world') chart.setOption({
    backgroundColor: 'transparent', animation: false, tooltip: { trigger: 'item' },
    geo: { map: 'iot-world', roam: true, scaleLimit: { min: 1, max: 5 }, itemStyle: { areaColor: '#123a58', borderColor: '#35607a' }, emphasis: { itemStyle: { areaColor: '#27678d' } } },
    series: [{ type: 'scatter', coordinateSystem: 'geo', symbolSize: 13, itemStyle: { color: '#4de1fa', shadowBlur: 12, shadowColor: '#4de1fa' }, data: props.data.nodes.filter(node => node.coordinates !== null).map(node => ({ name: node.id, value: [...node.coordinates!, node.devices], countryCode: node.countryCode })) }],
  }, true);
  if (props.kind === 'trend') chart.setOption({
    backgroundColor: 'transparent', animation: false, tooltip: { trigger: 'axis' }, grid: { left: 54, right: 12, top: 20, bottom: 35 },
    xAxis: { type: 'category', data: props.data.trend.map(point => point.timestamp.slice(5, 10)), axisLabel: { color: '#9db8c6' }, axisLine: { lineStyle: { color: '#426073' } } },
    yAxis: { type: 'value', axisLabel: { color: '#9db8c6' }, splitLine: { lineStyle: { color: '#284357' } } },
    series: [{ type: 'line', smooth: true, areaStyle: { color: 'rgba(50, 195, 236, .18)' }, lineStyle: { color: '#39d3ef', width: 3 }, itemStyle: { color: '#39d3ef' }, data: props.data.trend.map(point => point.messages) }],
  }, true);
  if (props.kind === 'alarm') chart.setOption({
    backgroundColor: 'transparent', animation: false, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: '#9db8c6' } },
    series: [{ type: 'pie', radius: ['52%', '72%'], center: ['50%', '43%'], label: { show: false }, data: props.data.alarmDistribution.map(item => ({ name: { critical: '紧急', major: '重要', minor: '一般' }[item.severity], value: item.count, itemStyle: { color: { critical: '#ff6570', major: '#ffb451', minor: '#ffe287' }[item.severity] } })) }],
  }, true);
}
onMounted(() => {
  if (!element.value) return;
  chart = echarts.init(element.value, undefined, { renderer: 'svg' });
  chart.on('click', event => {
    const row = event.data as { countryCode?: string } | undefined;
    const code = row?.countryCode ?? countryNames[event.name];
    if (code) emit('country', code);
  });
  resize = new ResizeObserver(() => { if (chart && !chart.isDisposed() && element.value?.clientWidth && element.value.clientHeight) chart.resize(); });
  resize.observe(element.value);
  draw();
});
watch(() => props.data, draw);
onBeforeUnmount(() => { resize?.disconnect(); chart?.dispose(); });
</script>
<template><div :class="kind === 'world' ? 'dashboard-map' : undefined"><div ref="element" :class="`${kind}-chart`" role="img" :aria-label="kind === 'world' ? '全球节点地图；可在下方国家排行中键盘选择国家' : kind === 'trend' ? '消息吞吐趋势图；各时间点数值见下方表格' : '告警等级分布图；数量见下方列表'" /><div v-if="kind === 'world'" class="dashboard-map-controls" role="group" aria-label="地图控件"><button type="button" aria-label="放大地图" @click="zoom(1.5)">＋</button><button type="button" aria-label="缩小地图" @click="zoom(1 / 1.5)">－</button><button type="button" aria-label="定位到全球" @click="reset">全球</button></div></div></template>
