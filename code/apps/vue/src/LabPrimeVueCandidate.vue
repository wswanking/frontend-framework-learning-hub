<script setup lang="ts">
import { computed } from 'vue';
import PrimeButton from 'primevue/button';
import PrimeColumn from 'primevue/column';
import PrimeDataTable from 'primevue/datatable';
import PrimeDialog from 'primevue/dialog';
import PrimeInputText from 'primevue/inputtext';
import PrimeMenubar from 'primevue/menubar';
import { LAB_DEVICES, labRows, type LabDevice } from './lab-data';

type Example = 'table' | 'form' | 'dialog' | 'nav';
defineProps<{ localTheme: 'dark' | 'light' }>();
const example = defineModel<Example>('example', { required: true });
const keyword = defineModel<string>('keyword', { required: true });
const status = defineModel<'all' | LabDevice['status']>('status', { required: true });
const name = defineModel<string>('name', { required: true });
const dialog = defineModel<boolean>('dialog', { required: true });
const message = defineModel<string>('message', { required: true });
const rows = computed(() => labRows(keyword.value, status.value));
const labels: Record<Example, string> = { table: '表格', form: '表单', dialog: '对话框', nav: '导航菜单' };
const menuItems = (Object.entries(labels) as [Example, string][]).map(([key, label]) => ({ label, command: () => { example.value = key; } }));
function submit() { message.value = name.value.trim() ? `本地表单示例：${name.value.trim()}` : '请输入设备名称'; }
function confirm() { dialog.value = false; message.value = '已确认本地示例操作'; }
</script>

<template>
  <div class="lab-candidate" :class="localTheme === 'dark' ? 'lab-prime-dark' : ''" data-ui-library="primevue">
    <template v-if="example === 'table'"><div class="lab-controls"><label>搜索设备<input v-model="keyword" aria-label="实验搜索设备"></label><label>设备状态<select v-model="status" aria-label="实验设备状态"><option value="all">全部</option><option value="online">在线</option><option value="offline">离线</option></select></label></div><div class="lab-table-wrap"><PrimeDataTable :value="rows" size="small" data-key="id"><PrimeColumn field="name" header="设备" /><PrimeColumn header="状态"><template #body="slotProps">{{ slotProps.data.status === 'online' ? '在线' : '离线' }}</template></PrimeColumn><PrimeColumn field="region" header="区域" /><PrimeColumn field="lastSeen" header="最后上线" /></PrimeDataTable></div><p>{{ rows.length }} / {{ LAB_DEVICES.length }} 台设备</p></template>
    <form v-else-if="example === 'form'" class="lab-form" @submit.prevent="submit"><label>设备名称<PrimeInputText v-model="name" aria-label="实验设备名称" /></label><PrimeButton type="submit" label="验证表单" /></form>
    <template v-else-if="example === 'dialog'"><p>打开对话框，确认操作只改变本页提示。</p><PrimeButton label="打开示例对话框" @click="dialog = true" /><PrimeDialog v-model:visible="dialog" modal header="确认示例操作" :style="{ width: 'min(440px, 90vw)' }"><p>这是一项本地组件实验，不会修改设备。</p><div class="lab-actions"><PrimeButton label="确认" @click="confirm" /><PrimeButton label="取消" severity="secondary" @click="dialog = false" /></div></PrimeDialog></template>
    <nav v-else aria-label="实验室示例导航"><PrimeMenubar :model="menuItems" aria-label="实验室示例菜单" /></nav>
    <p v-if="message" role="status" class="lab-success">{{ message }}</p>
  </div>
</template>
