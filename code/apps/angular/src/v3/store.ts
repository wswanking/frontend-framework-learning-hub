import { Injectable, inject, signal } from "@angular/core";
import type { CanActivateFn, CanDeactivateFn } from "@angular/router";
import { Subject } from "rxjs";
import {
  command,
  restore,
  type Action,
  type Fields,
  type Role,
  type State,
} from "./model";
import { seed } from "./seed";
export const storageKey = "iot-atlas-angular-v3";
@Injectable({ providedIn: "root" })
export class WorkspaceStore {
  readonly state = signal(this.load());
  readonly feedback = signal("");
  readonly overlay = new Subject<"search" | "notifications">();
  private load() {
    try {
      return restore(localStorage.getItem(storageKey));
    } catch {
      return seed();
    }
  }
  save(s: State) {
    this.state.set(s);
    try {
      localStorage.setItem(storageKey, JSON.stringify(s));
      return true;
    } catch {
      this.feedback.set("存储不可用，修改仅保留在本次打开中。");
      return false;
    }
  }
  execute(action: Action, fields: Fields = {}, id = "") {
    const result = command(this.state(), action, fields, id);
    if (this.save(result.state)) this.feedback.set("操作已完成（本地模拟）");
    return result.id;
  }
  role(role: Role) {
    if (this.save({ ...this.state(), role }))
      this.feedback.set("模拟身份已切换。");
  }
  reset() {
    if (this.save(seed())) this.feedback.set("本地演示已重置。");
  }
}
@Injectable({ providedIn: "root" })
export class WorkspaceDraft {
  dirty: () => boolean = () => false;
  discard: () => void = () => undefined;
  check() {
    if (!this.dirty()) return true;
    if (!confirm("有未保存的修改。放弃修改并离开？")) return false;
    this.discard();
    return true;
  }
}
export const leaveWorkspace: CanDeactivateFn<unknown> = () =>
  inject(WorkspaceDraft).check();
export const activateWorkspace: CanActivateFn = () =>
  inject(WorkspaceDraft).check();
export const modules = [
  {
    path: "workspace",
    title: "工作区",
    group: "运行视图",
    icon: "◫",
    description: "关注异常，持续推进每一项现场任务。",
  },
  {
    path: "alarms",
    title: "告警中心",
    group: "运行视图",
    icon: "△",
    description: "确认、分派与解决，形成完整处置记录。",
  },
  {
    path: "telemetry",
    title: "时序数据",
    group: "运行视图",
    icon: "∿",
    description: "按设备查询指标，定位异常发生的时刻。",
  },
  {
    path: "nodes",
    title: "全球节点",
    group: "运行视图",
    icon: "◎",
    description: "以地域与节点维度查看接入健康。",
  },
  {
    path: "devices",
    title: "设备中心",
    group: "资产与自动化",
    icon: "▤",
    description: "管理设备全生命周期，从接入到诊断与控制。",
  },
  {
    path: "products",
    title: "产品与物模型",
    group: "资产与自动化",
    icon: "◇",
    description: "用一致的数据语言连接设备与应用。",
  },
  {
    path: "rules",
    title: "规则与场景",
    group: "资产与自动化",
    icon: "⑂",
    description: "从数据条件到可追踪的运维行动。",
  },
  {
    path: "ota",
    title: "固件与 OTA",
    group: "资产与自动化",
    icon: "↑",
    description: "有范围、有进度、有恢复路径的版本交付。",
  },
  {
    path: "connectors",
    title: "连接与转发",
    group: "资产与自动化",
    icon: "⇄",
    description: "查看协议入口、连接状态与数据去向。",
  },
  {
    path: "tenants",
    title: "租户与成员",
    group: "组织与治理",
    icon: "▦",
    description: "明确成员职责、资源边界和使用配额。",
  },
  {
    path: "access",
    title: "角色与权限",
    group: "组织与治理",
    icon: "◇",
    description: "将可执行的操作与职责匹配。",
  },
  {
    path: "audit",
    title: "审计与运维",
    group: "组织与治理",
    icon: "≡",
    description: "每一次关键操作都有可追踪的上下文。",
  },
  {
    path: "settings",
    title: "设置与集成",
    group: "组织与治理",
    icon: "⚙",
    description: "控制工作区偏好与外部集成边界。",
  },
  {
    path: "learning",
    title: "学习与交付",
    group: "工程教学",
    icon: "⌘",
    description: "同一业务标准，三种框架独立惯用实现。",
  },
];
