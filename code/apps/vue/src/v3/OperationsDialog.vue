<script setup lang="ts">
import { useOperations } from "./useOperations";
import { state } from "./store";
import { cold } from "./domain";
import { RouterLink } from "vue-router";
import Modal from "./Modal.vue";
import DataTable from "./DataTable.vue";
import StatusTag from "./StatusTag.vue";
const ops = useOperations();
const {
  kind,
  object,
  title,
  submit,
  form,
  fields,
  targets,
  error,
  product,
  alarm,
  batch,
  isForm,
} = ops;
defineExpose({ open: ops.open, clear: ops.clear });
</script>
<template>
  <Modal
    :open="!!kind"
    :title="title"
    :drawer="
      ['product-detail', 'alarm-detail', 'batch-detail', 'node'].includes(kind)
    "
    @close="ops.close"
    ><form
      v-if="isForm"
      @submit.prevent="ops.save"
      @input="ops.markDirty"
      @change="ops.markDirty"
    >
      <p v-if="kind === 'register'">
        步骤 1 / 2 · 创建设备档案。保存后进入详情，模拟上报完成接入。
      </p>
      <div v-if="kind === 'delete'" class="note warn">
        永久删除 {{ object.split(",").length }} 台模拟设备：{{
          object
        }}。不可撤销，关联历史保留 ID。
      </div>
      <p v-if="kind === 'quota'">
        当前已使用 {{ state.devices.length }} 台设备，配额不得低于用量。
      </p>
      <p v-if="kind === 'retry'">
        只重试
        {{
          batch?.targets.filter((t) => t.status === "失败").length
        }}
        台失败设备，已成功设备保持不变。
      </p>
      <p v-if="kind === 'reboot'">
        目标 {{ object }}。重启可能短暂中断连接，本地演示立即返回模拟成功回执。
      </p>
      <p v-if="kind === 'reset'">
        恢复本端 V3 固定样例；旧教学路由与其他框架数据不受影响。
      </p>
      <label v-for="f in fields" :key="f.name" class="field"
        >{{ f.label
        }}<select
          v-if="f.type === 'select'"
          v-model="form[f.name]"
          :required="f.required"
        >
          <option v-for="o in f.options" :key="o.value" :value="o.value">
            {{ o.label }}
          </option></select
        ><textarea
          v-else-if="f.type === 'textarea'"
          v-model="form[f.name]"
          :required="f.required"
          :minlength="f.min"
          :maxlength="f.max" /><input
          v-else
          v-model="form[f.name]"
          :type="f.type || 'text'"
          :required="f.required"
          :min="f.type === 'number' ? f.min : undefined"
          :max="f.type === 'number' ? f.max : undefined"
          :step="f.step"
          :maxlength="f.type !== 'number' ? f.max : undefined"
          :pattern="f.pattern"
      /></label>
      <fieldset v-if="kind === 'batch'">
        <legend>固件 2.3.1 · 兼容设备范围</legend>
        <label
          v-for="d in state.devices.filter((d) => d.product === cold)"
          :key="d.id"
          class="field"
          ><span
            ><input
              v-model="targets"
              type="checkbox"
              :value="d.id"
              :disabled="d.status !== '在线'"
            />
            {{ d.name }} · {{ d.version }} · {{ d.status }}</span
          ></label
        >
        <div class="note warn">
          只选择在线兼容设备。首次执行最后一台模拟校验超时。
        </div>
      </fieldset>
      <div v-if="kind === 'invite'" class="note">
        只保存本地邀请记录，不发送邮件。
      </div>
      <p v-if="error" class="error" role="alert" tabindex="-1">{{ error }}</p>
      <div class="modal-foot">
        <button type="button" @click="ops.close">取消</button
        ><button class="primary">{{ submit }}</button>
      </div>
    </form>
    <template v-else-if="kind === 'product-detail' && product"
      ><p>{{ product.protocol }} · 固定演示模型</p>
      <DataTable :headers="['标识符', '类型', '单位']"
        ><tr v-for="f in product.fields" :key="f.name">
          <td>{{ f.name }}</td>
          <td>{{ f.type }}</td>
          <td>{{ f.unit }}</td>
        </tr></DataTable
      ><button class="primary spaced" @click="ops.open('field', product.id)">
        新增属性
      </button></template
    >
    <template v-else-if="kind === 'alarm-detail' && alarm"
      ><StatusTag :text="alarm.status" /> {{ alarm.id }}
      <p>{{ alarm.note }}</p>
      <dl class="kv">
        <dt>设备</dt>
        <dd>
          <RouterLink :to="'/v3/devices/' + alarm.device">{{
            alarm.device
          }}</RouterLink>
        </dd>
        <dt>负责人</dt>
        <dd>{{ alarm.owner }}</dd>
      </dl>
      <h3>处置时间线</h3>
      <ul class="timeline">
        <li v-for="(event, i) in alarm.history" :key="i">{{ event }}</li>
      </ul>
      <button
        v-if="alarm.status === '待确认'"
        class="primary"
        @click="ops.open('ack', alarm.id)"
      >
        确认并分派</button
      ><button
        v-else-if="alarm.status === '已确认'"
        class="primary"
        @click="ops.open('resolve', alarm.id)"
      >
        解决告警
      </button>
      <p v-else>此事件已解决，记录保留供审计。</p></template
    >
    <template v-else-if="kind === 'batch-detail' && batch"
      ><StatusTag :text="batch.status" /> {{ batch.id }}
      <p>
        固件 {{ batch.version }} · {{ batch.targets.length }} 台 ColdSense T200
      </p>
      <strong
        >{{ batch.targets.filter((t) => t.status === "成功").length }} /
        {{ batch.targets.length }} 完成</strong
      >
      <div class="progress">
        <span
          :style="{
            width:
              (batch.targets.filter((t) => t.status === '成功').length /
                batch.targets.length) *
                100 +
              '%',
          }"
        />
      </div>
      <DataTable :headers="['设备', '结果 / 原因', '尝试']"
        ><tr v-for="t in batch.targets" :key="t.device">
          <td>{{ t.device }}</td>
          <td>
            <StatusTag :text="t.status" /><small>{{ t.reason }}</small>
          </td>
          <td>{{ t.attempts }}</td>
        </tr></DataTable
      >
      <div class="actions spaced">
        <button
          v-if="['待执行', '运行中', '重试中'].includes(batch.status)"
          class="primary"
          @click="ops.open('advance', batch.id)"
        >
          {{
            batch.status === "待执行" ? "开始模拟升级" : "推进模拟进度"
          }}</button
        ><button
          v-if="batch.status === '部分失败'"
          class="primary"
          @click="ops.open('retry', batch.id)"
        >
          仅重试失败设备
        </button>
      </div>
      <h3>执行记录</h3>
      <ul class="timeline">
        <li v-for="(event, i) in batch.history" :key="i">{{ event }}</li>
      </ul>
      <div class="note">
        进度显式推进，未连接后台任务；成功项不重复执行。
      </div></template
    >
    <template v-else-if="kind === 'node'"
      ><dl class="kv">
        <dt>节点状态</dt>
        <dd><StatusTag text="健康" /></dd>
        <dt>实例类型</dt>
        <dd>共享模拟接入节点</dd>
        <dt>可用率窗口</dt>
        <dd>固定指标，非实时监控</dd>
      </dl>
      <div class="note">真实地域路由调度未实现。</div></template
    ><template v-else-if="kind === 'connection-result'"
      ><div class="note">
        {{ object }} 模拟握手成功 · 固定延迟 42 ms，未发起真实网络请求。
      </div>
      <p>凭据未配置、未验证；转发仅为目的地示意。</p></template
    >
  </Modal>
</template>
