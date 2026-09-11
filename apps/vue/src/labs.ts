import { computed, defineComponent, h, onMounted, onUnmounted, ref } from "vue";
import { ElButton, ElCard, ElDialog, ElForm, ElFormItem, ElInput, ElTable, ElTableColumn } from "element-plus";
import { Button as AButton, Card as ACard, Form as AForm, FormItem as AFormItem, Input as AInput, Modal as AModal, Table as ATable } from "ant-design-vue";
import { VBtn, VCard, VDataTable, VDialog, VTextField } from "vuetify/components";
import Chart from "chart.js/auto";
import * as d3 from "d3";
import { createMockApi } from "../../../packages/mock-api/index.ts";
import "vuetify/styles";
import "./labs.css";

const context = { actorId: "usr_001", role: "tenantAdmin" as const, tenantId: "ten_cn_001", seed: 20260829 };
const api = createMockApi(context); const range = { from: "2026-08-28T00:00:00.000Z", to: "2026-08-29T00:00:00.000Z" };

const ChartsLab = defineComponent({
  setup() {
    const echartsHost = ref<HTMLDivElement>(); const chartHost = ref<HTMLCanvasElement>(); const d3Host = ref<SVGSVGElement>(); const regions = api.getDashboard({ tenantId: context.tenantId, seed: context.seed, ...range }).data!.regions.filter(item => item.devices > 0); let chart: Chart | undefined; let echart: import("echarts").ECharts | undefined;
    onMounted(() => { void import("echarts").then(echarts => { echart = echarts.init(echartsHost.value!); echart.setOption({ xAxis: { type: "category", data: regions.map(item => item.continent) }, yAxis: { type: "value" }, series: [{ type: "bar", data: regions.map(item => item.messages) }] }); }); chart = new Chart(chartHost.value!, { type: "line", data: { labels: regions.map(item => item.continent), datasets: [{ label: "同数据消息趋势", data: regions.map(item => item.messages), borderColor: "#22d3ee" }] } }); const svg = d3.select(d3Host.value); const pie = d3.pie<(typeof regions)[number]>().value(item => item.messages)(regions); const arc = d3.arc<d3.PieArcDatum<(typeof regions)[number]>>().innerRadius(28).outerRadius(75); svg.attr("viewBox", "0 0 180 180").selectAll("path").data(pie).join("path").attr("transform", "translate(90,90)").attr("d", arc).attr("fill", (_, index) => ["#22d3ee", "#8b5cf6", "#f59e0b"][index % 3]); }); onUnmounted(() => { chart?.destroy(); echart?.dispose(); d3.select(d3Host.value).selectAll("*").remove(); });
    return { echartsHost, chartHost, d3Host };
  },
  template: `<section class="lab-panel"><h2>图表实验室 · 相同 seed / 租户 / 时间范围</h2><div class="lab-chart-grid"><article><h3>ECharts 柱状图</h3><div ref="echartsHost"></div></article><article><h3>Chart.js 趋势图</h3><canvas ref="chartHost"></canvas></article><article><h3>D3.js 饼图</h3><svg ref="d3Host" aria-label="D3 地域消息占比饼图"></svg></article></div><p>体积/API：ECharts 功能完整；Chart.js Canvas API 紧凑；D3 提供底层 SVG 数据绑定与最高定制自由度。</p></section>`,
});

export default defineComponent({
  components: { ElButton, ElCard, ElDialog, ElForm, ElFormItem, ElInput, ElTable, ElTableColumn, AButton, ACard, AForm, AFormItem, AInput, AModal, ATable, VBtn, VCard, VDataTable, VDialog, VTextField, ChartsLab },
  setup() { const library = ref("Element Plus"); const open = ref(false); const rows = [{ key: "dev_001", name: "环境传感器-001", status: "online" }]; const antColumns = [{ title: "设备", dataIndex: "name" }, { title: "状态", dataIndex: "status" }]; const vuetifyHeaders = [{ title: "设备", key: "name" }, { title: "状态", key: "status" }]; return { library, open, rows, antColumns, vuetifyHeaders, libraries: ["Element Plus", "Ant Design Vue", "Vuetify"], h, capability: computed(() => `${library.value} 的表格、表单、弹窗、导航与主题能力`) }; },
  template: `<main class="lab-scope"><h1>Vue 组件与图表实验室</h1><nav><button v-for="item in libraries" :key="item" @click="library=item">{{item}}</button></nav><el-card v-if="library==='Element Plus'" class="lab-panel"><h2>{{capability}}</h2><el-table :data="rows"><el-table-column prop="name" label="设备"/><el-table-column prop="status" label="状态"/></el-table><el-form inline><el-form-item label="设备名称"><el-input :model-value="rows[0].name"/></el-form-item></el-form><el-button @click="open=true">打开弹窗</el-button><el-dialog v-model="open" title="Element Plus 弹窗">CSS 变量主题只在实验页适配。</el-dialog></el-card><a-card v-else-if="library==='Ant Design Vue'" class="lab-panel" :title="capability"><a-table :data-source="rows" :columns="antColumns" :pagination="false"/><a-form layout="inline"><a-form-item label="设备名称"><a-input :value="rows[0].name"/></a-form-item></a-form><a-button @click="open=true">打开弹窗</a-button><a-modal v-model:open="open" title="Ant Design Vue 弹窗">企业组件与主题 token 示例。</a-modal></a-card><v-card v-else class="lab-panel"><h2>{{capability}}</h2><v-data-table :headers="vuetifyHeaders" :items="rows"/><v-text-field label="设备名称" :model-value="rows[0].name"/><v-btn @click="open=true">打开弹窗</v-btn><v-dialog v-model="open"><v-card class="lab-panel">Vuetify Material 主题与导航示例。<v-btn @click="open=false">关闭</v-btn></v-card></v-dialog></v-card><charts-lab/></main>`,
});
