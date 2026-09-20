<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { GeoItem } from './geography';
import { geoMapPoints } from './geo-cluster';
import { geoPointColor } from './geo-status';
import { world } from './world';
const props = defineProps<{ items: GeoItem[]; status: string }>();
const emit = defineEmits<{ select: [item: GeoItem]; clear: [] }>();
const element = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let observer: ResizeObserver | null = null;
echarts.registerMap('iot-geo-world', world as unknown as Parameters<typeof echarts.registerMap>[1]);
function currentZoom() { return (chart?.getOption() as { geo?: { zoom?: number }[] } | undefined)?.geo?.[0]?.zoom ?? 1; }
function updatePoints() { chart?.setOption({ series: [{ data: geoMapPoints(props.items, currentZoom()).map(point => ({ name: point.name, value: [...point.coordinates, point.devices], id: point.id, count: point.devices, cluster: point.cluster, coordinates: point.coordinates, itemStyle: { color: geoPointColor(props.items.filter(item => point.memberIds.includes(item.id)), props.status) } })) }] }); }
function zoom(factor: number) {
  if (!chart) return;
  chart.setOption({ geo: { zoom: Math.max(1, Math.min(8, currentZoom() * factor)) } });
  updatePoints();
}
function reset() { chart?.setOption({ geo: { center: [0, 0], zoom: 1 } }); updatePoints(); }
function draw() {
  if (!chart) return;
  chart.setOption({ animation: false, tooltip: { trigger: 'item', formatter: (param: { name: string }) => param.name },
    geo: { map: 'iot-geo-world', roam: true, scaleLimit: { min: 1, max: 8 }, itemStyle: { areaColor: '#123a58', borderColor: '#35607a' }, emphasis: { itemStyle: { areaColor: '#27678d' } } },
    series: [{ type: 'scatter', coordinateSystem: 'geo', symbolSize: (value: number[]) => Math.min(30, 12 + value[2] * 3),
      itemStyle: { color: '#40d8f1', shadowBlur: 12, shadowColor: '#40d8f1' }, label: { show: true, formatter: (param: { data: { count: number } }) => `${param.data.count}`, color: '#fff', fontSize: 10 },
      data: [] }],
  }, true);
  updatePoints();
}
onMounted(() => { if (!element.value) return; chart = echarts.init(element.value, undefined, { renderer: 'svg' }); chart.on('georoam', updatePoints); chart.on('click', event => { const point = event.data as { id?: string; cluster?: boolean; coordinates?: [number, number] } | undefined; if (point?.cluster && point.coordinates) { chart?.setOption({ geo: { center: point.coordinates, zoom: Math.min(8, currentZoom() * 1.5) } }); updatePoints(); return; } const item = props.items.find(candidate => candidate.id === point?.id); if (item) emit('select', item); }); chart.getZr().on('click', event => { if (!event.target) emit('clear'); }); observer = new ResizeObserver(() => { if (chart && !chart.isDisposed() && element.value?.clientWidth && element.value.clientHeight) chart.resize(); }); observer.observe(element.value); draw(); });
watch(() => [props.items, props.status], draw);
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose(); });
</script>
<template><div class="geo-map"><div ref="element" class="geo-chart" role="img" aria-label="全球节点地图；所有地图对象也可通过列表选择" /><div class="geo-map-controls" aria-label="地图控件"><button type="button" aria-label="放大地图" @click="zoom(1.5)">＋</button><button type="button" aria-label="缩小地图" @click="zoom(1 / 1.5)">－</button><button type="button" aria-label="定位到全球" @click="reset">全球</button></div></div></template>
