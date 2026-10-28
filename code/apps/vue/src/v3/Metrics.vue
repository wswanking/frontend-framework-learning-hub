<script setup lang="ts">
defineProps<{ items: (string | number)[][] }>();
</script>
<template>
  <div class="metric-strip">
    <div v-for="row in items" :key="row[0]" class="metric">
      <div class="metric-label">{{ row[0] }}</div>
      <div class="metric-value">{{ row[1] }}</div>
      <div class="metric-meta">{{ row[2] }}</div>
    </div>
  </div>
</template>
