export type Role = "platformAdmin" | "tenantAdmin" | "operator" | "viewer";
export interface Device {
  id: string;
  name: string;
  serial: string;
  product: string;
  group: string;
  tags: string;
  status: string;
  version: string;
  temp?: number;
  desired?: number;
  reported?: number;
  energy?: number;
  power?: number;
  events: string[];
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
  status: string;
  owner: string;
  note: string;
  history: string[];
}
export interface Batch {
  id: string;
  name: string;
  version: string;
  status: string;
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
  revision: 1;
  next: number;
  role: Role;
  devices: Device[];
  products: Product[];
  rules: Rule[];
  alarms: Alarm[];
  firmwares: {
    id: string;
    version: string;
    product: string;
    size: string;
    note: string;
  }[];
  batches: Batch[];
  members: Member[];
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
export type Input = Record<string, string>;
export type Action =
  | "register"
  | "edit"
  | "delete"
  | "ingest"
  | "shadow"
  | "sync"
  | "reboot"
  | "field"
  | "rule"
  | "toggle"
  | "test"
  | "ack"
  | "resolve"
  | "batch"
  | "advance"
  | "retry"
  | "invite"
  | "member"
  | "quota"
  | "prefs"
  | "connector";
export const cold = "ColdSense T200";
export const roles: Record<Role, string> = {
  platformAdmin: "平台管理员",
  tenantAdmin: "租户管理员",
  operator: "运维工程师",
  viewer: "数据观察员",
};
export function can(role: Role, cap: "write" | "operate" | "govern") {
  return cap === "govern"
    ? role === "platformAdmin"
    : cap === "write"
      ? ["platformAdmin", "tenantAdmin"].includes(role)
      : ["platformAdmin", "tenantAdmin", "operator"].includes(role);
}
export function capability(a: Action) {
  return (
    ["invite", "member", "quota", "prefs"].includes(a)
      ? "govern"
      : [
            "register",
            "edit",
            "delete",
            "field",
            "rule",
            "toggle",
            "batch",
          ].includes(a)
        ? "write"
        : "operate"
  ) as "govern" | "write" | "operate";
}
function required(v: string | undefined, min = 1, max = 200) {
  const value = String(v ?? "").trim();
  if (value.length < min || value.length > max)
    throw Error(`请输入 ${min}–${max} 个有效字符。`);
  return value;
}
function number(v: string | undefined, min: number, max: number) {
  const n = Number(required(v));
  if (!Number.isFinite(n) || n < min || n > max)
    throw Error(`数值须在 ${min}–${max} 之间。`);
  return n;
}
function find<T extends { id: string }>(items: T[], id: string | undefined): T {
  const item = items.find((x) => x.id === id);
  if (!item) throw Error("对象不存在或已删除。");
  return item;
}
const labels: Record<Action, string> = {
  register: "注册设备",
  edit: "修改设备资料",
  delete: "批量删除设备",
  ingest: "设备模拟上报",
  shadow: "更新设备影子",
  sync: "同步设备影子",
  reboot: "模拟重启",
  field: "新增物模型属性",
  rule: "创建规则",
  toggle: "切换规则状态",
  test: "规则试运行",
  ack: "确认告警",
  resolve: "解决告警",
  batch: "创建 OTA 批次",
  advance: "推进 OTA 模拟",
  retry: "仅重试失败 OTA",
  invite: "邀请成员",
  member: "变更成员角色",
  quota: "调整设备配额",
  prefs: "保存通知偏好",
  connector: "测试连接",
};
/** Execute on a disposable clone; the store commits only after success. */
export function execute(s: State, a: Action, p: Input): string {
  if (!can(s.role, capability(a)))
    throw Error("无操作权限：当前身份不能执行此操作。");
  const id = (prefix: string) => `${prefix}-${++s.next}`;
  let object = p.id || "工作区",
    result = "操作已完成";
  const device = () => find(s.devices, p.id);
  const temperature = () => {
    const d = device();
    if (d.product !== cold) throw Error("电表仅提供只读规格样例。");
    return d;
  };
  switch (a) {
    case "register": {
      const name = required(p.name, 1, 48),
        serial = required(p.serial, 4, 40);
      if (!/^[A-Za-z0-9_-]+$/.test(serial)) throw Error("序列号格式无效。");
      if (
        s.devices.some((d) => d.serial.toLowerCase() === serial.toLowerCase())
      )
        throw Error("此序列号已存在。");
      if (s.devices.length >= s.quota) throw Error("设备配额已用尽。");
      if (!s.products.some((x) => x.name === p.product))
        throw Error("产品无效。");
      object = id("DEV");
      s.devices.push({
        id: object,
        name,
        serial,
        product: p.product!,
        group: required(p.group),
        tags: "新设备",
        status: "待接入",
        version: "未安装",
        ...(p.product === cold
          ? { temp: 24.6, desired: 22, reported: 22 }
          : { energy: 420.8, power: 2600 }),
        events: ["设备档案已创建，等待首次上报"],
      });
      result = object;
      break;
    }
    case "edit": {
      const d = device();
      d.name = required(p.name, 1, 48);
      d.group = required(p.group, 1, 40);
      d.tags = required(p.tags, 0, 80);
      result = "设备资料已保存";
      break;
    }
    case "delete": {
      if (p.confirmation !== "DELETE") throw Error("请输入 DELETE 确认。");
      const ids = (p.ids || "").split(",").filter(Boolean);
      if (!ids.length) throw Error("请选择设备。");
      ids.forEach((i) => find(s.devices, i));
      if (
        s.batches.some(
          (b) =>
            ["待执行", "运行中", "重试中"].includes(b.status) &&
            b.targets.some((t) => ids.includes(t.device)),
        )
      )
        throw Error("设备参与活跃 OTA 批次，暂不可删除。");
      s.devices = s.devices.filter((d) => !ids.includes(d.id));
      object = ids.join(",");
      result = "所选设备已删除";
      break;
    }
    case "ingest": {
      const d = temperature();
      d.status = "在线";
      d.temp = Number(((d.temp ?? 24.6) + 0.2).toFixed(1));
      d.events.push(`模拟上报成功 · ${d.temp}°C`);
      result = "设备已在线，上报数据已追加";
      break;
    }
    case "shadow":
      temperature().desired = number(p.temp, -20, 50);
      result = "目标温度已保存，等待设备同步";
      break;
    case "sync":
    case "reboot": {
      const d = temperature();
      if (d.status !== "在线") throw Error("设备不在线，先模拟上报恢复连接。");
      if (a === "sync") {
        d.reported = d.desired;
        d.events.push("设备影子已同步");
      } else d.events.push("命令 reboot · 模拟回执 SUCCESS");
      result =
        a === "sync" ? "reported 已与 desired 同步" : "设备返回模拟成功回执";
      break;
    }
    case "field": {
      const product = find(s.products, p.id),
        name = required(p.name, 2, 31);
      if (!/^[A-Za-z][A-Za-z0-9_]+$/.test(name))
        throw Error("属性标识符格式无效。");
      if (product.fields.some((f) => f.name === name))
        throw Error("属性标识符已存在。");
      if (!["float", "integer", "boolean", "string"].includes(p.type || ""))
        throw Error("类型无效。");
      product.fields.push({
        name,
        type: p.type!,
        unit: required(p.unit, 0, 12),
      });
      result = "属性已添加";
      break;
    }
    case "rule": {
      const name = required(p.name, 1, 50),
        threshold = number(p.threshold, -40, 120);
      object = id("RUL");
      s.rules.push({ id: object, name, threshold, enabled: true });
      result = "规则已创建并启用";
      break;
    }
    case "toggle": {
      const r = find(s.rules, p.id);
      r.enabled = !r.enabled;
      result = "规则状态已更新";
      break;
    }
    case "test": {
      const r = find(s.rules, p.id),
        d = find(s.devices, p.device);
      if (!r.enabled) throw Error("规则已停用，请先启用。");
      if (d.product !== cold) throw Error("规则仅适用于温控设备。");
      d.temp = number(p.temp, -40, 120);
      d.events.push(`规则试运行输入 ${d.temp}°C`);
      if (d.temp > r.threshold) {
        s.alarms.unshift({
          id: id("ALM"),
          name: r.name,
          device: d.id,
          status: "待确认",
          owner: "未分配",
          note: `温度 ${d.temp}°C，高于阈值 ${r.threshold}°C`,
          history: [`规则 ${r.id} 触发告警`],
        });
        result = "条件命中，已创建待确认告警";
      } else result = "条件未命中，没有创建告警";
      break;
    }
    case "ack": {
      const x = find(s.alarms, p.id);
      if (x.status !== "待确认") throw Error("仅待确认告警可以确认。");
      const note = required(p.note, 3);
      if (!s.members.some((m) => m.name === p.owner && m.status === "已加入"))
        throw Error("负责人无效。");
      x.owner = p.owner!;
      x.status = "已确认";
      x.history.push(`${p.owner} 确认告警：${note}`);
      result = "告警已确认";
      break;
    }
    case "resolve": {
      const x = find(s.alarms, p.id);
      if (x.status !== "已确认") throw Error("请先确认告警。");
      x.history.push("已解决：" + required(p.note, 5, 300));
      x.status = "已解决";
      result = "告警已解决";
      break;
    }
    case "batch": {
      const name = required(p.name, 1, 50),
        ids = (p.targets || "").split(",").filter(Boolean);
      if (new Set(ids).size !== ids.length) throw Error("升级目标不能重复。");
      if (!ids.length) throw Error("至少选择一台在线兼容设备。");
      if (
        ids.some(
          (i) =>
            !s.devices.some(
              (d) => d.id === i && d.product === cold && d.status === "在线",
            ),
        )
      )
        throw Error("范围中包含不可用设备。");
      object = id("OTA");
      s.batches.unshift({
        id: object,
        name,
        version: "2.3.1",
        status: "待执行",
        targets: ids.map((device) => ({
          device,
          status: "等待",
          attempts: 0,
          reason: "",
        })),
        history: [`创建批次，已确认 ${ids.length} 台设备`],
      });
      result = object;
      break;
    }
    case "advance": {
      const b = find(s.batches, p.id);
      if (b.status !== "重试中" && !can(s.role, "write"))
        throw Error("无操作权限：只有管理员可以启动升级。");
      if (!["待执行", "运行中", "重试中"].includes(b.status))
        throw Error("当前批次不可推进。");
      if (
        b.targets
          .filter((t) => b.status !== "重试中" || t.status === "重试中")
          .some(
            (t) =>
              !s.devices.some((d) => d.id === t.device && d.status === "在线"),
          )
      )
        throw Error("升级目标不存在或离线。");
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
          if (t.status === "成功")
            find(s.devices, t.device).version = b.version;
        });
        b.status = "部分失败";
        b.history.push("首次执行结束，1 台校验超时");
      } else {
        b.targets
          .filter((t) => t.status === "重试中")
          .forEach((t) => {
            t.status = "成功";
            t.reason = "";
            find(s.devices, t.device).version = b.version;
          });
        b.status = "完成";
        b.history.push("失败设备重试成功；未重复执行成功设备");
      }
      result = "升级进度已更新";
      break;
    }
    case "retry": {
      const b = find(s.batches, p.id);
      if (b.status !== "部分失败") throw Error("仅部分失败批次可以重试。");
      const reason = required(p.reason, 5),
        failed = b.targets.filter((t) => t.status === "失败");
      if (
        !failed.length ||
        failed.some(
          (t) =>
            !s.devices.some((d) => d.id === t.device && d.status === "在线"),
        )
      )
        throw Error("失败设备不存在或离线，无法重试。");
      failed.forEach((t) => {
        t.status = "重试中";
        t.attempts++;
      });
      b.status = "重试中";
      b.history.push("发起重试：" + reason);
      result = "失败设备已进入重试";
      break;
    }
    case "invite": {
      const name = required(p.name, 1, 30),
        email = required(p.email, 3, 100);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw Error("邮箱格式无效。");
      if (s.members.some((m) => m.email.toLowerCase() === email.toLowerCase()))
        throw Error("该邮箱已存在。");
      if (!["运维工程师", "数据观察员", "租户管理员"].includes(p.role || ""))
        throw Error("角色无效。");
      s.members.push({
        id: id("MEM"),
        name,
        email,
        role: p.role!,
        status: "已邀请",
      });
      result = "模拟邀请记录已创建";
      break;
    }
    case "member": {
      const m = find(s.members, p.id);
      if (m.role === "平台管理员") throw Error("固定演示管理员不可降级。");
      if (!["租户管理员", "运维工程师", "数据观察员"].includes(p.role || ""))
        throw Error("角色无效。");
      m.role = p.role!;
      result = "成员角色已更新";
      break;
    }
    case "quota": {
      const quota = number(p.quota, s.devices.length, 100000);
      if (!Number.isInteger(quota)) throw Error("配额必须为整数。");
      s.quota = quota;
      result = "配额已更新";
      break;
    }
    case "prefs":
      s.prefs = { inapp: p.inapp === "true", email: p.email === "true" };
      result = "偏好已保存";
      break;
    case "connector":
      if (!["MQTT", "HTTPS"].includes(p.id || ""))
        throw Error("连接器不存在。");
      result = "模拟握手成功 · 固定延迟 42 ms，未发起真实网络请求";
      break;
  }
  s.audit.unshift({
    id: id("AUD"),
    time: `模拟事件 ${s.next}`,
    actor: roles[s.role],
    action: labels[a],
    object,
  });
  return result;
}
export function readings(d: Device | undefined, window = "45") {
  if (!d || d.product !== cold) return [];
  const t = d.temp ?? 0;
  return [
    ["08:00", (t - 1.2).toFixed(1)],
    ["08:15", (t - 0.8).toFixed(1)],
    ["08:30", (t - 0.3).toFixed(1)],
    ["08:45", t.toFixed(1)],
  ].slice(window === "15" ? -2 : 0);
}
