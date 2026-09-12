import { createApp, computed, ref } from "vue";
import { createMockApi } from "../../../packages/mock-api/index.ts";
import "./style.css";

const api = createMockApi({ actorId: "usr_001", role: "tenantAdmin", tenantId: "ten_cn_001", seed: 20260829 });
const dashboard = api.getDashboard({ tenantId: "ten_cn_001", seed: 20260829, from: "2026-08-29T00:00:00.000Z", to: "2026-08-30T00:00:00.000Z" });

createApp({
  setup() {
    const dark = ref(true);
    const metrics = computed(() => dashboard.data?.metrics);
    return { dark, metrics, regions: dashboard.data?.regions ?? [] };
  },
  template: `
    <main :class="{ dark }">
      <header><span>IoT Atlas / Vue</span><button @click="dark = !dark">切换主题</button></header>
      <section><p>全球设备运行态势</p><h1>{{ metrics?.connectedDevices ?? 0 }} 台接入设备</h1></section>
      <section class="cards"><article><b>在线设备</b><strong>{{ metrics?.onlineDevices ?? 0 }}</strong></article><article><b>消息量</b><strong>{{ metrics?.messageCount ?? 0 }}</strong></article><article><b>活跃告警</b><strong>{{ metrics?.activeAlarms ?? 0 }}</strong></article></section>
      <section><h2>地域接入节点</h2><ul><li v-for="item in regions" :key="item.continent">{{ item.continent }} · {{ item.devices }} 台设备 · {{ item.messages }} 条消息</li></ul></section>
    </main>`,
}).mount("#app");
