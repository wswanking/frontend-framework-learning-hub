import { seed } from "./seed";
import { roleNames } from "./types";
import type { Capability, Command, Role, Workspace } from "./types";
export { seed, roleNames };
export const storageKey = "iot-atlas-react-v3";
export function permits(role: Role, capability: Capability) {
  return (
    capability === "read" ||
    (capability === "govern" && role === "platformAdmin") ||
    (capability === "write" &&
      ["platformAdmin", "tenantAdmin"].includes(role)) ||
    (capability === "operate" && role !== "viewer")
  );
}
export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandError";
  }
}
function requireValue(value: unknown, message: string): asserts value {
  if (!value) throw new CommandError(message);
}
function text(value: string, label: string, min = 1, max = 200) {
  const result = value.trim();
  requireValue(
    result.length >= min && result.length <= max,
    `${label}长度应为 ${min}–${max} 个字符。`,
  );
  return result;
}
function number(value: number, label: string, min: number, max: number) {
  requireValue(
    Number.isFinite(value) && value >= min && value <= max,
    `${label}应介于 ${min} 和 ${max}。`,
  );
  return value;
}
const writes = new Set([
  "register",
  "editDevice",
  "delete",
  "attribute",
  "createRule",
  "toggleRule",
  "createBatch",
]);
const governance = new Set(["invite", "memberRole", "quota", "prefs"]);
/** Validate on a private clone. Failed commands never alter the caller's state or append an audit record. */
export function execute(
  previous: Workspace,
  command: Command,
  now = "10:00",
): Workspace {
  let capability: Capability = governance.has(command.type)
    ? "govern"
    : writes.has(command.type)
      ? "write"
      : "operate";
  if (
    command.type === "advance" &&
    previous.batches.find((b) => b.id === command.id)?.status !== "重试中"
  )
    capability = "write";
  requireValue(
    permits(previous.role, capability),
    "无操作权限：当前身份不能执行此操作。",
  );
  const s = structuredClone(previous),
    id = (prefix: string) => `${prefix}-${++s.next}`;
  const device = (key: string) => {
    const d = s.devices.find((d) => d.id === key);
    requireValue(d, "设备不存在。");
    return d;
  };
  const cold = (key: string) => {
    const d = device(key);
    requireValue(
      d.product === "ColdSense T200",
      "电表仅提供能耗规格，不支持温控操作。",
    );
    return d;
  };
  const online = (key: string) => {
    const d = cold(key);
    requireValue(d.status === "在线", "设备不在线，请先模拟上报。");
    return d;
  };
  const rule = (key: string) => {
    const r = s.rules.find((r) => r.id === key);
    requireValue(r, "规则不存在。");
    return r;
  };
  const alarm = (key: string) => {
    const a = s.alarms.find((a) => a.id === key);
    requireValue(a, "告警不存在。");
    return a;
  };
  const batch = (key: string) => {
    const b = s.batches.find((b) => b.id === key);
    requireValue(b, "批次不存在。");
    return b;
  };
  let action = "",
    object = "工作区";
  switch (command.type) {
    case "register": {
      requireValue(s.devices.length < s.quota, "设备配额已用尽。");
      const serial = command.serial.trim();
      requireValue(/^[A-Za-z0-9_-]{4,40}$/.test(serial), "序列号格式无效。");
      requireValue(
        !s.devices.some((d) => d.serial.toLowerCase() === serial.toLowerCase()),
        "此序列号已存在。",
      );
      requireValue(
        s.products.some((p) => p.name === command.product),
        "产品不存在。",
      );
      const key = id("DEV");
      s.devices.push({
        id: key,
        name: text(command.name, "名称", 1, 48),
        serial,
        product: command.product,
        group: text(command.group, "分组"),
        tags: "新设备",
        status: "待接入",
        version: "未安装",
        ...(command.product === "ColdSense T200"
          ? { temp: 24.6, reported: 22, desired: 22 }
          : { energy: 420.8, power: 2600 }),
        events: ["设备档案已创建，等待首次上报"],
      });
      action = "注册设备";
      object = key;
      break;
    }
    case "editDevice": {
      const d = device(command.id);
      Object.assign(d, {
        name: text(command.name, "名称", 1, 48),
        group: text(command.group, "分组"),
        tags: command.tags.trim().slice(0, 80),
      });
      action = "修改设备资料";
      object = d.id;
      break;
    }
    case "ingest": {
      const d = cold(command.id);
      d.status = "在线";
      d.temp = Number(((d.temp ?? 24.6) + 0.2).toFixed(1));
      d.events.push(`模拟上报成功 · ${d.temp}°C`);
      action = "设备模拟上报";
      object = d.id;
      break;
    }
    case "shadow": {
      const d = cold(command.id);
      d.desired = number(command.temp, "温度", -20, 50);
      action = "更新设备影子";
      object = d.id;
      break;
    }
    case "sync": {
      const d = online(command.id);
      d.reported = d.desired;
      d.events.push("设备影子已同步");
      action = "同步设备影子";
      object = d.id;
      break;
    }
    case "reboot": {
      const d = online(command.id);
      d.events.push("命令 reboot · 模拟回执 SUCCESS");
      action = "发送模拟重启";
      object = d.id;
      break;
    }
    case "delete": {
      requireValue(command.confirmation === "DELETE", "请输入 DELETE。");
      requireValue(command.ids.length > 0, "请选择设备。");
      command.ids.forEach(device);
      requireValue(
        !s.batches.some(
          (b) =>
            ["待执行", "运行中", "重试中"].includes(b.status) &&
            b.targets.some((t) => command.ids.includes(t.device)),
        ),
        "设备正在升级，不能删除。",
      );
      s.devices = s.devices.filter((d) => !command.ids.includes(d.id));
      action = "批量删除设备";
      object = command.ids.join(",");
      break;
    }
    case "attribute": {
      const p = s.products.find((p) => p.id === command.id);
      requireValue(p, "产品不存在。");
      requireValue(
        /^[A-Za-z][A-Za-z0-9_]{1,30}$/.test(command.name),
        "属性标识符无效。",
      );
      requireValue(
        !p.fields.some((f) => f.name === command.name),
        "属性标识符已存在。",
      );
      requireValue(
        ["float", "integer", "boolean", "string"].includes(command.fieldType),
        "属性类型无效。",
      );
      p.fields.push({
        name: command.name,
        type: command.fieldType,
        unit: command.unit.slice(0, 12),
      });
      action = "新增物模型属性";
      object = p.id;
      break;
    }
    case "createRule": {
      const key = id("RUL");
      s.rules.push({
        id: key,
        name: text(command.name, "规则名称", 1, 50),
        threshold: number(command.threshold, "阈值", -40, 120),
        enabled: true,
      });
      action = "创建规则";
      object = key;
      break;
    }
    case "toggleRule": {
      const r = rule(command.id);
      r.enabled = !r.enabled;
      action = r.enabled ? "启用规则" : "停用规则";
      object = r.id;
      break;
    }
    case "testRule": {
      const r = rule(command.id),
        d = cold(command.device);
      requireValue(r.enabled, "规则已停用，请先启用。");
      d.temp = number(command.temp, "温度", -40, 120);
      d.events.push(`规则试运行输入 ${d.temp}°C`);
      if (d.temp > r.threshold)
        s.alarms.unshift({
          id: id("ALM"),
          name: r.name,
          device: d.id,
          status: "待确认",
          owner: "未分配",
          note: `温度 ${d.temp}°C，高于阈值 ${r.threshold}°C`,
          history: [`${now} 规则 ${r.id} 触发告警`],
        });
      action = "规则试运行";
      object = r.id;
      break;
    }
    case "ack": {
      const a = alarm(command.id);
      requireValue(a.status === "待确认", "告警已处理，不能重复确认。");
      requireValue(
        s.members.some(
          (m) => m.name === command.owner && m.status === "已加入",
        ),
        "负责人不可用。",
      );
      a.status = "已确认";
      a.owner = command.owner;
      a.history.push(
        `${now} ${a.owner} 确认：${text(command.note, "处理说明", 3)}`,
      );
      action = "确认告警";
      object = a.id;
      break;
    }
    case "resolve": {
      const a = alarm(command.id);
      requireValue(a.status === "已确认", "请先确认告警。");
      a.status = "已解决";
      a.history.push(
        `${now} 已解决：${text(command.note, "解决原因", 5, 300)}`,
      );
      action = "解决告警";
      object = a.id;
      break;
    }
    case "createBatch": {
      requireValue(command.targets.length > 0, "至少选择一台在线兼容设备。");
      requireValue(
        new Set(command.targets).size === command.targets.length,
        "目标设备不能重复。",
      );
      command.targets.forEach(online);
      const key = id("OTA");
      s.batches.unshift({
        id: key,
        name: text(command.name, "批次名称", 1, 50),
        version: "2.3.1",
        status: "待执行",
        targets: command.targets.map((device) => ({
          device,
          status: "等待",
          attempts: 0,
          reason: "",
        })),
        history: [`创建批次，已确认 ${command.targets.length} 台设备`],
      });
      action = "创建 OTA 批次";
      object = key;
      break;
    }
    case "advance": {
      const b = batch(command.id);
      requireValue(
        ["待执行", "运行中", "重试中"].includes(b.status),
        "批次不处于可推进状态。",
      );
      const targets =
        b.status === "重试中"
          ? b.targets.filter((t) => t.status === "重试中")
          : b.targets;
      targets.forEach((t) => online(t.device));
      if (b.status === "待执行") {
        b.status = "运行中";
        b.targets.forEach((t) => {
          t.status = "下载中";
          t.attempts = 1;
        });
        b.history.push("开始模拟下载，尝试次数 +1");
      } else if (b.status === "运行中") {
        b.targets.forEach((t, i) => {
          t.status = i === b.targets.length - 1 ? "失败" : "成功";
          t.reason = t.status === "失败" ? "校验响应超时 DEMO_TIMEOUT" : "";
          if (t.status === "成功") device(t.device).version = b.version;
        });
        b.status = "部分失败";
        b.history.push("首次执行结束，1 台校验超时");
      } else {
        targets.forEach((t) => {
          t.status = "成功";
          t.reason = "";
          device(t.device).version = b.version;
        });
        b.status = "完成";
        b.history.push("失败设备重试成功；未重复执行成功设备");
      }
      action = "推进 OTA 模拟";
      object = b.id;
      break;
    }
    case "retry": {
      const b = batch(command.id);
      requireValue(b.status === "部分失败", "仅部分失败批次可以重试。");
      const reason = text(command.reason, "重试原因", 5);
      const failed = b.targets.filter((t) => t.status === "失败");
      requireValue(failed.length > 0, "没有可重试的失败设备。");
      failed.forEach((t) => {
        online(t.device);
        t.status = "重试中";
        t.attempts++;
      });
      b.status = "重试中";
      b.history.push("发起重试：" + reason);
      action = "仅重试失败 OTA";
      object = b.id;
      break;
    }
    case "invite": {
      const email = command.email.trim().toLowerCase();
      requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "邮箱格式无效。");
      requireValue(
        !s.members.some((m) => m.email.toLowerCase() === email),
        "该邮箱已存在。",
      );
      requireValue(
        ["运维工程师", "数据观察员", "租户管理员"].includes(command.role),
        "角色无效。",
      );
      s.members.push({
        id: id("MEM"),
        name: text(command.name, "姓名", 1, 30),
        email,
        role: command.role,
        status: "已邀请",
      });
      action = "邀请成员";
      object = email;
      break;
    }
    case "memberRole": {
      const m = s.members.find((m) => m.id === command.id);
      requireValue(m && m.role !== "平台管理员", "固定平台管理员不能降级。");
      requireValue(
        ["运维工程师", "数据观察员", "租户管理员"].includes(command.role),
        "角色无效。",
      );
      m.role = command.role;
      action = "变更成员角色";
      object = m.id;
      break;
    }
    case "quota":
      requireValue(
        Number.isInteger(command.quota) &&
          command.quota >= s.devices.length &&
          command.quota <= 100000,
        `配额不能低于当前用量 ${s.devices.length}，且不得超过 100000。`,
      );
      s.quota = command.quota;
      action = "调整设备配额";
      break;
    case "prefs":
      s.prefs = { inapp: command.inapp, email: command.email };
      action = "保存通知偏好";
      break;
    case "connection":
      requireValue(
        ["MQTT", "HTTPS"].includes(command.protocol),
        "连接器不存在。",
      );
      action = "模拟连接测试";
      object = command.protocol;
      break;
  }
  s.audit.unshift({
    id: id("AUD"),
    time: now,
    actor: roleNames[s.role],
    action,
    object,
  });
  return s;
}
export function samples(
  s: Workspace,
  deviceId: string | null,
  window: string | null,
) {
  const d =
    s.devices.find(
      (d) => d.id === deviceId && d.product === "ColdSense T200",
    ) ?? s.devices.find((d) => d.product === "ColdSense T200");
  return d
    ? [
        ["08:00", (d.temp! - 1.2).toFixed(1)],
        ["08:15", (d.temp! - 0.8).toFixed(1)],
        ["08:30", (d.temp! - 0.3).toFixed(1)],
        ["08:45", d.temp!.toFixed(1)],
      ].slice(window === "15" ? -2 : 0)
    : [];
}
/** Validate fields consumed by templates, not just collection presence. */
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v: Record<string, unknown>, keys: string[]) =>
  keys.every((k) => typeof v[k] === "string");
const list = (v: unknown, valid: (item: unknown) => boolean) =>
  Array.isArray(v) && v.every(valid);
const stringList = (v: unknown) => list(v, (item) => typeof item === "string");
export function validSnapshot(v: unknown): v is Workspace {
  if (
    !record(v) ||
    v.schema !== 1 ||
    !Number.isInteger(v.next) ||
    (v.next as number) < 20 ||
    typeof v.role !== "string" ||
    !Object.hasOwn(roleNames, v.role) ||
    !Number.isInteger(v.quota) ||
    (v.quota as number) < 0 ||
    !record(v.prefs) ||
    typeof v.prefs.email !== "boolean" ||
    typeof v.prefs.inapp !== "boolean"
  )
    return false;
  return (
    list(
      v.devices,
      (d) =>
        record(d) &&
        strings(d, [
          "id",
          "name",
          "serial",
          "product",
          "group",
          "tags",
          "status",
          "version",
        ]) &&
        ["在线", "离线", "待接入"].includes(String(d.status)) &&
        stringList(d.events) &&
        (d.product === "ColdSense T200"
          ? [d.temp, d.reported, d.desired].every(Number.isFinite)
          : d.product === "EnergyLink M1" &&
            [d.energy, d.power].every(Number.isFinite)),
    ) &&
    list(
      v.products,
      (p) =>
        record(p) &&
        strings(p, ["id", "name", "protocol"]) &&
        list(
          p.fields,
          (f) => record(f) && strings(f, ["name", "type", "unit"]),
        ),
    ) &&
    list(
      v.rules,
      (r) =>
        record(r) &&
        strings(r, ["id", "name"]) &&
        Number.isFinite(r.threshold) &&
        typeof r.enabled === "boolean",
    ) &&
    list(
      v.alarms,
      (a) =>
        record(a) &&
        strings(a, ["id", "name", "device", "status", "owner", "note"]) &&
        ["待确认", "已确认", "已解决"].includes(String(a.status)) &&
        stringList(a.history),
    ) &&
    list(
      v.firmwares,
      (f) =>
        record(f) && strings(f, ["id", "version", "product", "size", "note"]),
    ) &&
    list(
      v.batches,
      (b) =>
        record(b) &&
        strings(b, ["id", "name", "version", "status"]) &&
        ["待执行", "运行中", "部分失败", "重试中", "完成"].includes(
          String(b.status),
        ) &&
        stringList(b.history) &&
        Array.isArray(b.targets) &&
        b.targets.length > 0 &&
        list(
          b.targets,
          (t) =>
            record(t) &&
            strings(t, ["device", "status", "reason"]) &&
            ["等待", "下载中", "成功", "失败", "重试中"].includes(
              String(t.status),
            ) &&
            Number.isInteger(t.attempts) &&
            (t.attempts as number) >= 0,
        ),
    ) &&
    list(
      v.members,
      (m) => record(m) && strings(m, ["id", "name", "email", "role", "status"]),
    ) &&
    list(
      v.audit,
      (a) =>
        record(a) && strings(a, ["id", "time", "actor", "action", "object"]),
    )
  );
}
export function load(): Workspace {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (validSnapshot(parsed)) return parsed;
    }
  } catch {
    /* Missing/corrupt/unavailable browser storage is recoverable. */
  }
  return seed();
}
