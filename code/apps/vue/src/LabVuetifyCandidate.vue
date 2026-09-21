<script setup lang="ts">
import { computed } from 'vue';
import { VApp, VBtn, VDataTable, VDialog, VTab, VTabs, VTextField, VThemeProvider } from 'vuetify/components';
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
const displayRows = computed(() => rows.value.map(row => ({ ...row, statusLabel: row.status === 'online' ? '在线' : '离线' })));
const headers = [{ title: '设备', key: 'name' }, { title: '状态', key: 'statusLabel' }, { title: '区域', key: 'region' }, { title: '最后上线', key: 'lastSeen' }];
const labels: Record<Example, string> = { table: '表格', form: '表单', dialog: '对话框', nav: '导航菜单' };
function submit() { message.value = name.value.trim() ? `本地表单示例：${name.value.trim()}` : '请输入设备名称'; }
function confirm() { dialog.value = false; message.value = '已确认本地示例操作'; }
</script>

<template>
  <VApp class="lab-candidate lab-vuetify-app" data-ui-library="vuetify">
    <VThemeProvider :theme="localTheme" with-background>
      <template v-if="example === 'table'"><div class="lab-controls"><label>搜索设备<input v-model="keyword" aria-label="实验搜索设备"></label><label>设备状态<select v-model="status" aria-label="实验设备状态"><option value="all">全部</option><option value="online">在线</option><option value="offline">离线</option></select></label></div><div class="lab-table-wrap"><VDataTable :items="displayRows" :headers="headers" :items-per-page="3" hide-default-footer density="compact" /></div><p>{{ rows.length }} / {{ LAB_DEVICES.length }} 台设备</p></template>
      <form v-else-if="example === 'form'" class="lab-form" @submit.prevent="submit"><VTextField v-model="name" label="设备名称" aria-label="实验设备名称" /><VBtn type="submit" color="primary">验证表单</VBtn></form>
      <template v-else-if="example === 'dialog'"><p>打开对话框，确认操作只改变本页提示。</p><VBtn color="primary" @click="dialog = true">打开示例对话框</VBtn><VDialog v-model="dialog" max-width="440" aria-label="实验示例对话框"><div class="lab-candidate-dialog"><h3>确认示例操作</h3><p>这是一项本地组件实验，不会修改设备。</p><div class="lab-actions"><VBtn color="primary" @click="confirm">确认</VBtn><VBtn @click="dialog = false">取消</VBtn></div></div></VDialog></template>
      <nav v-else aria-label="实验室示例导航"><VTabs :model-value="example"><VTab v-for="[key, label] in Object.entries(labels)" :key="key" :value="key" @click="example = key as Example">{{ label }}</VTab></VTabs></nav>
      <p v-if="message" role="status" class="lab-success">{{ message }}</p>
    </VThemeProvider>
  </VApp>
</template>
