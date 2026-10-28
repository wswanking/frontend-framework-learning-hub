<script setup lang="ts">
import { RouterLink } from "vue-router";
import { state } from "./store";
import { cold } from "./domain";
import Panel from "./Panel.vue";
import Metrics from "./Metrics.vue";
import DataTable from "./DataTable.vue";
import StatusTag from "./StatusTag.vue";
import TrendChart from "./TrendChart.vue";
</script>
<template>
  <Metrics
    :items="[
      [
        '设备总数',
        state.devices.length,
        state.devices.filter((d) => d.status === '在线').length +
          ' 台在线 · ' +
          state.devices.filter((d) => d.status !== '在线').length +
          ' 台待处理',
      ],
      [
        '待处理告警',
        state.alarms.filter((a) => a.status !== '已解决').length,
        '需要确认或跟进的异常',
      ],
      ['接收消息', '8,420', '本窗口 · 99.86% 成功率'],
      [
        '进行中升级',
        state.batches.filter((b) => b.status !== '完成').length,
        '按批次追踪 · 可恢复失败',
      ],
    ]"
  />
  <div class="grid">
    <Panel title="消息流量"
      ><template #aside
        ><div class="legend">
          <span>● 接收消息</span><span>┄ 转发消息</span>
        </div></template
      ><TrendChart /></Panel
    ><Panel title="待办队列"
      ><div class="work-item">
        <span class="work-icon">!</span>
        <div>
          <h3>
            {{
              state.alarms.filter((a) => a.status !== "已解决").length
            }}
            条告警等待处置
          </h3>
          <p>优先检查冷链设备温度与连接状态</p>
        </div>
        <RouterLink class="end" to="/v3/alarms">处理 →</RouterLink>
      </div>
      <div class="work-item">
        <span class="work-icon blue">↑</span>
        <div>
          <h3>ColdSense 2.3.1 可发布</h3>
          <p>建议先升级少量设备，观察失败原因</p>
        </div>
        <RouterLink class="end" to="/v3/ota">查看 →</RouterLink>
      </div>
      <div class="work-item">
        <span class="work-icon green">◇</span>
        <div>
          <h3>工作区配额健康</h3>
          <p>
            {{ state.devices.length }} / {{ state.quota }} 台设备 · 无容量告警
          </p>
        </div>
        <RouterLink class="end" to="/v3/tenants">管理 →</RouterLink>
      </div></Panel
    >
  </div>
  <Panel title="重点设备"
    ><template #aside
      ><RouterLink to="/v3/devices">所有设备 →</RouterLink></template
    ><DataTable :headers="['设备 / 标识', '状态', '产品', '最新读数', '操作']"
      ><tr v-for="d in state.devices.slice(0, 4)" :key="d.id">
        <td>
          <RouterLink :to="'/v3/devices/' + d.id"
            ><strong>{{ d.name }}</strong
            ><small class="mono">{{ d.id }}</small></RouterLink
          >
        </td>
        <td><StatusTag :text="d.status" /></td>
        <td>{{ d.product }}</td>
        <td>{{ d.product === cold ? d.temp + " °C" : "2,600 W" }}</td>
        <td><RouterLink :to="'/v3/devices/' + d.id">进入详情 →</RouterLink></td>
      </tr></DataTable
    ></Panel
  >
  <div class="grid equal">
    <Panel title="连接健康"
      ><template #aside
        ><RouterLink to="/v3/connectors">连接与转发 →</RouterLink></template
      >
      <dl class="panel-body kv">
        <dt>MQTT / TLS</dt>
        <dd><StatusTag text="健康" /> 华东接入节点</dd>
        <dt>数据转发</dt>
        <dd><StatusTag text="运行中" /> HTTP 演示目标</dd>
        <dt>数据时效</dt>
        <dd>固定样例，不连接真实网络</dd>
      </dl></Panel
    ><Panel title="最近操作"
      ><template #aside
        ><RouterLink to="/v3/audit">完整审计 →</RouterLink></template
      >
      <div class="panel-body">
        <ul class="timeline">
          <li v-for="a in state.audit.slice(0, 2)" :key="a.id">
            {{ a.action
            }}<small>{{ a.time }} · {{ a.actor }} · {{ a.object }}</small>
          </li>
        </ul>
      </div></Panel
    >
  </div>
</template>
