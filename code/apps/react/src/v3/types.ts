export type Role = "platformAdmin" | "tenantAdmin" | "operator" | "viewer";
export const roleNames: Record<Role, string> = {
  platformAdmin: "平台管理员",
  tenantAdmin: "租户管理员",
  operator: "运维工程师",
  viewer: "数据观察员",
};
export type Capability = "read" | "write" | "operate" | "govern";
export interface Device {
  id: string;
  name: string;
  serial: string;
  product: string;
  group: string;
  tags: string;
  status: "在线" | "离线" | "待接入";
  temp?: number;
  energy?: number;
  power?: number;
  version: string;
  reported?: number;
  desired?: number;
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
  status: "待确认" | "已确认" | "已解决";
  owner: string;
  note: string;
  history: string[];
}
export interface Target {
  device: string;
  status: "等待" | "下载中" | "成功" | "失败" | "重试中";
  attempts: number;
  reason: string;
}
export interface Batch {
  id: string;
  name: string;
  version: string;
  status: "待执行" | "运行中" | "部分失败" | "重试中" | "完成";
  targets: Target[];
  history: string[];
}
export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "已加入" | "已邀请";
}
export interface Workspace {
  schema: 1;
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
  prefs: { inapp: boolean; email: boolean };
  audit: {
    id: string;
    time: string;
    actor: string;
    action: string;
    object: string;
  }[];
}
export type Command =
  | {
      type: "register";
      name: string;
      serial: string;
      product: string;
      group: string;
    }
  | {
      type: "editDevice";
      id: string;
      name: string;
      group: string;
      tags: string;
    }
  | { type: "ingest" | "sync" | "reboot"; id: string }
  | { type: "shadow"; id: string; temp: number }
  | { type: "delete"; ids: string[]; confirmation: string }
  | {
      type: "attribute";
      id: string;
      name: string;
      fieldType: string;
      unit: string;
    }
  | { type: "createRule"; name: string; threshold: number }
  | { type: "toggleRule"; id: string }
  | { type: "testRule"; id: string; device: string; temp: number }
  | { type: "ack"; id: string; owner: string; note: string }
  | { type: "resolve"; id: string; note: string }
  | { type: "createBatch"; name: string; targets: string[] }
  | { type: "advance"; id: string }
  | { type: "retry"; id: string; reason: string }
  | { type: "invite"; name: string; email: string; role: string }
  | { type: "memberRole"; id: string; role: string }
  | { type: "quota"; quota: number }
  | { type: "prefs"; inapp: boolean; email: boolean }
  | { type: "connection"; protocol: string };
