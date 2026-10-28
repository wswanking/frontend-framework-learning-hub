<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { state, notify } from "./store";
import { cold, readings } from "./domain";
import type { Operation } from "./useOperations";
import Panel from "./Panel.vue";
import DataTable from "./DataTable.vue";
import StatusTag from "./StatusTag.vue";
import TrendChart from "./TrendChart.vue";
defineProps<{ page: string }>();
const emit = defineEmits<{ action: [action: Operation, id?: string] }>();
const route = useRoute(),
  router = useRouter(),
  device = ref(""),
  windowSize = ref("45");
const candidates = computed(() =>
    state.devices.filter((d) => d.product === cold),
  ),
  points = computed(() =>
    readings(
      candidates.value.find((d) => d.id === route.query.device) ||
        candidates.value[0],
      String(route.query.window || "45"),
    ),
  );
watch(
  () => route.fullPath,
  () => {
    device.value = String(route.query.device || candidates.value[0]?.id || "");
    windowSize.value = String(route.query.window || "45");
  },
  { immediate: true },
);
function csv() {
  const blob = new Blob(
    [
      "\ufeff时间,温度°C,质量\n" +
        points.value.map(([t, v]) => `${t},${v},有效`).join("\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "iot-atlas-demo-telemetry.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("当前查询结果已导出 CSV（模拟数据）。");
}
defineExpose({ csv });
</script>
<template>
  <template v-if="page === 'telemetry'"
    ><p class="muted">
      当前查询范围：ColdSense T200 温控设备。电表时序交互待设计。
    </p>
    <Panel
      ><form
        class="filters"
        @submit.prevent="
          router.push({
            path: '/v3/telemetry',
            query: { device, window: windowSize },
          })
        "
      >
        <label
          >设备<select v-model="device">
            <option v-for="d in candidates" :key="d.id" :value="d.id">
              {{ d.name }}
            </option>
          </select></label
        ><label
          >查询窗口<select v-model="windowSize">
            <option value="45">08:00—08:45</option>
            <option value="15">08:30—08:45</option>
          </select></label
        ><button class="primary">查询</button>
      </form>
      <TrendChart temperature /><DataTable
        :headers="['采样时间', '温度 °C', '质量']"
        ><tr v-for="[t, v] in points" :key="t">
          <td>{{ t }}</td>
          <td>{{ v }}</td>
          <td><StatusTag text="有效" /></td>
        </tr>
        <tr v-if="!points.length">
          <td colspan="3">没有可查询的温控设备。</td>
        </tr></DataTable
      ></Panel
    ></template
  ><template v-else-if="page === 'nodes'"
    ><div class="map-grid">
      <Panel
        v-for="[name, health, note] in [
          ['华东 · 上海', '99.98%', '5 个演示连接'],
          ['欧洲 · 法兰克福', '99.95%', '拓展节点示意'],
          ['北美 · 弗吉尼亚', '99.97%', '拓展节点示意'],
        ]"
        :key="name"
        class="map-tile"
        ><h2 class="node-title">{{ name }}</h2>
        <StatusTag text="健康" />
        <div class="metric-value">{{ health }}</div>
        <p class="muted">模拟可用率 · {{ note }}</p>
        <button class="small" @click="emit('action', 'node', name)">
          查看节点
        </button></Panel
      >
    </div>
    <div class="note">
      节点列表先行；地域筛选、调度与地图下钻未实现。
    </div></template
  ><template v-else-if="page === 'connectors'"
    ><Panel title="协议连接器"
      ><DataTable
        :headers="['连接器', '协议 / 节点', '状态', '转发目标', '操作']"
        ><tr
          v-for="[name, protocol, target, id] in [
            ['华东 MQTT 接入', 'MQTT 3.1.1 / TLS', 'HTTP 样例接收端', 'MQTT'],
            ['设备 HTTP 接入', 'HTTPS / JSON', '时序与规则', 'HTTPS'],
          ]"
          :key="name"
        >
          <td>{{ name }}</td>
          <td>{{ protocol }}</td>
          <td><StatusTag text="健康" /></td>
          <td>{{ target }}</td>
          <td>
            <button class="small" @click="emit('action', 'connector', id)">
              测试连接
            </button>
          </td>
        </tr></DataTable
      ></Panel
    ><Panel title="数据转发路径"
      ><div class="panel-body">
        <div class="pill-line">
          <StatusTag text="接入协议" /> → <StatusTag text="字段规范化" /> →
          <StatusTag text="规则与时序" /> → <StatusTag text="演示目的地" />
        </div>
        <p>目标：<code>https://receiver.example.invalid/events</code></p>
        <div class="note">
          连接测试生成固定结果并写审计，不发起外部请求。凭据、TLS
          轮换、死信队列未实现。
        </div>
      </div></Panel
    ></template
  ><template v-else-if="page === 'learning'"
    ><Panel title="三端独立实现路线"
      ><DataTable :headers="['层次', 'React', 'Vue', 'Angular']"
        ><tr
          v-for="row in [
            ['持久工作区', 'Router / Outlet', 'RouterView', 'RouterOutlet'],
            [
              '表单草稿',
              '页面 hook + blocker',
              'composable + guard',
              'Reactive Forms + guard',
            ],
            [
              '页面请求',
              '本端 request hook',
              '本端 composable',
              'RxJS / signals',
            ],
            ['主 UI 教学区', 'MUI', 'Element Plus', 'Angular Material'],
            [
              '独立验证',
              '本端 unit / Playwright',
              '本端 unit / Playwright',
              '本端 unit / Playwright',
            ],
          ]"
          :key="row[0]"
        >
          <td v-for="(cell, i) in row" :key="i">{{ cell }}</td>
        </tr></DataTable
      ></Panel
    ><Panel title="交付与源码教学"
      ><div class="panel-body">
        <div class="actions">
          <RouterLink to="/diagnostics">诊断页</RouterLink
          ><RouterLink to="/labs">组件实验室</RouterLink
          ><RouterLink to="/delivery">交付看板</RouterLink
          ><RouterLink to="/dashboard">旧版业务示例</RouterLink>
        </div>
        <ol>
          <li>Vue 使用原生 SFC、composable 和 RouterView 实现批准交互。</li>
          <li>领域命令在克隆数据上校验后提交，各端独立保存与测试。</li>
          <li>执行 typecheck、lint、unit、build 与独立浏览器回归。</li>
          <li>静态服务需 SPA 回退；部署与最终视觉验收单独确认。</li>
        </ol>
        <div class="note">
          源码教学见仓库
          docs/learning/vue.md。本地模拟与自动检查不代表生产验收。
        </div>
      </div></Panel
    ></template
  >
</template>
