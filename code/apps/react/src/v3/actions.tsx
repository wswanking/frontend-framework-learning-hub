import { useWorkspace, value, options } from "./context";
import { permits } from "./domain";
import type { Capability, Device } from "./types";
import { Note } from "./ui";
/** Task-specific forms create typed domain commands; no form writes the store directly. */
export function useActions() {
  const c = useWorkspace(),
    s = c.store;
  const guard = (cap: Capability) => {
    if (permits(s.role, cap)) return true;
    c.notify("无操作权限：当前身份不能执行此操作。");
    return false;
  };
  return {
    register: () => {
      if (!guard("write")) return;
      c.show({
        kind: "form",
        title: "注册新设备",
        label: "保存并进入接入",
        note: (
          <Note>
            步骤 1 / 2 · 创建档案；保存后模拟上报完成接入。不生成真实凭据。
          </Note>
        ),
        fields: [
          { name: "name", label: "设备名称", required: true, maxLength: 48 },
          {
            name: "product",
            label: "所属产品",
            type: "select",
            options: options(s.products.map((p) => p.name)),
          },
          {
            name: "serial",
            label: "设备序列号",
            required: true,
            pattern: "[A-Za-z0-9_-]{4,40}",
          },
          {
            name: "group",
            label: "所属分组",
            type: "select",
            options: options(["华东冷链", "华南仓储", "华东园区"]),
          },
        ],
        command: (f) => ({
          type: "register",
          name: value(f, "name"),
          serial: value(f, "serial"),
          product: value(f, "product"),
          group: value(f, "group"),
        }),
        after: (next) => c.go("/v3/devices/" + next.devices.at(-1)!.id),
      });
    },
    editDevice: (d: Device) => {
      if (!guard("write")) return;
      c.show({
        kind: "form",
        title: "编辑设备资料",
        fields: [
          {
            name: "name",
            label: "设备名称",
            value: d.name,
            required: true,
            maxLength: 48,
          },
          {
            name: "group",
            label: "所属分组",
            value: d.group,
            type: "select",
            options: options(["华东冷链", "华南仓储", "华东园区"]),
          },
          {
            name: "tags",
            label: "标签（逗号分隔）",
            value: d.tags,
            maxLength: 80,
          },
        ],
        command: (f) => ({
          type: "editDevice",
          id: d.id,
          name: value(f, "name"),
          group: value(f, "group"),
          tags: value(f, "tags"),
        }),
      });
    },
    shadow: (d: Device) => {
      if (!guard("operate")) return;
      c.show({
        kind: "form",
        title: "编辑目标温度",
        fields: [
          {
            name: "temp",
            label: "targetTemp °C",
            type: "number",
            value: d.desired,
            min: -20,
            max: 50,
            step: 0.5,
            required: true,
          },
        ],
        command: (f) => ({
          type: "shadow",
          id: d.id,
          temp: Number(value(f, "temp")),
        }),
      });
    },
    reboot: (d: Device) => {
      if (!guard("operate")) return;
      c.show({
        kind: "form",
        title: "确认重启设备",
        note: (
          <Note warn>
            目标：{d.name} / {d.id}。可能中断连接。本演示仅记录模拟回执。
          </Note>
        ),
        label: "确认模拟重启",
        fields: [],
        command: () => ({ type: "reboot", id: d.id }),
      });
    },
    deleteDevices: (ids: string[]) => {
      if (!guard("write")) return;
      c.show({
        kind: "form",
        title: "确认删除设备",
        note: (
          <Note warn>
            删除 {ids.length} 台：{ids.join("、")}
            。本地删除不可撤销；历史记录保留设备 ID。
          </Note>
        ),
        label: `删除 ${ids.length} 台设备`,
        fields: [
          {
            name: "confirmation",
            label: "输入 DELETE 确认",
            required: true,
            pattern: "DELETE",
          },
        ],
        command: (f) => ({
          type: "delete",
          ids,
          confirmation: value(f, "confirmation"),
        }),
      });
    },
    attribute: (id: string) => {
      if (!guard("write")) return;
      c.show({
        kind: "form",
        title: "新增物模型属性",
        label: "添加属性",
        fields: [
          {
            name: "name",
            label: "属性标识符",
            required: true,
            pattern: "[a-zA-Z][a-zA-Z0-9_]{1,30}",
          },
          {
            name: "fieldType",
            label: "类型",
            type: "select",
            options: options(["float", "integer", "boolean", "string"]),
          },
          { name: "unit", label: "单位", maxLength: 12 },
        ],
        command: (f) => ({
          type: "attribute",
          id,
          name: value(f, "name"),
          fieldType: value(f, "fieldType"),
          unit: value(f, "unit"),
        }),
        after: () => c.show({ kind: "product", id }),
      });
    },
    createRule: () => {
      if (!guard("write")) return;
      c.show({
        kind: "form",
        title: "创建温度阈值规则",
        label: "创建并启用",
        note: <Note>监测 ColdSense T200；温度大于阈值时产生待确认告警。</Note>,
        fields: [
          { name: "name", label: "规则名称", required: true, maxLength: 50 },
          {
            name: "threshold",
            label: "触发阈值 °C",
            value: 30,
            type: "number",
            min: -40,
            max: 120,
            step: 0.1,
            required: true,
          },
        ],
        command: (f) => ({
          type: "createRule",
          name: value(f, "name"),
          threshold: Number(value(f, "threshold")),
        }),
      });
    },
    testRule: (id: string) => {
      if (!guard("operate")) return;
      const r = s.rules.find((r) => r.id === id)!;
      c.show({
        kind: "form",
        title: "模拟规则输入",
        label: "运行一次",
        note: (
          <p>
            {r.name} · 温度 &gt; {r.threshold}°C
          </p>
        ),
        fields: [
          {
            name: "device",
            label: "设备",
            type: "select",
            options: s.devices
              .filter((d) => d.product === "ColdSense T200")
              .map((d) => ({ value: d.id, label: d.name })),
          },
          {
            name: "temp",
            label: "模拟温度 °C",
            value: r.threshold + 2,
            type: "number",
            min: -40,
            max: 120,
            step: 0.1,
            required: true,
          },
        ],
        command: (f) => ({
          type: "testRule",
          id,
          device: value(f, "device"),
          temp: Number(value(f, "temp")),
        }),
        after: (next) => {
          if (next.alarms.length > s.alarms.length) c.go("/v3/alarms");
          else c.notify("条件未命中，没有创建告警（本地模拟）。");
        },
      });
    },
    ack: (id: string) => {
      if (!guard("operate")) return;
      c.show({
        kind: "form",
        title: "确认并分派告警",
        label: "确认告警",
        fields: [
          {
            name: "owner",
            label: "负责人",
            type: "select",
            options: options(
              s.members.filter((m) => m.status === "已加入").map((m) => m.name),
            ),
          },
          {
            name: "note",
            label: "初步处理说明",
            type: "textarea",
            required: true,
          },
        ],
        command: (f) => ({
          type: "ack",
          id,
          owner: value(f, "owner"),
          note: value(f, "note"),
        }),
        after: () => c.show({ kind: "alarm", id }),
      });
    },
    resolve: (id: string) => {
      if (!guard("operate")) return;
      c.show({
        kind: "form",
        title: "解决告警",
        label: "确认解决",
        note: <Note warn>解决后保留事件与处置记录。</Note>,
        fields: [
          { name: "note", label: "解决原因", type: "textarea", required: true },
        ],
        command: (f) => ({ type: "resolve", id, note: value(f, "note") }),
        after: () => c.show({ kind: "alarm", id }),
      });
    },
    createBatch: () => {
      if (!guard("write")) return;
      c.show({
        kind: "form",
        title: "创建升级批次",
        label: "确认范围并创建",
        note: (
          <Note warn>
            ColdSense T200 ·
            2.3.1，仅在线兼容设备。首次执行最后一台模拟校验超时，供恢复演练。
          </Note>
        ),
        fields: [
          {
            name: "name",
            label: "批次名称",
            value: "冷链稳定性更新",
            required: true,
            maxLength: 50,
          },
          {
            name: "targets",
            label: "兼容设备 · 发布范围",
            type: "checks",
            options: s.devices
              .filter((d) => d.product === "ColdSense T200")
              .map((d) => ({
                value: d.id,
                label: `${d.name} · ${d.status}`,
                disabled: d.status !== "在线",
                checked: d.status === "在线",
              })),
          },
        ],
        command: (f) => ({
          type: "createBatch",
          name: value(f, "name"),
          targets: f.getAll("targets").map(String),
        }),
        after: (next) => c.show({ kind: "ota", id: next.batches[0].id }),
      });
    },
    retry: (id: string) => {
      if (!guard("operate")) return;
      const b = s.batches.find((b) => b.id === id)!;
      c.show({
        kind: "form",
        title: "仅重试失败设备",
        label: "确认重试",
        note: (
          <Note warn>
            仅重试{" "}
            {b.targets
              .filter((t) => t.status === "失败")
              .map((t) => t.device)
              .join("、")}
            ，成功项保持不变。
          </Note>
        ),
        fields: [
          {
            name: "reason",
            label: "重试原因",
            type: "textarea",
            required: true,
          },
        ],
        command: (f) => ({ type: "retry", id, reason: value(f, "reason") }),
        after: () => c.show({ kind: "ota", id }),
      });
    },
    invite: () => {
      if (!guard("govern")) return;
      c.show({
        kind: "form",
        title: "邀请工作区成员",
        label: "创建模拟邀请",
        note: <Note>仅保存本地记录，不发送邮件。</Note>,
        fields: [
          { name: "name", label: "姓名", required: true, maxLength: 30 },
          { name: "email", label: "演示邮箱", type: "email", required: true },
          {
            name: "role",
            label: "角色",
            type: "select",
            options: options(["运维工程师", "数据观察员", "租户管理员"]),
          },
        ],
        command: (f) => ({
          type: "invite",
          name: value(f, "name"),
          email: value(f, "email"),
          role: value(f, "role"),
        }),
      });
    },
    memberRole: (id: string) => {
      if (!guard("govern")) return;
      const m = s.members.find((m) => m.id === id)!;
      c.show({
        kind: "form",
        title: "分配成员角色",
        label: "确认角色变更",
        note: (
          <p>
            {m.name} · {m.email}
          </p>
        ),
        fields: [
          {
            name: "role",
            label: "新角色",
            value: m.role,
            type: "select",
            options: options(["租户管理员", "运维工程师", "数据观察员"]),
          },
        ],
        command: (f) => ({ type: "memberRole", id, role: value(f, "role") }),
      });
    },
    quota: () => {
      if (!guard("govern")) return;
      c.show({
        kind: "form",
        title: "调整设备配额",
        label: "保存配额",
        note: <p>当前使用 {s.devices.length} 台设备，配额不能低于用量。</p>,
        fields: [
          {
            name: "quota",
            label: "设备配额",
            value: s.quota,
            type: "number",
            min: 1,
            max: 100000,
            step: 1,
            required: true,
          },
        ],
        command: (f) => ({ type: "quota", quota: Number(value(f, "quota")) }),
      });
    },
  };
}
