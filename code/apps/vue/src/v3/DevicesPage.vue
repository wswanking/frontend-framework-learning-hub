<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { state } from "./store";
import { cold, readings } from "./domain";
import type { Operation } from "./useOperations";
import Panel from "./Panel.vue";
import DataTable from "./DataTable.vue";
import StatusTag from "./StatusTag.vue";
import Metrics from "./Metrics.vue";
import TrendChart from "./TrendChart.vue";
const emit = defineEmits<{ action: [action: Operation, id?: string] }>();
const route = useRoute(),
  router = useRouter(),
  q = ref(""),
  status = ref(""),
  selected = ref<string[]>([]);
const d = computed(() => state.devices.find((d) => d.id === route.params.id)),
  tab = computed(() => String(route.query.tab || "overview"));
const back = computed(() =>
  String(route.query.back || "/v3/devices").startsWith("/v3/devices")
    ? String(route.query.back || "/v3/devices")
    : "/v3/devices",
);
const rows = computed(() =>
  state.devices.filter(
    (d) =>
      (!route.query.q ||
        [d.name, d.id, d.serial, d.group, d.tags]
          .join(" ")
          .toLowerCase()
          .includes(String(route.query.q).toLowerCase())) &&
      (!route.query.status || d.status === route.query.status),
  ),
);
watch(
  () => route.fullPath,
  () => {
    q.value = String(route.query.q || "");
    status.value = String(route.query.status || "");
    selected.value = [];
  },
  { immediate: true },
);
watch(
  () => route.params.id,
  async (id, previous) => {
    if (!id && previous) {
      await nextTick();
      (
        document.getElementById("device-" + previous) ||
        document.getElementById("v3-main")
      )?.focus();
    }
  },
);
watch(
  () => state.devices.map((d) => d.id),
  (ids) => {
    selected.value = selected.value.filter((id) => ids.includes(id));
  },
);
function apply() {
  router.push({
    path: "/v3/devices",
    query: {
      ...(q.value.trim() ? { q: q.value.trim() } : {}),
      ...(status.value ? { status: status.value } : {}),
    },
  });
}
function selectAll(e: Event) {
  selected.value = (e.target as HTMLInputElement).checked
    ? rows.value.map((d) => d.id)
    : [];
}
const detailPath = (id: string) => ({
  path: "/v3/devices/" + id,
  query: { back: route.fullPath },
});
</script>
<template>
  <template v-if="route.params.id"
    ><template v-if="d"
      ><div class="breadcrumb">
        <RouterLink :to="back">设备中心</RouterLink> / {{ d.id }}
      </div>
      <div class="page-head">
        <div>
          <h1>{{ d.name }}</h1>
          <p><StatusTag :text="d.status" /> {{ d.id }} · {{ d.product }}</p>
        </div>
        <div class="actions">
          <button @click="router.push(back)">返回列表</button
          ><button @click="emit('action', 'edit', d.id)">编辑资料</button
          ><button
            v-if="d.product === cold"
            class="primary"
            @click="emit('action', 'ingest', d.id)"
          >
            模拟上报
          </button>
        </div>
      </div>
      <Panel v-if="d.product !== cold" title="电表属性样例"
        ><div class="panel-body">
          <dl class="kv">
            <dt>energy / 累计电量</dt>
            <dd>{{ d.energy }} kWh</dd>
            <dt>power / 当前功率</dt>
            <dd>{{ d.power }} W</dd>
            <dt>固件</dt>
            <dd>{{ d.version }}</dd>
            <dt>分组</dt>
            <dd>{{ d.group }}</dd>
          </dl>
          <div class="note">
            电表仅展示能耗规格与元数据；不提供温控上报、时序、影子、命令或
            OTA。独立交互待设计。
          </div>
        </div></Panel
      ><template v-else
        ><div class="tabs">
          <RouterLink
            v-for="[key, label] in [
              ['overview', '运行概览'],
              ['telemetry', '时序数据'],
              ['shadow', '设备影子'],
              ['commands', '远程命令'],
              ['logs', '诊断日志'],
            ]"
            :key="key"
            :class="{ active: tab === key }"
            :to="{ path: route.path, query: { ...route.query, tab: key } }"
            >{{ label }}</RouterLink
          >
        </div>
        <div v-if="tab === 'overview'" class="grid">
          <Panel title="运行指标"
            ><Metrics
              :items="[
                ['温度', d.temp + '°', '最新模拟读数'],
                ['上报次数', d.events.length, '本地事件'],
                ['目标温度', d.desired + '°', '设备影子 desired'],
                ['连接状态', d.status, '模拟接入'],
              ]" /><TrendChart temperature /></Panel
          ><Panel title="设备档案"
            ><div class="panel-body">
              <dl class="kv">
                <dt>序列号</dt>
                <dd>{{ d.serial }}</dd>
                <dt>所属分组</dt>
                <dd>{{ d.group }}</dd>
                <dt>标签</dt>
                <dd>{{ d.tags }}</dd>
                <dt>固件版本</dt>
                <dd>{{ d.version }}</dd>
                <dt>接入身份</dt>
                <dd>DEMO-{{ d.id }}（非密钥）</dd>
              </dl>
              <div class="note">
                {{
                  d.status === "待接入"
                    ? "设备已注册，尚未上报。点击“模拟上报”完成接入。"
                    : "上报按钮会追加一个确定性读数和诊断事件。"
                }}
              </div>
            </div></Panel
          >
        </div>
        <Panel v-else-if="tab === 'telemetry'" title="最新采样"
          ><TrendChart temperature /><DataTable
            :headers="['采样时间', '温度', '数据质量']"
            ><tr v-for="[time, value] in readings(d)" :key="time">
              <td>{{ time }}</td>
              <td>{{ value }} °C</td>
              <td><StatusTag text="有效" /></td></tr></DataTable></Panel
        ><Panel v-else-if="tab === 'shadow'" title="期望与上报状态"
          ><div class="panel-body">
            <dl class="kv">
              <dt>desired.targetTemp</dt>
              <dd>{{ d.desired }} °C</dd>
              <dt>reported.targetTemp</dt>
              <dd>{{ d.reported }} °C</dd>
              <dt>差异</dt>
              <dd>
                <StatusTag
                  :text="d.desired === d.reported ? '已同步' : '待同步'"
                />
              </dd>
            </dl>
            <div class="actions spaced">
              <button @click="emit('action', 'shadow', d.id)">
                编辑目标温度</button
              ><button class="primary" @click="emit('action', 'sync', d.id)">
                模拟设备同步
              </button>
            </div>
            <p class="muted">离线设备不可同步，需要先模拟上报。</p>
          </div></Panel
        ><Panel v-else-if="tab === 'commands'" title="可执行命令"
          ><div class="panel-body">
            <h3>重启设备 / reboot</h3>
            <p>短暂中断连接，需要在线状态与控制权限。</p>
            <button class="danger" @click="emit('action', 'reboot', d.id)">
              发送重启命令
            </button>
            <div class="note">
              只演示确认与模拟成功回执。真实超时、取消与幂等契约待细化。
            </div>
          </div></Panel
        ><Panel v-else-if="tab === 'logs'" title="诊断事件"
          ><DataTable :headers="['序号', '事件', '来源']"
            ><tr v-for="(event, i) in [...d.events].reverse()" :key="i">
              <td>{{ d.events.length - i }}</td>
              <td>{{ event }}</td>
              <td>本地模拟</td>
            </tr></DataTable
          ></Panel
        ><Panel v-else
          ><div class="empty">
            <h2>未知详情页签</h2>
            <RouterLink :to="route.path">返回运行概览</RouterLink>
          </div></Panel
        ></template
      ></template
    ><Panel v-else
      ><div class="empty">
        <h1>设备不可用</h1>
        <p>该对象不存在或已删除。</p>
        <RouterLink to="/v3/devices">返回设备列表</RouterLink>
      </div></Panel
    ></template
  >
  <template v-else
    ><Panel
      ><form class="filters" @submit.prevent="apply">
        <label
          >搜索名称、ID、分组或标签<input
            v-model="q"
            placeholder="例如：冷链、DEV-1001" /></label
        ><label
          >连接状态<select v-model="status">
            <option value="">全部状态</option>
            <option>在线</option>
            <option>离线</option>
            <option>待接入</option>
          </select></label
        ><button class="primary">应用</button
        ><RouterLink class="button-link" to="/v3/devices">清除</RouterLink>
      </form>
      <div v-if="selected.length" class="bulk show">
        <strong>已选择 {{ selected.length }} 台</strong
        ><button
          class="small danger"
          @click="emit('action', 'delete', selected.join(','))"
        >
          删除所选</button
        ><span>删除不可撤销，将显示影响范围</span>
      </div>
      <DataTable
        :headers="[
          '选择',
          '设备 / 序列号',
          '状态',
          '产品',
          '分组 / 标签',
          '固件',
          '操作',
        ]"
        ><template #header-0
          ><input
            type="checkbox"
            class="checkbox"
            aria-label="选择当前结果全部设备"
            :checked="!!rows.length && selected.length === rows.length"
            :indeterminate="
              selected.length > 0 && selected.length < rows.length
            "
            @change="selectAll"
        /></template>
        <tr v-for="d in rows" :key="d.id">
          <td>
            <input
              v-model="selected"
              class="checkbox"
              type="checkbox"
              :value="d.id"
              :aria-label="'选择 ' + d.name"
            />
          </td>
          <td>
            <RouterLink :id="'device-' + d.id" :to="detailPath(d.id)"
              ><strong>{{ d.name }}</strong
              ><small class="mono">{{ d.serial }}</small></RouterLink
            >
          </td>
          <td><StatusTag :text="d.status" /></td>
          <td>{{ d.product }}</td>
          <td>
            {{ d.group }}<small>{{ d.tags }}</small>
          </td>
          <td class="mono">{{ d.version }}</td>
          <td><RouterLink :to="detailPath(d.id)">查看 →</RouterLink></td>
        </tr>
        <tr v-if="!rows.length">
          <td colspan="7">
            <div class="empty">
              <h2>没有匹配的数据</h2>
              <p>调整筛选条件，或添加第一条记录。</p>
              <RouterLink to="/v3/devices">清除筛选</RouterLink>
            </div>
          </td>
        </tr></DataTable
      >
      <div class="table-foot">
        <span
          >显示 {{ rows.length }} / {{ state.devices.length }} 台设备 ·
          演示数据全部展示</span
        ><span>筛选条件保存在地址中</span>
      </div></Panel
    >
    <div class="note">
      从设备详情可模拟接入上报、查看影子差异、执行命令与诊断。没有真实设备或密钥。
    </div></template
  >
</template>
