<script setup lang="ts">
defineProps<{ title?: string }>();
</script>
<template>
  <section class="panel">
    <div v-if="title" class="panel-head">
      <h2>{{ title }}</h2>
      <slot name="aside" />
    </div>
    <slot />
  </section>
</template>
