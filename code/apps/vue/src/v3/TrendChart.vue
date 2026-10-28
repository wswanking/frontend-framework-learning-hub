<script setup lang="ts">
defineProps<{ temperature?: boolean }>();
</script>
<template>
  <div
    class="chart"
    role="img"
    :aria-label="
      temperature
        ? '温度趋势视觉示意，实际读数见采样表'
        : '消息流量视觉示意，接收8420条转发7960条'
    "
  >
    <svg viewBox="0 0 640 145" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 20H640 M0 60H640 M0 100H640 M0 140H640"
        fill="none"
        stroke="#e5ecef"
      />
      <path
        d="M0 108L24 103L49 112L75 88L98 93L124 78L148 88L174 67L198 73L224 58L248 67L274 54L298 65L324 48L348 61L374 41L398 49L424 35L448 54L474 29L498 41L524 26L548 39L574 20L598 36L624 23L640 29V140H0Z"
        fill="#e7f4ee"
      />
      <path
        d="M0 108L24 103L49 112L75 88L98 93L124 78L148 88L174 67L198 73L224 58L248 67L274 54L298 65L324 48L348 61L374 41L398 49L424 35L448 54L474 29L498 41L524 26L548 39L574 20L598 36L624 23L640 29"
        fill="none"
        stroke="#158576"
        stroke-width="2.5"
      />
      <path
        d="M0 119L60 111L120 115L180 104L240 110L300 95L360 100L420 85L480 91L540 80L600 86L640 75"
        fill="none"
        stroke="#668cbd"
        stroke-width="1.8"
        stroke-dasharray="5 4"
      />
    </svg>
    <div class="chart-axis">
      <span>08:00</span><span>08:15</span><span>08:30</span><span>08:45</span
      ><span>09:00</span>
    </div>
  </div>
  <div class="table-foot">
    <span>{{
      temperature
        ? "趋势仅为视觉示意；采样读数见时序数据"
        : "摘要：接收 8,420 条 · 转发 7,960 条 · 错误 12 条"
    }}</span
    ><span>固定演示窗口</span>
  </div>
</template>
