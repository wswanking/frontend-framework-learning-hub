<script setup lang="ts">
import { ref } from 'vue';
import { runDiagnostic, validateName, type DiagnosticResult } from './diagnostic';
const name = ref(''); const fail = ref(false); const busy = ref(false);
const result = ref<DiagnosticResult | null>(null);
async function submit() {
  if (busy.value) return;
  const invalid = validateName(name.value);
  if (invalid) { result.value = { ok: false, message: invalid }; return; }
  busy.value = true; result.value = null;
  try { result.value = await runDiagnostic(name.value, fail.value); } finally { busy.value = false; }
}
</script>
<template>
  <main class="diagnostic-page"><section aria-labelledby="title">
    <small>IoT Atlas · Vue</small><h1 id="title">诊断与验收环境</h1>
    <p>输入名称，验证校验、失败反馈与重试流程。</p>
    <form novalidate :aria-busy="busy" @submit.prevent="submit">
      <label for="name">诊断名称<input id="name" v-model="name" type="text" :disabled="busy"></label>
      <label class="check"><input v-model="fail" type="checkbox" :disabled="busy">模拟失败</label>
      <button type="submit" :disabled="busy">{{ busy ? '诊断中…' : '运行诊断' }}</button>
    </form>
    <p v-if="result" :role="result.ok ? 'status' : 'alert'">{{ result.message }}</p>
    <p><RouterLink to="/dashboard">进入数据大盘</RouterLink></p>
  </section></main>
</template>
