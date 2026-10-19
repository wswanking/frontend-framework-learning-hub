<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, RouterLink, RouterView } from 'vue-router';
import './dashboard.css';
import './shell.css';
const items = [["dashboard", "数据大盘"], ["geography", "全球节点"], ["products", "产品与物模型"], ["devices", "设备中心"], ["rules", "规则引擎"], ["firmware", "固件与 OTA"], ["tenants", "租户管理"], ["labs", "实验室"], ["delivery", "交付看板"]];
const route = useRoute(), open = ref(false), menu = ref<HTMLButtonElement>();
function close() { open.value = false; menu.value?.focus(); }
watch(() => route.fullPath, () => { if (open.value) close(); });
</script>
<template>
  <div class="app-shell" data-testid="app-shell">
    <header class="shell-topbar">
      <button ref="menu" class="shell-menu" aria-controls="primary-navigation" :aria-expanded="open" @click="open = !open">导航菜单</button>
      <strong>IoT Atlas</strong><span>Vue · 独立应用</span>
    </header>
    <aside id="primary-navigation" class="atlas-sidebar" :class="{ 'is-open': open }" aria-label="主导航" @keydown.esc="close">
      <nav>
        <RouterLink v-for="[path, name] in items" :key="path" :to="'/' + path" active-class="active">{{ name }}</RouterLink>
      </nav>
      <RouterLink class="diagnostic-link" to="/">诊断页</RouterLink>
    </aside>
    <div class="shell-content"><RouterView /></div>
  </div>
</template>
