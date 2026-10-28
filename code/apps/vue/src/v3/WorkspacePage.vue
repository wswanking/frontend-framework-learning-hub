<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { state, dirty, mayLeave } from "./store";
import { can } from "./domain";
import { headings } from "./navigation";
import type { Operation } from "./useOperations";
import OperationsDialog from "./OperationsDialog.vue";
import WorkspaceHome from "./WorkspaceHome.vue";
import DevicesPage from "./DevicesPage.vue";
import AutomationPages from "./AutomationPages.vue";
import GovernancePages from "./GovernancePages.vue";
import ReferencePages from "./ReferencePages.vue";
import Panel from "./Panel.vue";
const route = useRoute(),
  ops = ref<InstanceType<typeof OperationsDialog>>(),
  reference = ref<InstanceType<typeof ReferencePages>>(),
  scenario = ref("normal"),
  revision = ref(0);
const page = computed(() =>
  route.params.pathMatch
    ? "missing"
    : String(route.params.module || route.path.split("/")[2] || "workspace"),
);
const title = computed(() => headings[page.value]?.[0] || "页面不存在");
const forbidden = computed(
  () =>
    ["tenants", "access"].includes(page.value) && !can(state.role, "govern"),
);
const states: Record<string, [string, string, string]> = {
  loading: [
    "正在加载工作区",
    "壳层保持可用。模拟加载不会自行完成，请结束加载。",
    "结束模拟加载",
  ],
  empty: [
    "这里还没有数据",
    "评审空状态，不会删除已保存的模拟数据。",
    "返回正常数据",
  ],
  error: [
    "数据暂时不可用",
    "模拟请求失败 DEMO_TIMEOUT，已保存内容仍保留。",
    "重试",
  ],
  forbidden: [
    "没有查看权限",
    "当前为权限拒绝示例，不展示受限资源信息。",
    "返回可见页面",
  ],
};
watch(
  () => route.fullPath,
  () => {
    scenario.value = "normal";
  },
);
function action(a: Operation, id = "") {
  ops.value?.open(a, id);
}
function changeScenario(e: Event) {
  const select = e.target as HTMLSelectElement;
  if (!mayLeave()) {
    select.value = scenario.value;
    return;
  }
  dirty.value = false;
  ops.value?.clear();
  revision.value++;
  scenario.value = select.value;
}
</script>
<template>
  <div class="review">
    <b>VUE WORKSPACE / V3</b><span>独立框架实现 · 数据与操作均为本地模拟</span
    ><label class="state-control"
      >页面状态
      <select
        aria-label="评审页面状态"
        :value="scenario"
        @change="changeScenario"
      >
        <option value="normal">正常</option>
        <option value="loading">加载</option>
        <option value="empty">空数据</option>
        <option value="error">请求失败</option>
        <option value="forbidden">无权限</option>
      </select></label
    ><button class="small" @click="action('reset')">重置演示</button>
  </div>
  <Panel v-if="scenario !== 'normal'"
    ><div class="empty">
      <span class="empty-icon" aria-hidden="true">{{
        scenario === "error" ? "⚠" : "◇"
      }}</span>
      <h1>{{ states[scenario]?.[0] }}</h1>
      <p>{{ states[scenario]?.[1] }}</p>
      <div v-if="scenario === 'loading'" class="skeleton" />
      <button class="primary" @click="scenario = 'normal'">
        {{ states[scenario]?.[2] }}
      </button>
    </div></Panel
  ><template v-else
    ><div v-if="page === 'workspace'" class="breadcrumb">
      运行视图 / WORKSPACE
    </div>
    <div v-if="!(page === 'devices' && route.params.id)" class="page-head">
      <div>
        <h1>
          {{ page === "workspace" ? "早上好，开始今天的运行巡检" : title }}
        </h1>
        <p>
          {{
            page === "workspace"
              ? "示例工作区 · 2026 年 10 月 19 日 · 固定演示数据"
              : headings[page]?.[1]
          }}
        </p>
      </div>
      <div v-if="!forbidden" class="actions">
        <button
          v-if="['workspace', 'devices'].includes(page)"
          class="primary"
          @click="action('register')"
        >
          ＋ 注册设备</button
        ><button
          v-if="page === 'rules'"
          class="primary"
          @click="action('rule')"
        >
          ＋ 创建规则</button
        ><button v-if="page === 'ota'" class="primary" @click="action('batch')">
          ＋ 创建升级批次</button
        ><button
          v-if="page === 'tenants'"
          class="primary"
          @click="action('invite')"
        >
          ＋ 邀请成员</button
        ><button v-if="page === 'telemetry'" @click="reference?.csv()">
          导出 CSV
        </button>
      </div>
    </div>
    <Panel v-if="forbidden"
      ><div class="empty">
        <h2>没有治理权限</h2>
        <p>仅平台管理员可以管理成员、角色与配额。</p>
        <RouterLink to="/v3/workspace">返回工作区</RouterLink>
      </div></Panel
    ><WorkspaceHome v-else-if="page === 'workspace'" /><DevicesPage
      v-else-if="page === 'devices'"
      @action="action"
    /><AutomationPages
      v-else-if="['products', 'rules', 'alarms', 'ota'].includes(page)"
      :page="page"
      @action="action"
    /><GovernancePages
      v-else-if="['tenants', 'access', 'audit', 'settings'].includes(page)"
      :page="page"
      :revision="revision"
      @action="action"
    /><ReferencePages
      v-else-if="
        ['nodes', 'connectors', 'telemetry', 'learning'].includes(page)
      "
      ref="reference"
      :page="page"
      @action="action"
    /><Panel v-else
      ><div class="empty">
        <p>这个地址未包含在工作区中。</p>
        <RouterLink to="/v3/workspace">返回工作区</RouterLink>
      </div></Panel
    ></template
  >
  <footer class="page-footer">
    <span>IoT Atlas / 澄海智联 · Vue 独立 Mock</span
    ><span>已批准交互实现 · 不代表生产验收</span>
  </footer>
  <OperationsDialog ref="ops" />
</template>
