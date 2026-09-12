# PRD：三框架工程与组件/图表实验室

| 项目 | 内容 |
| --- | --- |
| 需求编号 | IOT-PLATFORM-003、IOT-LEARNING-001 |
| 优先级 | P0 / P2 |
| 状态 | 已完成（2026-09-12 自动化验收通过） |
| 审核门禁 | REVIEW-004 |

## 目标与边界

建立 React、Vue、Angular 三个独立、可运行、可构建、可测试的 IoT 前端工程；以相同业务契约对比框架差异。实验室用于对比控件库和图表库，不作为生产业务页面的混合依赖。

## 工程与页面要求

- 应用位置：[React](../../../code/apps/react/)、[Vue](../../../code/apps/vue/)、[Angular](../../../code/apps/angular/)；共享包位于[packages](../../../code/packages/)。
- 每端实现相同一级路由、主题策略、权限语义、Mock 适配、Dashboard 和核心设备流。
- 主 UI：React/MUI、Vue/Element Plus、Angular/Angular Material。
- UI 实验室：分别展示各框架 Top 3 热门组件库的表格、表单、弹窗、导航和主题能力。
- 图表实验室：用相同数据集分别实现 ECharts、Chart.js、D3.js 的趋势、柱状、饼图和性能/体积说明。

## 业务规则

- 框架之间共享领域类型、Mock API、种子和设计令牌，不共享组件源码、状态实现或框架运行时。
- 一个业务页面只加载一个主 UI 库；实验室页面必须隔离样式作用域和依赖说明。
- 任一框架故障不得阻塞其他框架启动和测试。

## 验收条件

- Given 相同 seed、租户和时间范围，When 在三端查询大盘，Then 关键业务值一致。
- Given 打开组件实验室，When 切换库示例，Then 不影响业务大盘的样式或功能。
- Given 任一应用执行构建，When 其他应用未安装或失败，Then 该应用仍可独立构建。

## 依赖与风险

依赖 IOT-DOMAIN-001 定稿；依赖版本、工作区工具和安装策略由 REVIEW-004 决定。生态“Top 3”需在[生态研究](../../research/README.md)记录统计日期和口径。
