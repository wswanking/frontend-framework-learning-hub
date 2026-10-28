<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ text: string }>();
const tone = computed(() =>
  /在线|完成|成功|已解决|健康|有效|已同步|已启用/.test(props.text)
    ? "ok"
    : /失败|待确认/.test(props.text)
      ? "bad"
      : /离线|待同步|已停用/.test(props.text)
        ? "warn"
        : /待接入|已邀请/.test(props.text)
          ? "pending"
          : "info",
);
</script>
<template>
  <span class="tag" :class="tone">{{ text }}</span>
</template>
