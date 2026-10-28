<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { navGroups, icons, headings } from "./navigation";
import { state, notice, dirty, identity, mayLeave } from "./store";
import { roles, type Role } from "./domain";
import Modal from "./Modal.vue";
import "./workspace.css";
const route = useRoute(),
  open = ref(false),
  mobile = ref(innerWidth <= 1050),
  menu = ref<HTMLButtonElement>(),
  nav = ref<HTMLElement>(),
  popup = ref(""),
  query = ref("");
const results = computed(() =>
  [
    ...Object.entries(headings).map(([path, [name]]) => ({
      name,
      path: "/v3/" + path,
    })),
    ...state.devices.map((d) => ({
      name: d.name + " " + d.id,
      path: "/v3/devices/" + d.id,
    })),
    ...state.rules.map((r) => ({ name: r.name, path: "/v3/rules" })),
  ]
    .filter((x) => x.name.toLowerCase().includes(query.value.toLowerCase()))
    .slice(0, 8),
);
async function close() {
  open.value = false;
  await nextTick();
  menu.value?.focus();
}
async function expand() {
  open.value = true;
  await nextTick();
  nav.value?.querySelector<HTMLElement>("button")?.focus();
}
function changeRole(e: Event) {
  const select = e.target as HTMLSelectElement;
  if (!mayLeave()) {
    select.value = state.role;
    return;
  }
  dirty.value = false;
  identity(select.value as Role);
}
function resize() {
  mobile.value = innerWidth <= 1050;
  if (!mobile.value) open.value = false;
}
function unload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = "";
  }
}
function keyboard(e: KeyboardEvent) {
  if (
    (e.ctrlKey || e.metaKey) &&
    e.key.toLowerCase() === "k" &&
    !document.querySelector(".v3 dialog[open]")
  ) {
    e.preventDefault();
    popup.value = "search";
  }
  if (e.key === "Escape" && open.value) void close();
  if (e.key === "Tab" && open.value) {
    const items = Array.from(
        nav.value?.querySelectorAll<HTMLElement>("button,a[href]") || [],
      ),
      first = items[0],
      last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
}
watch(
  () => route.fullPath,
  () => {
    popup.value = "";
    if (open.value) void close();
  },
);
onMounted(() => {
  addEventListener("resize", resize);
  addEventListener("beforeunload", unload);
  addEventListener("keydown", keyboard);
});
onBeforeUnmount(() => {
  removeEventListener("resize", resize);
  removeEventListener("beforeunload", unload);
  removeEventListener("keydown", keyboard);
});
</script>
<template>
  <div class="v3" data-testid="v3-shell">
    <a class="skip" href="#v3-main">跳到主要内容</a>
    <aside ref="nav" class="sidebar" :class="{ open }" :inert="mobile && !open">
      <div class="brand">
        <span class="brand-mark">◈</span>
        <div>IoT Atlas<small>CONNECTED OPERATIONS</small></div>
      </div>
      <button class="mobile-close" aria-label="关闭导航" @click="close">
        ×
      </button>
      <nav class="nav" aria-label="主导航">
        <template v-for="[group, items] in navGroups" :key="group"
          ><div class="nav-label">{{ group }}</div>
          <RouterLink
            v-for="[path, , label] in items"
            :key="path"
            :to="'/v3/' + path"
            :aria-current="
              !route.params.pathMatch && route.path.split('/')[2] === path
                ? 'page'
                : undefined
            "
            @click="open && close()"
            ><span class="glyph"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path :d="icons[path]" /></svg></span
            >{{ label
            }}<span v-if="path === 'alarms'" class="nav-count">{{
              state.alarms.filter((a) => a.status !== "已解决").length
            }}</span></RouterLink
          ></template
        >
      </nav>
      <div class="side-foot">
        <b>◇ Vue · V3 工作区</b>独立本地模拟 · 无真实设备<br />实施验证不代表最终验收
      </div>
    </aside>
    <button
      v-if="open"
      class="scrim"
      aria-label="收起导航"
      tabindex="-1"
      @click="close"
    />
    <header class="topbar" :inert="mobile && open">
      <button
        ref="menu"
        class="icon mobile-menu"
        aria-label="打开导航"
        :aria-expanded="open"
        @click="expand"
      >
        ☰
      </button>
      <div class="tenant">澄海智联<small>DEMO WORKSPACE / 华东</small></div>
      <button
        class="global-search"
        aria-label="全局搜索"
        @click="
          popup = 'search';
          query = '';
        "
      >
        ⌕ <span>搜索设备、规则、页面</span><kbd class="key">⌘ K</kbd>
      </button>
      <div class="top-end">
        <button
          class="icon"
          aria-label="通知中心"
          @click="popup = 'notifications'"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            aria-hidden="true"
          >
            <path d="M6 8a6 6 0 0 1 12 0v6l2 3H4l2-3Z M9 20h6" />
          </svg></button
        ><span class="avatar" aria-hidden="true">CH</span
        ><label class="sr-only" for="v3-identity">模拟身份</label
        ><select
          id="v3-identity"
          class="identity"
          :value="state.role"
          @change="changeRole"
        >
          <option v-for="(label, key) in roles" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
      </div>
    </header>
    <main id="v3-main" class="main" tabindex="-1" :inert="mobile && open">
      <RouterView />
    </main>
    <div class="toast" role="status" aria-live="polite">{{ notice }}</div>
    <Modal
      :open="!!popup"
      :title="popup === 'search' ? '搜索工作区' : '通知中心'"
      :drawer="popup === 'notifications'"
      @close="popup = ''"
      ><template v-if="popup === 'search'"
        ><label class="field"
          >搜索页面、设备或规则<input
            v-model="query"
            placeholder="输入名称或 ID，例如：冷链" /></label
        ><RouterLink
          v-for="item in results"
          :key="item.name"
          class="search-result"
          :to="item.path"
          @click="popup = ''"
          >{{ item.name }}</RouterLink
        >
        <p v-if="!results.length">没有找到匹配结果。</p></template
      ><template v-else-if="state.prefs.inapp"
        ><div class="work-item">
          <div>
            <h3>现场异常需要处理</h3>
            <p>
              {{
                state.alarms.filter((a) => a.status !== "已解决").length
              }}
              条未关闭告警
            </p>
            <RouterLink to="/v3/alarms" @click="popup = ''"
              >前往告警中心 →</RouterLink
            >
          </div>
        </div>
        <div class="work-item">
          <div>
            <h3>新固件已加入演示目录</h3>
            <p>ColdSense T200 · 2.3.1</p>
            <RouterLink to="/v3/ota" @click="popup = ''"
              >查看固件与 OTA →</RouterLink
            >
          </div>
        </div></template
      ><template v-else
        ><p>工作区通知已关闭。</p>
        <RouterLink to="/v3/settings" @click="popup = ''"
          >前往设置</RouterLink
        ></template
      ></Modal
    >
  </div>
</template>
