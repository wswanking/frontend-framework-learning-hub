export const headings: Record<string, [string, string]> = {
  workspace: ["运行工作区", "关注异常，持续推进每一项现场任务。"],
  devices: ["设备中心", "管理设备全生命周期，从接入到诊断与控制。"],
  products: ["产品与物模型", "用一致的数据语言连接设备与应用。"],
  telemetry: ["时序数据", "按设备查询指标，定位异常发生的时刻。"],
  rules: ["规则与场景", "从数据条件到可追踪的运维行动。"],
  alarms: ["告警中心", "确认、分派与解决，形成完整处置记录。"],
  ota: ["固件与 OTA", "有范围、有进度、有恢复路径的版本交付。"],
  tenants: ["租户与成员", "明确成员职责、资源边界和使用配额。"],
  access: ["角色与权限", "将可执行的操作与职责匹配。"],
  connectors: ["连接与转发", "查看协议入口、连接状态与数据去向。"],
  audit: ["审计与运维", "每一次关键操作都有可追踪的上下文。"],
  settings: ["设置与集成", "控制工作区偏好与外部集成边界。"],
  nodes: ["全球节点", "以地域与节点维度查看接入健康。"],
  learning: ["学习与交付", "同一业务标准，三种框架独立惯用实现。"],
};
export const navGroups: [string, [string, string, string][]][] = [
  [
    "运行视图",
    [
      ["workspace", "◫", "工作区"],
      ["alarms", "△", "告警中心"],
      ["telemetry", "∿", "时序数据"],
      ["nodes", "◎", "全球节点"],
    ],
  ],
  [
    "资产与自动化",
    [
      ["devices", "▤", "设备中心"],
      ["products", "⬡", "产品与物模型"],
      ["rules", "⑂", "规则与场景"],
      ["ota", "↑", "固件与 OTA"],
      ["connectors", "⇄", "连接与转发"],
    ],
  ],
  [
    "组织与治理",
    [
      ["tenants", "▦", "租户与成员"],
      ["access", "◇", "角色与权限"],
      ["audit", "≡", "审计与运维"],
      ["settings", "⚙", "设置与集成"],
    ],
  ],
  ["工程教学", [["learning", "⌘", "学习与交付"]]],
];
export const icons: Record<string, string> = {
  workspace: "M3 3h7v7H3Z M14 3h7v7h-7Z M3 14h7v7H3Z M14 14h7v7h-7Z",
  alarms: "M12 3 2 21h20Z M12 8v6 M12 17v1",
  telemetry: "M2 14h4l3-8 5 13 3-9h5",
  nodes:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c-5 5-5 13 0 18 5-5 5-13 0-18",
  devices: "M4 3h16v18H4Z M8 7h8 M8 12h8 M8 17h5",
  products: "M12 2 3 7v10l9 5 9-5V7Z M3 7l9 5 9-5 M12 12v10",
  rules: "M5 5h4v4H5Z M15 15h4v4h-4Z M7 9v8h8 M15 3h4v4h-4Z M9 7h8",
  ota: "M12 17V3 M7 8l5-5 5 5 M4 16v5h16v-5",
  connectors: "M3 7h17 M16 3l4 4-4 4 M21 17H4 M8 13l-4 4 4 4",
  tenants: "M3 21V7h8v14 M11 3h10v18 M6 11h2 M6 15h2 M15 7h2 M15 11h2 M15 15h2",
  access: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z M8 12l3 3 5-6",
  audit: "M5 5h14 M5 10h14 M5 15h14 M5 20h9",
  settings:
    "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8 M12 1v4 M12 19v4 M1 12h4 M19 12h4 M4 4l3 3 M17 17l3 3 M4 20l3-3 M17 7l3-3",
  learning: "M8 5 2 12l6 7 M16 5l6 7-6 7 M14 3l-4 18",
};
