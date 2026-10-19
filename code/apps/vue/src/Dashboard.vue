<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElButton, ElCard, ElOption, ElSelect } from 'element-plus';
import DashboardChart from './DashboardChart.vue';
import { getSummary, type Context, type DashboardData, type DashboardQuery, type Role, type Scenario } from './dashboard';
import './dashboard.css';

type Range = '24h' | '7d' | '30d' | 'custom';
type Draft = { tenantId: string; region: string; range: Range; from: string; to: string };
type ThemeChoice = 'light' | 'dark' | 'system';
const DAY = 86_400_000;
const tenantNames: Record<string, string> = { all: '全部租户', ten_202609_001: '华东智联', ten_202609_002: '全球能源' };
const continentNames: Record<string, string> = { AS: '亚洲', EU: '欧洲', NA: '北美洲', SA: '南美洲', AF: '非洲', OC: '大洋洲' };
const countryNames: Record<string, string> = { CN: '中国', DE: '德国', US: '美国', BR: '巴西', ZA: '南非', AU: '澳大利亚', JP: '日本', FR: '法国', CA: '加拿大', AR: '阿根廷', EG: '埃及', NZ: '新西兰' };
const countryContinent: Record<string, string> = { CN: 'AS', JP: 'AS', DE: 'EU', FR: 'EU', US: 'NA', CA: 'NA', BR: 'SA', AR: 'SA', ZA: 'AF', EG: 'AF', AU: 'OC', NZ: 'OC' };
function geographyUrl(query: DashboardQuery, continent?: string, country?: string, node?: string) { const params = new URLSearchParams({ tenant: query.tenantId, from: query.from, to: query.to }); if (continent) params.set('continent', continent); if (country) params.set('country', country); if (node) params.set('node', node); return `/geography?${params}`; }
const deviceUrl = (id: string) => `/devices?device=${encodeURIComponent(id)}`;
const number = (value: number) => new Intl.NumberFormat('zh-CN').format(value);
const percent = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
const eventLabels = { info: '● 遥测', minor: '⚠ 一般告警', major: '⚠ 重要告警', critical: '⛔ 紧急告警' };
const defaultDraft = (): Draft => ({ tenantId: localStorage.getItem('iot-atlas-current-tenant-v1') || 'all', region: '', range: '24h', from: '', to: '' });
const localInput = (iso: string) => { const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
function queryFromDraft(value: Draft): DashboardQuery {
  const to = value.range === 'custom' ? new Date(value.to) : new Date();
  const from = value.range === 'custom' ? new Date(value.from) : new Date(to.getTime() - ({ '24h': DAY, '7d': 7 * DAY, '30d': 30 * DAY }[value.range]));
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to || to.getTime() > Date.now() + 1000 || to.getTime() - from.getTime() > 30 * DAY) throw new Error('请选择有效且不晚于当前时间的 30 天内范围');
  return { tenantId: value.tenantId, region: value.region || undefined, from: from.toISOString(), to: to.toISOString(), seed: 42 };
}
function initialQuery(): DashboardQuery {
  const params = new URLSearchParams(location.search);
  const tenantId = params.get('tenant'), from = params.get('from'), to = params.get('to');
  if (tenantId && from && to && Number.isFinite(Date.parse(from)) && Number.isFinite(Date.parse(to))) return { tenantId, from, to, region: params.get('region') || undefined, seed: 42 };
  return queryFromDraft({ ...defaultDraft(), tenantId: tenantId || defaultDraft().tenantId });
}
const router = useRouter();
const applied = ref<DashboardQuery>(initialQuery());
const draft = reactive<Draft>({ tenantId: applied.value.tenantId, region: applied.value.region || '', range: new URLSearchParams(location.search).has('from') ? 'custom' : '24h', from: localInput(applied.value.from), to: localInput(applied.value.to) });
const role = ref<Role>('platformAdmin');
const scenario = ref<Scenario>('normal');
const data = ref<DashboardData | null>(null);
const error = ref('');
const retryable = ref(false);
const filterError = ref('');
const loading = ref(true);
const refreshedAt = ref<string | null>(null);
const filterOpen = ref(false);
const stale = ref(false);
const retryKey = ref(0);
const paused = ref(false);
const pendingCount = ref(0);
const showAllEvents = ref(false);
const pendingData = ref<DashboardData | null>(null);
const eventList = ref<HTMLUListElement | null>(null);
const country = ref<string | null>(new URLSearchParams(location.search).get('country'));
const node = ref<string | null>(new URLSearchParams(location.search).get('node'));
const themeChoice = ref<ThemeChoice>((localStorage.getItem('iot-atlas-theme') as ThemeChoice) || 'dark');
const media = matchMedia('(prefers-color-scheme: dark)');
const systemDark = ref(media.matches);
const updateSystem = () => { systemDark.value = media.matches; };
media.addEventListener('change', updateSystem);
onBeforeUnmount(() => media.removeEventListener('change', updateSystem));
const dark = computed(() => themeChoice.value === 'dark' || (themeChoice.value === 'system' && systemDark.value));
watch([themeChoice, dark], () => { document.documentElement.dataset.theme = dark.value ? 'dark' : 'light'; localStorage.setItem('iot-atlas-theme', themeChoice.value); }, { immediate: true });
let request = 0;
watch([applied, role, scenario, retryKey], async () => {
  const current = ++request;
  loading.value = true; error.value = '';
  const context: Context = { actorId: 'usr_202609_001', role: role.value, tenantId: role.value === 'platformAdmin' ? 'all' : 'ten_202609_001', seed: 42, scenario: scenario.value };
  const result = await getSummary(context, applied.value);
  if (current !== request) return;
  if ('error' in result) { error.value = result.error.message; retryable.value = result.error.retryable === true; if (result.error.code === 'FORBIDDEN') { clearPause(); data.value = null; stale.value = false; country.value = null; node.value = null; drawerTrigger = null; focusedDrawer = null; void router.push(urlFor(applied.value)); } else stale.value = true; }
  else { if (paused.value && data.value) { pendingData.value = result.data; const seen = new Set(data.value.events.map(item => item.id)); pendingCount.value = result.data.events.filter(item => !seen.has(item.id)).length; data.value = { ...result.data, events: data.value.events }; } else data.value = result.data; refreshedAt.value = new Date().toISOString(); stale.value = false; retryable.value = false; }
  loading.value = false;
}, { immediate: true });
const refresh = () => { retryKey.value++; };
const onStorage = (event: StorageEvent) => { if (['iot-atlas-device-messages-v1', 'iot-atlas-device-alarm-acks-v1', 'iot-atlas-ota-v1', 'iot-atlas-devices-v1', 'iot-atlas-rule-logs-v1'].includes(event.key ?? '')) refresh(); };
window.addEventListener('storage', onStorage);
window.addEventListener('iot-atlas-mock-changed', refresh);
onBeforeUnmount(() => { window.removeEventListener('storage', onStorage); window.removeEventListener('iot-atlas-mock-changed', refresh); });
function clearPause() { paused.value = false; pendingData.value = null; pendingCount.value = 0; }
watch(role, () => { clearPause(); data.value = null; country.value = null; node.value = null; drawerTrigger = null; focusedDrawer = null; void router.push(urlFor(applied.value)); }, { flush: 'sync' });
watch(scenario, value => { if (value === 'forbidden') { clearPause(); data.value = null; country.value = null; node.value = null; drawerTrigger = null; focusedDrawer = null; void router.push(urlFor(applied.value)); } }, { flush: 'sync' });
function pauseEvents() { paused.value = true; }
function onEventScroll(event: Event) { if ((event.target as HTMLUListElement).scrollTop > 16 && !paused.value) pauseEvents(); }
function resumeEvents() { paused.value = false; if (pendingData.value) { data.value = pendingData.value; pendingData.value = null; } pendingCount.value = 0; if (eventList.value) eventList.value.scrollTop = 0; }
const selected = computed(() => data.value?.countries.find(item => item.id === country.value));
const selectedNode = computed(() => data.value?.nodes.find(item => item.id === node.value));
function urlFor(query: DashboardQuery, selectedCountry?: string, selectedNode?: string) {
  const params = new URLSearchParams({ tenant: query.tenantId, from: query.from, to: query.to });
  if (query.region) params.set('region', query.region);
  if (selectedCountry) params.set('country', selectedCountry);
  if (selectedNode) params.set('node', selectedNode);
  return `/dashboard?${params}`;
}
let drawerTrigger: HTMLElement | null = null;
let focusedDrawer: string | null = null;
function rememberDrawerTrigger() { const active = document.activeElement; if (active instanceof HTMLElement && !active.closest('.country-drawer')) drawerTrigger = active; }
function restoreDrawerTrigger() { const trigger = drawerTrigger; requestAnimationFrame(() => trigger?.focus()); }
watch([country, node, data], async () => {
  const id = node.value ?? country.value;
  if (!id) { focusedDrawer = null; return; }
  await nextTick();
  if (id !== focusedDrawer) { const drawer = document.querySelector<HTMLElement>('.country-drawer'); if (drawer) { drawer.focus(); focusedDrawer = id; } }
});
const onDrawerEscape = (event: KeyboardEvent) => { if (event.key !== 'Escape' || (!country.value && !node.value)) return; event.preventDefault(); country.value = null; node.value = null; void router.push(urlFor(applied.value)); restoreDrawerTrigger(); };
window.addEventListener('keydown', onDrawerEscape);
onBeforeUnmount(() => window.removeEventListener('keydown', onDrawerEscape));
function openCountry(code: string) { rememberDrawerTrigger(); node.value = null; country.value = code; void router.push(urlFor(applied.value, code)); }
function closeCountry() { country.value = null; void router.push(urlFor(applied.value)); restoreDrawerTrigger(); }
function openNode(id: string) { rememberDrawerTrigger(); country.value = null; node.value = id; void router.push(urlFor(applied.value, undefined, id)); }
function closeNode() { node.value = null; void router.push(urlFor(applied.value)); restoreDrawerTrigger(); }
function openContinent(id: string) { const next = { ...applied.value, region: id }; clearPause(); country.value = null; node.value = null; draft.region = id; applied.value = next; void router.push(urlFor(next)); }
function apply() {
  try { const next = queryFromDraft(draft); clearPause(); if (next.tenantId !== applied.value.tenantId) data.value = null; filterError.value = ''; error.value = ''; country.value = null; node.value = null; applied.value = next; void router.push(urlFor(next)); filterOpen.value = false; }
  catch (cause) { filterError.value = (cause as Error).message; requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[aria-label="${!Number.isFinite(Date.parse(draft.from)) ? '开始时间' : '结束时间'}"]`)?.focus()); }
}
function reset() {
  Object.assign(draft, defaultDraft());
  filterError.value = '';
  if (role.value !== 'platformAdmin') draft.tenantId = 'ten_202609_001';
  const next = queryFromDraft(draft); clearPause(); if (next.tenantId !== applied.value.tenantId) data.value = null; country.value = null; node.value = null; applied.value = next; void router.push(urlFor(next)); filterOpen.value = false;
}
const metrics = computed(() => data.value ? [
  ['接入设备', number(data.value.metrics.devices), '台', number(data.value.comparison.devices)], ['在线率', percent(data.value.metrics.onlineRate), `${number(data.value.metrics.onlineDevices)} 台在线`, percent(data.value.comparison.onlineRate)],
  ['消息量', number(data.value.metrics.messages), '条', number(data.value.comparison.messages)], ['活跃告警', number(data.value.metrics.activeAlarms), '条', number(data.value.comparison.activeAlarms)], ['OTA 成功率', percent(data.value.metrics.otaSuccessRate), '已完成执行', percent(data.value.comparison.otaSuccessRate)],
] : []);
</script>
<template>
  <div class="atlas-dashboard">

    <div class="atlas-workspace"><header class="atlas-header"><div><small>IoT Atlas / 数据大盘</small><h1>全球设备运行态势</h1><p>同一查询联动指标、地理分布、消息趋势与事件。</p><p>最后更新时间：{{ refreshedAt && data ? new Date(refreshedAt).toLocaleString('zh-CN') : '—' }}</p></div><div class="header-actions"><ElButton size="small" :disabled="loading" @click="refresh">刷新</ElButton><label>主题<select v-model="themeChoice" aria-label="主题"><option value="dark">暗色</option><option value="light">亮色</option><option value="system">跟随系统</option></select></label><label>演示身份<select v-model="role" aria-label="演示身份"><option value="platformAdmin">平台管理员</option><option value="tenantAdmin">租户管理员</option><option value="operator">运维工程师</option><option value="viewer">数据观察员</option></select></label></div></header>
      <ElCard class="filter-panel" aria-label="大盘筛选" :data-open="filterOpen"><button type="button" class="filter-toggle" :aria-expanded="filterOpen" aria-controls="dashboard-filter-body" @click="filterOpen = !filterOpen">筛选条件（{{ filterOpen ? '收起' : '展开' }}）</button><div id="dashboard-filter-body" class="filter-body"><div class="filter-grid"><ElSelect v-model="draft.tenantId" aria-label="租户" placeholder="租户"><ElOption v-for="(name, id) in tenantNames" :key="id" :label="name" :value="id" /></ElSelect><ElSelect v-model="draft.range" aria-label="时间范围" placeholder="时间范围"><ElOption label="24 小时" value="24h" /><ElOption label="7 天" value="7d" /><ElOption label="30 天" value="30d" /><ElOption label="自定义" value="custom" /></ElSelect><ElSelect v-model="draft.region" aria-label="地域" placeholder="地域"><ElOption label="全球" value="" /><ElOption v-for="(name, id) in continentNames" :key="id" :label="name" :value="id" /></ElSelect><div class="filter-actions"><ElButton type="primary" :disabled="loading" @click="apply">应用</ElButton><ElButton @click="reset">重置</ElButton></div></div><div v-if="draft.range === 'custom'" class="custom-range"><label>开始时间<input v-model="draft.from" aria-label="开始时间" type="datetime-local" :aria-invalid="!!filterError && !Number.isFinite(Date.parse(draft.from))" :aria-describedby="filterError ? 'dashboard-range-error' : undefined"></label><label>结束时间<input v-model="draft.to" aria-label="结束时间" type="datetime-local" :aria-invalid="!!filterError && Number.isFinite(Date.parse(draft.from))" :aria-describedby="filterError ? 'dashboard-range-error' : undefined"></label><p v-if="filterError" id="dashboard-range-error" role="alert">{{ filterError }}</p></div><details class="scenario-control"><summary>演示状态</summary><label>Mock 场景<select v-model="scenario" aria-label="Mock 场景"><option value="normal">正常</option><option value="slow">缓慢</option><option value="partialFailure">地图局部失败</option><option value="offline">服务离线</option><option value="forbidden">无权限</option></select></label></details></div></ElCard>
      <div class="dashboard-feedback" aria-live="polite"><span v-if="loading" role="status">数据加载中…</span><span v-if="error" role="alert">{{ error }}{{ stale && data ? '；当前显示上次成功的数据（非最新）' : '' }} <ElButton v-if="retryable" size="small" @click="retryKey++">重试</ElButton></span><span v-if="data?.unavailable.includes('geography') && !error" role="alert">地图分区暂不可用，其他区域已更新。</span></div>
      <template v-if="data"><section class="metric-grid" aria-label="关键指标"><ElCard v-for="[label, value, hint, previous] in metrics" :key="label" class="metric-card"><span>{{ label }}</span><strong>{{ value }}</strong><small>{{ hint }}</small><small>上期 {{ previous }}</small><small>统计截至 {{ new Date(data.updatedAt).toLocaleString('zh-CN') }}</small></ElCard></section>
        <div class="dashboard-analysis"><ElCard class="map-panel"><h2>全球节点地图</h2><p v-if="data.unavailable.includes('geography')" role="status">地理分区暂不可用。</p><p v-else-if="data.metrics.devices === 0">当前筛选范围无设备。</p><DashboardChart v-else kind="world" :data="data" @country="openCountry" /></ElCard><ElCard class="region-panel"><h2>区域概览</h2><p v-if="data.unavailable.includes('geography')">区域数据暂不可用。</p><template v-else><ul class="region-list"><li v-for="item in data.continents" :key="item.id"><button @click="openContinent(item.id)">{{ (continentNames[item.id] ?? item.id) }}</button><strong>{{ number(item.devices) }}</strong><small>{{ number(item.messages) }} 条消息</small><RouterLink :to="geographyUrl(applied, item.id)">查看地理详情</RouterLink></li></ul><h3>国家排行</h3><ul class="country-list"><li v-for="item in data.countries" :key="item.id"><button @click="openCountry(item.id)">{{ (countryNames[item.id] ?? item.id) }} <strong>{{ number(item.devices) }} 台</strong></button></li></ul></template></ElCard></div>
        <div class="dashboard-bottom"><ElCard><h2>消息吞吐趋势</h2><DashboardChart kind="trend" :data="data" /><details><summary>查看趋势数据</summary><table><thead><tr><th>时间 UTC</th><th>消息量</th></tr></thead><tbody><tr v-for="item in data.trend" :key="item.timestamp"><td>{{ item.timestamp }}</td><td>{{ number(item.messages) }}</td></tr></tbody></table></details></ElCard><ElCard><h2>告警分布</h2><DashboardChart kind="alarm" :data="data" /><ul class="alarm-legend"><li v-for="item in data.alarmDistribution" :key="item.severity">{{ { critical: '紧急', major: '重要', minor: '一般' }[item.severity] }}：{{ number(item.count) }}</li></ul></ElCard><ElCard><div class="event-head"><h2>实时事件</h2><ElButton size="small" :aria-expanded="showAllEvents" @click="showAllEvents = !showAllEvents">{{ showAllEvents ? '收起事件' : '查看全部' }}</ElButton><ElButton size="small" @click="paused ? resumeEvents() : pauseEvents()">{{ paused ? '恢复事件' : '暂停事件' }}</ElButton></div><button v-if="paused && pendingCount > 0" class="event-pending" @click="resumeEvents">有 {{ pendingCount }} 条新事件，点击回到顶部</button><ul ref="eventList" class="event-list" :class="{ 'event-list-all': showAllEvents }" tabindex="0" aria-label="实时事件列表" @scroll="onEventScroll"><li v-for="event in data.events" :key="event.id" :data-severity="event.severity"><span>{{ eventLabels[event.severity] }}</span><strong>{{ event.resourceId }}</strong><time :datetime="event.occurredAt">{{ new Date(event.occurredAt).toLocaleString('zh-CN') }}</time></li></ul><p v-if="data.events.length === 0">当前范围没有事件。</p></ElCard></div>
      </template><ElCard v-else-if="!loading && !error" class="empty-panel"><p>暂无可展示的大盘数据。请调整筛选或重试。</p></ElCard>
    </div><aside v-if="country && selected" class="country-drawer" role="dialog" aria-modal="false" tabindex="-1" :aria-label="`${(countryNames[country] ?? country)}节点详情`"><div class="drawer-head"><h2>{{ (countryNames[country] ?? country) }} · 节点详情</h2><button aria-label="关闭详情" @click="closeCountry">×</button></div><p>当前筛选：{{ tenantNames[applied.tenantId] }} · {{ new Date(applied.from).toLocaleDateString('zh-CN') }} 至 {{ new Date(applied.to).toLocaleDateString('zh-CN') }}</p><dl><div><dt>设备数</dt><dd>{{ number(selected.devices) }}</dd></div><div><dt>消息量</dt><dd>{{ number(selected.messages) }}</dd></div></dl><RouterLink :to="geographyUrl(applied, countryContinent[country], country)">在地理页查看国家</RouterLink><h3>节点列表</h3><ul><li v-for="item in data?.nodes.filter(item => item.countryCode === country)" :key="item.id"><button @click="openNode(item.id)">{{ item.id }} · {{ number(item.devices) }} 台</button></li></ul></aside><aside v-if="node && selectedNode" class="country-drawer" role="dialog" aria-modal="false" tabindex="-1" :aria-label="`${node}节点详情`"><div class="drawer-head"><h2>{{ node }} · 节点详情</h2><button aria-label="关闭节点详情" @click="closeNode">×</button></div><p>当前筛选：{{ tenantNames[applied.tenantId] }} · {{ new Date(applied.from).toLocaleDateString('zh-CN') }} 至 {{ new Date(applied.to).toLocaleDateString('zh-CN') }}</p><dl><div><dt>设备数</dt><dd>{{ number(selectedNode.devices) }}</dd></div><div><dt>消息量</dt><dd>{{ number(selectedNode.messages) }}</dd></div><div><dt>城市级演示坐标</dt><dd>{{ selectedNode.coordinates?.join(', ') ?? '未定位' }}</dd></div></dl><h3>节点设备</h3><ul class="dashboard-node-device-list"><li v-for="deviceId in selectedNode.deviceIds" :key="deviceId"><RouterLink :to="deviceUrl(deviceId)">{{ deviceId }} · 查看设备详情</RouterLink></li></ul><RouterLink :to="geographyUrl(applied, countryContinent[selectedNode.countryCode], selectedNode.countryCode, node)">在地理页查看节点</RouterLink><ElButton @click="openCountry(selectedNode.countryCode)">返回国家节点</ElButton></aside>
  </div>
</template>
