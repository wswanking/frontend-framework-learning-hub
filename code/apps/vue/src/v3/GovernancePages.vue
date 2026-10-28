<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { state, dirty, command, notify } from "./store";
import type { Operation } from "./useOperations";
import Panel from "./Panel.vue";
import DataTable from "./DataTable.vue";
import StatusTag from "./StatusTag.vue";
const props = defineProps<{ page: string; revision: number }>();
const emit = defineEmits<{ action: [action: Operation, id?: string] }>();
const route = useRoute(),
  router = useRouter(),
  q = ref(""),
  prefs = ref({ ...state.prefs });
let alive = true;
watch(
  () => [route.fullPath, state.role, props.revision],
  () => {
    q.value = String(route.query.q || "");
    prefs.value = { ...state.prefs };
    dirty.value = false;
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  alive = false;
});
function markDirty() {
  if (alive && props.page === "settings") dirty.value = true;
}
function save() {
  try {
    command("prefs", {
      inapp: String(prefs.value.inapp),
      email: String(prefs.value.email),
    });
    dirty.value = false;
  } catch (e) {
    notify((e as Error).message);
  }
}
</script>
<template>
  <template v-if="page === 'tenants'"
    ><div class="grid">
      <Panel title="工作区成员"
        ><DataTable :headers="['姓名 / 邮箱', '角色', '状态', '操作']"
          ><tr v-for="m in state.members" :key="m.id">
            <td>
              {{ m.name }}<small>{{ m.email }}</small>
            </td>
            <td>{{ m.role }}</td>
            <td><StatusTag :text="m.status" /></td>
            <td>
              <button
                class="small"
                :disabled="m.role === '平台管理员'"
                title="固定演示管理员不可降级"
                @click="emit('action', 'member', m.id)"
              >
                分配角色
              </button>
            </td>
          </tr></DataTable
        ></Panel
      ><Panel title="租户配额"
        ><div class="panel-body">
          <h3>澄海智联 / CHENGHAI-DEMO</h3>
          <p class="muted">设备额度</p>
          <strong>{{ state.devices.length }} / {{ state.quota }}</strong>
          <div class="progress">
            <span
              :style="{
                width:
                  Math.max(3, (state.devices.length / state.quota) * 100) + '%',
              }"
            />
          </div>
          <p>实际使用量不能超过已配置配额。</p>
          <button @click="emit('action', 'quota')">调整设备配额</button>
          <div class="note">
            邀请只保存本地记录，不发送邮件；权限变更不是实际 IAM 授权。
          </div>
        </div></Panel
      >
    </div></template
  ><Panel v-else-if="page === 'access'" title="现有领域权限契约"
    ><DataTable
      :headers="[
        '能力',
        '平台管理员',
        '租户管理员',
        '运维工程师',
        '数据观察员',
      ]"
      ><tr
        v-for="row in [
          ['查看设备 / 数据', '允许', '本租户', '本租户', '本租户'],
          ['产品 / 设备元数据 / 规则', '允许', '允许', '只读 / 试运行', '只读'],
          ['设备控制 / 告警处置', '允许', '允许', '允许', '禁止'],
          ['固件 / 创建 OTA', '允许', '允许', '禁止', '禁止'],
          ['重试 OTA', '允许', '允许', '允许', '禁止'],
          ['成员 / 配额修改', '允许', '禁止', '禁止', '禁止'],
        ]"
        :key="row[0]"
      >
        <td v-for="(cell, i) in row" :key="i">{{ cell }}</td>
      </tr></DataTable
    >
    <div class="panel-body">
      <div class="note">
        切换右上角“模拟身份”验证权限拒绝。前端模拟不能替代后端鉴权，自定义角色编辑尚未实现。
      </div>
    </div></Panel
  ><template v-else-if="page === 'audit'"
    ><Panel title="操作日志"
      ><form
        class="filters"
        @submit.prevent="
          router.push({ path: '/v3/audit', query: q ? { q } : {} })
        "
      >
        <label
          >搜索操作或对象<input
            v-model="q"
            placeholder="例如：注册、升级、配额" /></label
        ><button class="primary">筛选</button
        ><RouterLink to="/v3/audit">清除</RouterLink>
      </form>
      <DataTable :headers="['时间', '身份', '操作', '对象']"
        ><tr
          v-for="a in state.audit.filter((a) =>
            (a.action + ' ' + a.object).includes(String(route.query.q || '')),
          )"
          :key="a.id"
        >
          <td>{{ a.time }}</td>
          <td>{{ a.actor }}</td>
          <td>{{ a.action }}</td>
          <td>{{ a.object }}</td>
        </tr>
        <tr
          v-if="
            !state.audit.some((a) =>
              (a.action + ' ' + a.object).includes(String(route.query.q || '')),
            )
          "
        >
          <td colspan="4">没有匹配的数据。</td>
        </tr></DataTable
      ></Panel
    >
    <div class="note">
      可重置的本地操作日志，不是不可篡改审计系统；生产留存、脱敏与后端完整性待设计。
    </div></template
  >
  <div v-else-if="page === 'settings'" class="grid equal">
    <Panel title="通知偏好"
      ><form class="panel-body" @submit.prevent="save" @change="markDirty">
        <label class="field"
          ><span
            ><input v-model="prefs.inapp" type="checkbox" />
            工作区内显示通知条目</span
          ></label
        ><label class="field"
          ><span
            ><input v-model="prefs.email" type="checkbox" />
            邮件摘要偏好（仅保存意向）</span
          ></label
        >
        <p class="muted">不发送邮件，通知中心遵循站内通知开关。</p>
        <button class="primary">保存偏好</button>
      </form></Panel
    ><Panel title="集成能力边界"
      ><div class="panel-body">
        <dl class="kv">
          <dt>Webhook / 邮件</dt>
          <dd><StatusTag text="待设计" /></dd>
          <dt>身份 SSO</dt>
          <dd>本轮范围外</dd>
          <dt>真实设备</dt>
          <dd>未连接</dd>
          <dt>存储位置</dt>
          <dd>本端 localStorage</dd>
        </dl>
        <div class="note">无需真实账户、密钥或设备，只适合教学演示。</div>
      </div></Panel
    >
  </div>
</template>
