<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { LAB_CHART_LABELS, LAB_CHART_UNIT, LAB_CHART_VALUES, renderLabChart, type LabChartKind, type LabChartLibrary } from './lab-chart';
const libraries: Record<LabChartLibrary, string> = { echarts: 'Apache ECharts', chartjs: 'Chart.js', d3: 'D3.js' };
const kinds: Record<LabChartKind, string> = { trend: '趋势图', bar: '柱状图', pie: '饼图' };
const library = ref<LabChartLibrary>('echarts'), kind = ref<LabChartKind>('trend'), error = ref('');
const host = ref<HTMLElement | null>(null);
let cleanup: (() => void) | undefined, request = 0;
watch([host, library, kind], async () => {
  if (!host.value) return;
  const current = ++request, target = host.value, selectedLibrary = library.value, selectedKind = kind.value;
  cleanup?.(); cleanup = undefined; error.value = '';
  try { const dispose = await renderLabChart(target, selectedLibrary, selectedKind, () => current === request); if (current === request) { cleanup = dispose; target.dataset.renderedLibrary = selectedLibrary; target.dataset.renderedKind = selectedKind; } else dispose(); }
  catch (cause) { if (current === request) error.value = (cause as Error).message; }
}, { flush: 'post' });
onBeforeUnmount(() => { request++; cleanup?.(); });
function reset() { library.value = 'echarts'; kind.value = 'trend'; }
</script>
<template>
  <section class="lab-charts" aria-label="图表库对比"><h2>图表库对比</h2><div class="lab-controls"><label>图表库<select v-model="library" aria-label="实验图表库"><option v-for="(name, id) in libraries" :key="id" :value="id">{{ name }}</option></select></label><label>图表类型<select v-model="kind" aria-label="实验图表类型"><option v-for="(name, id) in kinds" :key="id" :value="id">{{ name }}</option></select></label></div><p>同一固定数据集：{{ LAB_CHART_LABELS.map((label, index) => `${label} ${LAB_CHART_VALUES[index]} ${LAB_CHART_UNIT}`).join(' · ') }}</p><div ref="host" class="lab-chart-host" role="img" :aria-label="`${libraries[library]} ${kinds[kind]}，数据为 ${LAB_CHART_VALUES.join('、')}`" /><p v-if="error" role="alert">图表加载失败：{{ error }} <button @click="reset">恢复默认图表</button></p><p>渲染库：{{ libraries[library] }}；示例数据不随库切换而改变。</p></section>
</template>
