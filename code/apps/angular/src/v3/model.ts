import { seed } from "./seed";
export type Role = "platformAdmin" | "tenantAdmin" | "operator" | "viewer";
export const roles: Record<Role, string> = {
  platformAdmin: "平台管理员",
  tenantAdmin: "租户管理员",
  operator: "运维工程师",
  viewer: "数据观察员",
};
export interface Device {
  id: string;
  name: string;
  serial: string;
  product: string;
  group: string;
  tags: string;
  status: "在线" | "离线" | "待接入";
  version: string;
  events: string[];
  temp?: number;
  desired?: number;
  reported?: number;
  energy?: number;
  power?: number;
}
export interface Product {
  id: string;
  name: string;
  protocol: string;
  fields: { name: string; type: string; unit: string }[];
}
export interface Rule {
  id: string;
  name: string;
  threshold: number;
  enabled: boolean;
}
export interface Alarm {
  id: string;
  name: string;
  device: string;
  status: "待确认" | "已确认" | "已解决";
  owner: string;
  note: string;
  history: string[];
}
export interface Batch {
  id: string;
  name: string;
  version: string;
  status: "待执行" | "运行中" | "部分失败" | "重试中" | "完成";
  targets: {
    device: string;
    status: string;
    attempts: number;
    reason: string;
  }[];
  history: string[];
}
export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}
export interface State {
  schema: 1;
  next: number;
  role: Role;
  devices: Device[];
  products: Product[];
  rules: Rule[];
  alarms: Alarm[];
  batches: Batch[];
  members: Member[];
  firmwares: {
    id: string;
    version: string;
    product: string;
    size: string;
    note: string;
  }[];
  quota: number;
  prefs: { email: boolean; inapp: boolean };
  audit: {
    id: string;
    time: string;
    actor: string;
    action: string;
    object: string;
  }[];
}
export type Fields = Record<string, string>;
export type Action =
  | "register"
  | "edit"
  | "ingest"
  | "shadow"
  | "sync"
  | "command"
  | "delete"
  | "field"
  | "rule"
  | "toggle"
  | "trial"
  | "ack"
  | "resolve"
  | "batch"
  | "advance"
  | "retry"
  | "invite"
  | "member"
  | "quota"
  | "prefs"
  | "connect";
export const allowed = (role: Role, cap: "write" | "operate" | "govern") =>
  cap === "govern"
    ? role === "platformAdmin"
    : cap === "write"
      ? ["platformAdmin", "tenantAdmin"].includes(role)
      : role !== "viewer";
const text = (value: string | undefined, label: string, min = 1, max = 300) => {
  const v = value?.trim() ?? "";
  if (v.length < min) throw Error(`${label}至少 ${min} 个字符。`);
  if (v.length > max) throw Error(`${label}最多 ${max} 个字符。`);
  return v;
};
const number = (value: string, min: number, max: number, label: string) => {
  const n = Number(value);
  if (!value?.trim() || !Number.isFinite(n) || n < min || n > max)
    throw Error(`${label}需在 ${min} 至 ${max} 之间。`);
  return n;
};
/** Validate a cloned transaction. Nothing, including audit/IDs, escapes a failed command. */
export function command(
  source: State,
  action: Action,
  f: Fields = {},
  target = "",
): { state: State; id: string } {
  const s = structuredClone(source);
  const cap = ["invite", "member", "quota", "prefs"].includes(action)
    ? "govern"
    : [
          "register",
          "edit",
          "delete",
          "field",
          "rule",
          "toggle",
          "batch",
        ].includes(action)
      ? "write"
      : "operate";
  if (!allowed(s.role, cap))
    throw Error("无操作权限：当前身份不能执行此操作。");
  const id = (prefix: string) => `${prefix}-${++s.next}`;
  let object = target;
  const device = () => {
    const d = s.devices.find((d) => d.id === target);
    if (!d) throw Error("设备不存在。");
    return d;
  };
  const cold = () => {
    const d = device();
    if (d.product !== "ColdSense T200")
      throw Error("电表仅能耗规格样例，不支持温控操作。");
    return d;
  };
  const alarm = () => {
    const a = s.alarms.find((a) => a.id === target);
    if (!a) throw Error("告警不存在。");
    return a;
  };
  const batch = () => {
    const b = s.batches.find((b) => b.id === target);
    if (!b) throw Error("批次不存在。");
    return b;
  };
  switch (action) {
    case "register": {
      const name = text(f["name"], "设备名称", 1, 48),
        serial = text(f["serial"], "序列号");
      if (!/^[\w-]{4,40}$/.test(serial))
        throw Error("序列号需为 4–40 位字母、数字、短横线或下划线。");
      if (
        s.devices.some((d) => d.serial.toLowerCase() === serial.toLowerCase())
      )
        throw Error("此序列号已存在。");
      if (s.devices.length >= s.quota) throw Error("设备配额已用尽。");
      if (!s.products.some((p) => p.name === f["product"]))
        throw Error("产品不存在。");
      object = id("DEV");
      s.devices.push({
        id: object,
        name,
        serial,
        product: f["product"],
        group: text(f["group"], "所属分组"),
        tags: "新设备",
        status: "待接入",
        version: "未安装",
        events: ["设备档案已创建，等待首次上报"],
        ...(f["product"] === "ColdSense T200"
          ? { temp: 24.6, desired: 22, reported: 22 }
          : { energy: 420.8, power: 2600 }),
      });
      break;
    }
    case "edit":
      Object.assign(device(), {
        name: text(f["name"], "设备名称", 1, 48),
        group: text(f["group"], "所属分组"),
        tags: text(f["tags"], "标签", 0, 80),
      });
      break;
    case "ingest": {
      const d = cold();
      d.status = "在线";
      d.temp = Number(((d.temp ?? 24.6) + 0.2).toFixed(1));
      d.events.push(`模拟上报成功 · ${d.temp}°C`);
      break;
    }
    case "shadow":
      cold().desired = number(f["temp"], -20, 50, "目标温度");
      break;
    case "sync": {
      const d = cold();
      if (d.status !== "在线") throw Error("设备不在线，请先模拟上报。");
      d.reported = d.desired;
      d.events.push("设备影子已同步");
      break;
    }
    case "command": {
      const d = cold();
      if (d.status !== "在线") throw Error("离线设备无法执行命令。");
      d.events.push("命令 reboot · 模拟回执 SUCCESS");
      break;
    }
    case "delete": {
      if (f["confirm"] !== "DELETE") throw Error("请输入 DELETE 确认。");
      const ids = target.split(",").filter(Boolean);
      if (!ids.length || ids.some((id) => !s.devices.some((d) => d.id === id)))
        throw Error("设备不存在。");
      if (
        s.batches.some(
          (b) =>
            ["待执行", "运行中", "重试中"].includes(b.status) &&
            b.targets.some((t) => ids.includes(t.device)),
        )
      )
        throw Error("活跃 OTA 批次中的设备不可删除。");
      s.devices = s.devices.filter((d) => !ids.includes(d.id));
      break;
    }
    case "field": {
      const p = s.products.find((p) => p.id === target);
      if (!p) throw Error("产品不存在。");
      const name = text(f["name"], "属性标识符");
      if (!/^[a-zA-Z][a-zA-Z0-9_]{1,30}$/.test(name))
        throw Error("属性标识符格式无效。");
      if (p.fields.some((x) => x.name === name))
        throw Error("属性标识符已存在。");
      if (!["float", "integer", "boolean", "string"].includes(f["type"]))
        throw Error("类型无效。");
      p.fields.push({
        name,
        type: f["type"],
        unit: text(f["unit"], "单位", 0, 12),
      });
      break;
    }
    case "rule":
      object = id("RUL");
      s.rules.push({
        id: object,
        name: text(f["name"], "规则名称", 1, 50),
        threshold: number(f["threshold"], -40, 120, "阈值"),
        enabled: true,
      });
      break;
    case "toggle": {
      const r = s.rules.find((r) => r.id === target);
      if (!r) throw Error("规则不存在。");
      r.enabled = !r.enabled;
      break;
    }
    case "trial": {
      const r = s.rules.find((r) => r.id === target);
      if (!r?.enabled) throw Error("请先启用规则。");
      const d = s.devices.find(
        (d) => d.id === f["device"] && d.product === "ColdSense T200",
      );
      if (!d) throw Error("没有兼容设备。");
      d.temp = number(f["temp"], -40, 120, "模拟温度");
      d.events.push(`规则试运行输入 ${d.temp}°C`);
      if (d.temp > r.threshold) {
        object = id("ALM");
        s.alarms.unshift({
          id: object,
          name: r.name,
          device: d.id,
          status: "待确认",
          owner: "未分配",
          note: `温度 ${d.temp}°C，高于阈值 ${r.threshold}°C`,
          history: [`规则 ${r.id} 触发告警`],
        });
      }
      break;
    }
    case "ack": {
      const a = alarm();
      if (a.status !== "待确认") throw Error("只能确认待确认告警。");
      if (
        !s.members.some((m) => m.name === f["owner"] && m.status === "已加入")
      )
        throw Error("负责人不可用。");
      a.owner = f["owner"];
      a.history.push(`${a.owner} 确认：${text(f["note"], "说明", 3, 200)}`);
      a.status = "已确认";
      break;
    }
    case "resolve": {
      const a = alarm();
      if (a.status !== "已确认") throw Error("请先确认并分派告警。");
      a.history.push(`已解决：${text(f["note"], "解决原因", 5)}`);
      a.status = "已解决";
      break;
    }
    case "batch": {
      const ids = (f["targets"] || "").split(",").filter(Boolean);
      if (new Set(ids).size !== ids.length) throw Error("目标设备不可重复。");
      if (
        !ids.length ||
        ids.some(
          (id) =>
            !s.devices.some(
              (d) =>
                d.id === id &&
                d.status === "在线" &&
                d.product === "ColdSense T200",
            ),
        )
      )
        throw Error("至少选择一台在线兼容设备。");
      object = id("OTA");
      s.batches.unshift({
        id: object,
        name: text(f["name"], "批次名称", 1, 50),
        version: "2.3.1",
        status: "待执行",
        targets: ids.map((device) => ({
          device,
          status: "等待",
          attempts: 0,
          reason: "",
        })),
        history: [`已确认 ${ids.length} 台设备`],
      });
      break;
    }
    case "advance": {
      const b = batch();
      if (b.status !== "重试中" && !allowed(s.role, "write"))
        throw Error("无创建升级权限。");
      if (
        b.targets
          .filter((t) => b.status !== "重试中" || t.status === "重试中")
          .some(
            (t) =>
              !s.devices.some((d) => d.id === t.device && d.status === "在线"),
          )
      )
        throw Error("OTA 目标不存在或不在线。");
      if (b.status === "待执行") {
        b.status = "运行中";
        b.targets.forEach((t) => {
          t.status = "下载中";
          t.attempts = 1;
        });
        b.history.push("开始模拟下载");
      } else if (b.status === "运行中") {
        b.targets.forEach((t, i) => {
          t.status = i === b.targets.length - 1 ? "失败" : "成功";
          t.reason = t.status === "失败" ? "校验响应超时 DEMO_TIMEOUT" : "";
        });
        b.status = "部分失败";
        b.history.push("首次执行结束，1 台校验超时");
      } else if (b.status === "重试中") {
        b.targets
          .filter((t) => t.status === "重试中")
          .forEach((t) => {
            t.status = "成功";
            t.reason = "";
          });
        b.status = "完成";
        b.history.push("重试完成，成功设备未重复执行");
      } else throw Error("此批次当前不可推进。");
      for (const t of b.targets.filter((t) => t.status === "成功")) {
        const d = s.devices.find((d) => d.id === t.device);
        if (d) d.version = b.version;
      }
      break;
    }
    case "retry": {
      const b = batch();
      if (b.status !== "部分失败") throw Error("没有失败项可重试。");
      const failed = b.targets.filter((t) => t.status === "失败");
      if (
        !failed.length ||
        failed.some(
          (t) =>
            !s.devices.some((d) => d.id === t.device && d.status === "在线"),
        )
      )
        throw Error("重试目标不存在或不在线。");
      const reason = text(f["reason"], "重试原因", 5, 200);
      failed.forEach((t) => {
        t.status = "重试中";
        t.attempts++;
      });
      b.status = "重试中";
      b.history.push(`仅重试失败设备：${reason}`);
      break;
    }
    case "invite": {
      const name = text(f["name"], "姓名", 1, 30),
        email = text(f["email"], "邮箱");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw Error("邮箱格式无效。");
      if (s.members.some((m) => m.email.toLowerCase() === email.toLowerCase()))
        throw Error("邮箱已存在。");
      if (!["租户管理员", "运维工程师", "数据观察员"].includes(f["role"]))
        throw Error("角色无效。");
      object = id("MEM");
      s.members.push({
        id: object,
        name,
        email,
        role: f["role"],
        status: "已邀请",
      });
      break;
    }
    case "member": {
      const m = s.members.find((m) => m.id === target);
      if (!m || m.role === "平台管理员")
        throw Error("固定平台管理员不可降级。");
      if (!["租户管理员", "运维工程师", "数据观察员"].includes(f["role"]))
        throw Error("角色无效。");
      m.role = f["role"];
      break;
    }
    case "quota": {
      const q = number(f["quota"], s.devices.length, 100000, "配额");
      if (!Number.isInteger(q)) throw Error("配额必须为整数。");
      s.quota = q;
      break;
    }
    case "prefs":
      if (
        !["true", "false"].includes(f["inapp"]) ||
        !["true", "false"].includes(f["email"])
      )
        throw Error("偏好格式无效。");
      s.prefs = { inapp: f["inapp"] === "true", email: f["email"] === "true" };
      break;
    case "connect":
      if (!["MQTT", "HTTPS"].includes(target)) throw Error("连接协议不存在。");
      break;
  }
  const names: Record<Action, string> = {
    register: "注册设备",
    edit: "修改设备资料",
    ingest: "设备模拟上报",
    shadow: "更新设备影子",
    sync: "同步设备影子",
    command: "发送模拟重启",
    delete: "批量删除设备",
    field: "新增物模型属性",
    rule: "创建规则",
    toggle: "切换规则状态",
    trial: "规则试运行",
    ack: "确认告警",
    resolve: "解决告警",
    batch: "创建 OTA 批次",
    advance: "推进 OTA 模拟",
    retry: "仅重试失败 OTA",
    invite: "邀请成员",
    member: "变更成员角色",
    quota: "调整配额",
    prefs: "保存通知偏好",
    connect: "模拟连接测试",
  };
  s.audit.unshift({
    id: id("AUD"),
    time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
    actor: roles[s.role],
    action: names[action],
    object: object || "工作区",
  });
  return { state: s, id: object };
}
export function samples(d: Device, short = false) {
  const t = d.temp ?? 0;
  const all = [
    ["08:00", (t - 1.2).toFixed(1)],
    ["08:15", (t - 0.8).toFixed(1)],
    ["08:30", (t - 0.3).toFixed(1)],
    ["08:45", t.toFixed(1)],
  ];
  return short ? all.slice(-2) : all;
}
/** Version and structural validation protects every collection used by templates. */
export function restore(raw: string | null): State {
  try {
    const s = JSON.parse(raw || "null") as State;
    const strings = (o: object, keys: string[]) =>
      keys.every((k) => typeof (o as Record<string, unknown>)[k] === "string");
    if (
      !s ||
      s.schema !== 1 ||
      !Object.hasOwn(roles, s.role) ||
      !Number.isInteger(s.next) ||
      !Number.isInteger(s.quota) ||
      !s.prefs ||
      typeof s.prefs.inapp !== "boolean" ||
      typeof s.prefs.email !== "boolean"
    )
      return seed();
    if (
      ![
        s.devices,
        s.products,
        s.rules,
        s.alarms,
        s.batches,
        s.members,
        s.firmwares,
        s.audit,
      ].every(Array.isArray)
    )
      return seed();
    if (
      s.quota < s.devices.length ||
      s.devices.some(
        (d) =>
          !d ||
          !strings(d, [
            "id",
            "name",
            "serial",
            "product",
            "group",
            "tags",
            "status",
            "version",
          ]) ||
          !Array.isArray(d.events) ||
          !d.events.every((e) => typeof e === "string") ||
          (d.product === "ColdSense T200"
            ? ![d.temp, d.desired, d.reported].every(Number.isFinite)
            : d.product !== "EnergyLink M1" ||
              ![d.energy, d.power].every(Number.isFinite)),
      ) ||
      s.products.some(
        (p) =>
          !p ||
          !strings(p, ["id", "name", "protocol"]) ||
          !Array.isArray(p.fields) ||
          p.fields.some((f) => !f || !strings(f, ["name", "type", "unit"])),
      ) ||
      s.rules.some(
        (r) =>
          !r ||
          !strings(r, ["id", "name"]) ||
          !Number.isFinite(r.threshold) ||
          typeof r.enabled !== "boolean",
      ) ||
      s.alarms.some(
        (a) =>
          !a ||
          !strings(a, ["id", "name", "device", "status", "owner", "note"]) ||
          !Array.isArray(a.history),
      ) ||
      s.batches.some(
        (b) =>
          !b ||
          !strings(b, ["id", "name", "version", "status"]) ||
          !Array.isArray(b.history) ||
          !Array.isArray(b.targets) ||
          b.targets.some(
            (t) =>
              !t ||
              !strings(t, ["device", "status", "reason"]) ||
              !Number.isInteger(t.attempts),
          ),
      ) ||
      s.members.some(
        (m) => !m || !strings(m, ["id", "name", "email", "role", "status"]),
      ) ||
      s.firmwares.some(
        (f) => !f || !strings(f, ["id", "version", "product", "size", "note"]),
      ) ||
      s.audit.some(
        (a) => !a || !strings(a, ["id", "time", "actor", "action", "object"]),
      )
    )
      return seed();
    return s;
  } catch {
    return seed();
  }
}
