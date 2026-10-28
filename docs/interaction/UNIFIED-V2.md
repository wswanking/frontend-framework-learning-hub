# IoT Atlas 统一交互 V2 评审包

> 2026-10-28：默认工作区依据已批准 [V3设计](../../交互/DESIGN.md) 与 [实施契约](V3-IMPLEMENTATION.md) 重建；本文件保留为旧教学兼容路由依据，冲突处以V3为准。

> 2026-09-16：保留交互基线与全部图稿，应用代码已清理，三端待按独立维护架构重新实现。

## 状态

**已批准进入实施。** 2026-09-14，用户要求根据当前交互落地 React、Vue、Angular 三端页面并完成浏览器调试与功能验收。本评审包成为本轮统一实现基线；实现完成仍需以运行态证据单独验收。

## 一致性约束

- 根首页只显示 React、Vue、Angular 三个应用入口。
- 三端使用相同的信息架构、页面布局、导航顺序、字段、状态、权限和操作流程。
- 框架差异只允许体现在主 UI 库的微观组件风格，不得改变页面结构或业务交互。
- 通用路径统一为“草稿筛选 → 应用 → 列表 → 详情抽屉 → 详情页/工作台 → 操作反馈”。
- 加载、空数据、局部失败、无权限、未保存变更和危险操作确认在三端语义一致。

## 图稿索引

| 编号 | 功能域 | 视觉评审稿 | 关联规格 | 状态 |
| --- | --- | --- | --- | --- |
| 01 | 首页与全局壳层 | [查看 PNG](assets/interaction-v2/01-home-global-shell.png) | [交互原则](00-principles.md) | 已批准实施 |
| 02 | 数据大盘 | [查看 PNG](assets/interaction-v2/02-dashboard.png) | [数据大盘](01-dashboard.md) | 已批准实施 |
| 03 | 全球节点 | [查看 PNG](assets/interaction-v2/03-global-topology.png) | [全球节点地图](02-global-topology.md) | 已批准实施 |
| 04 | 产品、物模型与 DP | [查看 PNG](assets/interaction-v2/04-product-thingmodel-dp.png) | [产品、物模型与 DP](03-product-thingmodel.md) | 已批准实施 |
| 05 | 设备、时序与控制 | [查看 PNG](assets/interaction-v2/05-device-telemetry-control.png) | [设备与时序](04-device-telemetry.md) | 已批准实施 |
| 06 | 规则引擎 | [查看 PNG](assets/interaction-v2/06-rule-engine.png) | [规则引擎](05-rule-engine.md) | 已批准实施 |
| 07 | 固件与 OTA | [查看 PNG](assets/interaction-v2/07-firmware-ota.png) | [固件与 OTA](06-firmware-ota.md) | 已批准实施 |
| 08 | 租户管理 | [查看 PNG](assets/interaction-v2/08-tenant-management.png) | [租户与配额](07-tenant.md) | 已批准实施 |
| 09 | 框架实验室 | [查看 PNG](assets/interaction-v2/09-framework-labs.png) | [框架实验室](08-framework-labs.md) | 已批准实施 |
| 10 | 交付看板 | [查看 PNG](assets/interaction-v2/10-delivery-board.png) | [交付看板与发布](09-delivery-boards.md) | 已批准实施 |

## 归档信息

- 生成方式：OpenAI 内置 ImageGen，`ui-mockup` 用例。
- 视觉输入：项目既有五张 V1 原型作为风格与布局参考。
- 归档目录：`docs/interaction/assets/interaction-v2/`。
- 归档日期：2026-09-14。
- V1 文件保留不变，V2 未覆盖任何既有资产。

## 审核记录

审核意见应按编号记录，例如“04 通过；05 控制预览需调整”。仅在用户明确确认后，才更新状态并进入三端实现。

## M1 导航补充（2026-10-18）

桌面顶栏和侧栏固定，页面加载及切换只影响内容区；800px 及以下导航默认收起。菜单按钮提供展开状态，Escape 收起并返回按钮焦点，成功导航后同样收起。活动项由路由决定，未知路径保持壳层并显示“页面不存在”。设备详情通过 `?device=` 进入历史记录，返回列表恢复触发焦点；触发控件不存在时不聚焦已移除节点。路由跳转、后退、前进均遵循未保存确认，刷新使用浏览器原生确认文案。此补充来自用户本轮已授权方案，不构成新增视觉基准批准。
