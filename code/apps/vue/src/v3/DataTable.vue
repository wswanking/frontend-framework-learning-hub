<script setup lang="ts">
defineProps<{ headers: string[] }>();
</script>
<template>
  <div class="table-hint">左右滑动表格查看更多字段</div>
  <div
    class="table-wrap"
    tabindex="0"
    role="region"
    aria-label="数据表，可横向滚动"
  >
    <table>
      <thead>
        <tr>
          <th v-for="(h, i) in headers" :key="i" scope="col">
            <slot :name="'header-' + i">{{ h }}</slot>
          </th>
        </tr>
      </thead>
      <tbody>
        <slot />
      </tbody>
    </table>
  </div>
</template>
