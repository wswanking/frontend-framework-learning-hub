<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ElButton, ElCard, ElDialog, ElInput, ElMenu, ElMenuItem, ElTable, ElTableColumn } from 'element-plus';
import { LAB_DEVICES, LAB_SEED, labRows, type LabDevice } from './lab-data';
import LabCharts from './LabCharts.vue';
import './dashboard.css';
import './labs.css';

type Example = 'table' | 'form' | 'dialog' | 'nav';
const labels: Record<Example, string> = { table: '表格', form: '表单', dialog: '对话框', nav: '导航菜单' };
const examples = Object.entries(labels) as [Example, string][];
const example = ref<Example>('table'), localTheme = ref<'dark' | 'light'>('dark');
const uiLibrary = ref<'element' | 'vuetify' | 'primevue'>('element');
const keyword = ref(''), status = ref<'all' | LabDevice['status']>('all');
const name = ref(''), dialog = ref(false), message = ref('');
const rows = computed(() => labRows(keyword.value, status.value));
const candidateUrl = computed(() => `/labs-${uiLibrary.value}.html?example=${example.value}&theme=${localTheme.value}`);
function candidateMessage(event: MessageEvent) { if (event.origin === location.origin && event.data?.type === 'lab-candidate-example' && ['table', 'form', 'dialog', 'nav'].includes(event.data.value)) example.value = event.data.value; }
onMounted(() => window.addEventListener('message', candidateMessage));
onUnmounted(() => window.removeEventListener('message', candidateMessage));
function reset() { uiLibrary.value = 'element'; example.value = 'table'; localTheme.value = 'dark'; keyword.value = ''; status.value = 'all'; name.value = ''; dialog.value = false; message.value = '实验参数已重置；业务数据未改变'; }
function selectExample(key: string) { example.value = key as Example; }
function submit() { message.value = name.value.trim() ? `本地表单示例：${name.value.trim()}` : '请输入设备名称'; }
</script>

<template>
  <div class="atlas-dashboard atlas-labs">
    <main class="atlas-workspace"><header class="atlas-header"><div><small>IoT Atlas / 框架学习</small><h1>组件与图表实验室</h1><p>Vue 三个 UI 库使用相同设备数据进行本页对比；正式选型等待 REVIEW-004。</p></div></header>
      <p class="lab-notice">实验室使用固定种子 {{ LAB_SEED }}，本页的筛选、表单、弹窗与主题只在实验室生效。</p>
      <div class="lab-flow"><div><strong>1 选择实验</strong><p>本端 Vue · 三库</p></div><div><strong>2 组件对比</strong><p>表格、表单、对话框、导航</p></div><div><strong>3 图表对比</strong><p>三库同数据示例</p></div><div><strong>4 对比报告</strong><p>测量记录可查看</p></div></div>
      <div class="lab-grid" :data-lab-theme="localTheme"><ElCard class="lab-card"><h2>选择实验</h2><div class="lab-controls"><label>框架<select aria-label="实验框架"><option>Vue</option></select></label><label>UI 组件库<select v-model="uiLibrary" aria-label="实验 UI 库" @change="dialog = false; message = ''"><option value="element">Element Plus</option><option value="vuetify">Vuetify</option><option value="primevue">PrimeVue</option></select></label><label>示例<select v-model="example" aria-label="实验示例"><option v-for="[key, value] in examples" :key="key" :value="key">{{ value }}</option></select></label><label>实验室主题<select v-model="localTheme" aria-label="实验室主题"><option value="dark">暗色</option><option value="light">亮色</option></select></label><label>数据集种子<input aria-label="数据集种子" readonly :value="LAB_SEED"></label><ElButton @click="reset">重置实验参数</ElButton></div></ElCard>
        <ElCard class="lab-card lab-element-example"><h2>组件示例 · {{ labels[example] }}</h2><p>Vue（{{ uiLibrary === 'element' ? 'Element Plus' : uiLibrary === 'vuetify' ? 'Vuetify' : 'PrimeVue' }}） · 相同的三台演示设备</p><iframe v-if="uiLibrary !== 'element'" class="lab-candidate-frame" title="UI 候选组件示例" :src="candidateUrl" /><template v-else-if="example === 'table'"><div class="lab-controls"><label>搜索设备<input v-model="keyword" aria-label="实验搜索设备"></label><label>设备状态<select v-model="status" aria-label="实验设备状态"><option value="all">全部</option><option value="online">在线</option><option value="offline">离线</option></select></label></div><div class="lab-table-wrap" tabindex="0" role="region" aria-label="实验设备表格滚动区域"><ElTable :data="rows" size="small" aria-label="实验设备表格"><ElTableColumn prop="name" label="设备" /><ElTableColumn label="状态"><template #default="scope">{{ scope.row.status === 'online' ? '在线' : '离线' }}</template></ElTableColumn><ElTableColumn prop="region" label="区域" /><ElTableColumn prop="lastSeen" label="最后上线" /></ElTable></div><p>{{ rows.length }} / {{ LAB_DEVICES.length }} 台设备</p></template>
          <form v-else-if="uiLibrary === 'element' && example === 'form'" class="lab-form" @submit.prevent="submit"><label>设备名称<ElInput v-model="name" aria-label="实验设备名称" /></label><ElButton native-type="submit" type="primary">验证表单</ElButton></form>
          <template v-else-if="uiLibrary === 'element' && example === 'dialog'"><p>打开对话框，确认操作只改变本页提示。</p><ElButton type="primary" @click="dialog = true">打开示例对话框</ElButton></template>
          <nav v-else-if="uiLibrary === 'element'" aria-label="实验室示例导航"><ElMenu mode="horizontal" :default-active="example" @select="selectExample"><ElMenuItem v-for="[key, value] in examples" :key="key" :index="key">{{ value }}</ElMenuItem></ElMenu></nav>
          <p v-if="uiLibrary === 'element' && message" role="status" class="lab-success">{{ message }}</p></ElCard>
        <ElCard class="lab-card"><h2>对比信息</h2><p><strong>实现</strong>：Element Plus 主示例使用本库表格、输入、对话框、菜单；Vuetify 与 PrimeVue 在隔离实验页使用各自控件。</p><p><strong>依赖</strong>：element-plus、vuetify、primevue；正式选型仍待 REVIEW-004。</p><p><strong>可访问性</strong>：输入项带标签；示例对话框带标题与关闭操作。</p><p><strong>体积与性能</strong>：已记录同条件的本机生产构建采样；默认页加载与后续切换的时间口径不同，请按测量说明解读。</p><p><strong>适用场景</strong>：查看主 UI 库在固定设备数据上的基本交互。</p><p><a href="/source/Labs.vue">查看 UI 实现</a> · <a href="/source/LabVuetifyCandidate.vue">查看 Vuetify 实现</a> · <a href="/source/LabPrimeVueCandidate.vue">查看 PrimeVue 实现</a> · <a href="/source/lab-vuetify-main.ts">查看 Vuetify 入口</a> · <a href="/source/lab-primevue-main.ts">查看 PrimeVue 入口</a> · <a href="/source/LabCharts.vue">查看图表界面</a> · <a href="/source/lab-chart.ts">查看渲染适配</a> · <a href="/source/lab-prd.md" >关联 PRD 快照</a> · <a href="/source/lab-metrics.html">查看性能与体积测量</a></p><RouterLink to="/dashboard">打开业务大盘核对样式隔离</RouterLink></ElCard></div>
      <LabCharts />
      <ElDialog v-if="uiLibrary === 'element'" v-model="dialog" title="实验示例对话框" width="min(440px, 90vw)" :append-to-body="true" :class="localTheme === 'dark' ? 'lab-element-dark-dialog' : 'lab-element-light-dialog'"><h2>确认示例操作</h2><p>这是一项本地组件实验，不会修改设备。</p><template #footer><ElButton type="primary" @click="dialog = false; message = '已确认本地示例操作'">确认</ElButton><ElButton @click="dialog = false">取消</ElButton></template></ElDialog>
    </main></div>
</template>
