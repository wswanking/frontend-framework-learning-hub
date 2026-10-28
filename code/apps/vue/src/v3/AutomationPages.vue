<script setup lang="ts">
import { RouterLink } from "vue-router";
import { state } from "./store";
import type { Operation } from "./useOperations";
import Panel from "./Panel.vue";
import DataTable from "./DataTable.vue";
import Metrics from "./Metrics.vue";
import StatusTag from "./StatusTag.vue";
defineProps<{ page: string }>();
const emit = defineEmits<{ action: [action: Operation, id?: string] }>();
</script>
<template>
  <template v-if="page === 'products'"
    ><Panel title="产品目录"
      ><DataTable
        :headers="['产品 / ID', '接入协议', '物模型属性', '设备数', '操作']"
        ><tr v-for="p in state.products" :key="p.id">
          <td>
            {{ p.name }}<small class="mono">{{ p.id }}</small>
          </td>
          <td>{{ p.protocol }}</td>
          <td>{{ p.fields.length }}</td>
          <td>
            {{ state.devices.filter((d) => d.product === p.name).length }}
          </td>
          <td>
            <button
              class="small"
              @click="emit('action', 'product-detail', p.id)"
            >
              查看物模型
            </button>
          </td>
        </tr></DataTable
      ></Panel
    >
    <div class="note">
      支持属性规格查看与新增；物模型版本发布、DP 映射、导入导出为进阶范围。
    </div></template
  >
  <template v-else-if="page === 'rules'"
    ><Panel title="阈值规则"
      ><DataTable :headers="['规则 / ID', '触发条件', '状态', '操作']"
        ><tr v-for="r in state.rules" :key="r.id">
          <td>
            {{ r.name }}<small class="mono">{{ r.id }}</small>
          </td>
          <td>温度 &gt; {{ r.threshold }} °C</td>
          <td><StatusTag :text="r.enabled ? '已启用' : '已停用'" /></td>
          <td>
            <div class="actions">
              <button class="small" @click="emit('action', 'test', r.id)">
                模拟输入</button
              ><button class="small" @click="emit('action', 'toggle', r.id)">
                {{ r.enabled ? "停用" : "启用" }}
              </button>
            </div>
          </td>
        </tr></DataTable
      ></Panel
    ><Panel title="场景联动 · 进阶范围"
      ><div class="panel-body">
        <div class="pill-line">
          <StatusTag text="01 · 设备上报" /> →
          <StatusTag text="02 · 温度阈值" /> →
          <StatusTag text="03 · 创建告警" /> →
          <StatusTag text="04 · 人工处置" />
        </div>
        <p class="muted">
          本轮实现固定流程。多条件编排、抑制窗口、定时调度与自动控制未实现。
        </p>
      </div></Panel
    ></template
  >
  <template v-else-if="page === 'alarms'"
    ><Metrics
      :items="[
        [
          '待确认',
          state.alarms.filter((a) => a.status === '待确认').length,
          '需要分派负责人',
        ],
        [
          '处理中',
          state.alarms.filter((a) => a.status === '已确认').length,
          '跟进现场问题',
        ],
        [
          '已解决',
          state.alarms.filter((a) => a.status === '已解决').length,
          '保留完整时间线',
        ],
        ['处置策略', '人工', '自动关闭待后续设计'],
      ]"
    /><Panel title="告警事件"
      ><DataTable :headers="['告警 / 事件', '设备', '状态', '负责人', '操作']"
        ><tr v-for="a in state.alarms" :key="a.id">
          <td>
            {{ a.name }}<small class="mono">{{ a.id }}</small>
          </td>
          <td>
            <RouterLink :to="'/v3/devices/' + a.device">{{
              a.device
            }}</RouterLink>
          </td>
          <td><StatusTag :text="a.status" /></td>
          <td>{{ a.owner }}</td>
          <td>
            <button class="small" @click="emit('action', 'alarm-detail', a.id)">
              查看与处理
            </button>
          </td>
        </tr></DataTable
      ></Panel
    >
    <div class="note">
      没有新的告警？前往
      <RouterLink to="/v3/rules">规则与场景</RouterLink
      >，模拟一次超过阈值的温度输入。
    </div></template
  >
  <template v-else-if="page === 'ota'"
    ><Panel title="升级批次"
      ><DataTable
        v-if="state.batches.length"
        :headers="['批次 / 固件', '状态', '完成 / 目标', '失败', '操作']"
        ><tr v-for="b in state.batches" :key="b.id">
          <td>
            {{ b.name }}<small>ColdSense T200 · {{ b.version }}</small>
          </td>
          <td><StatusTag :text="b.status" /></td>
          <td>
            {{ b.targets.filter((t) => t.status === "成功").length }} /
            {{ b.targets.length }}
          </td>
          <td>{{ b.targets.filter((t) => t.status === "失败").length }}</td>
          <td>
            <button class="small" @click="emit('action', 'batch-detail', b.id)">
              查看进度
            </button>
          </td>
        </tr></DataTable
      >
      <div v-else class="empty">
        <span class="empty-icon">↑</span>
        <h2>尚无升级批次</h2>
        <p>选择固件与兼容设备，先建立可追踪的发布范围。</p>
        <button class="primary" @click="emit('action', 'batch')">
          创建首个批次
        </button>
      </div></Panel
    ><Panel title="固件版本目录"
      ><DataTable :headers="['版本', '适用产品', '大小', '说明', '状态']"
        ><tr v-for="f in state.firmwares" :key="f.id">
          <td>{{ f.version }}</td>
          <td>{{ f.product }}</td>
          <td>{{ f.size }}</td>
          <td>{{ f.note }}</td>
          <td>
            <StatusTag
              :text="f.id === 'FW-231' ? '可用于模拟' : '只读规格样例'"
            />
          </td></tr></DataTable></Panel
  ></template>
</template>
