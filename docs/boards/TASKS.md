# 任务看板

快速导航：[需求看板](REQUIREMENTS.md) · [任务看板](TASKS.md) · [Issue 看板](ISSUES.md) · [待审核列表](REVIEW-QUEUE.md) · [当前计划](../plans/ACTIVE.md)

实施入口：[Dashboard 代码](../../code/app/) · [共享领域包](../../code/packages/domain/) · [Mock API 包](../../code/packages/mock-api/) · [三框架应用](../../code/apps/) · [测试目录](../../code/tests/)

| 编号 | 关联需求 | 任务 | 阶段 | 状态 | 执行者 | AI 辅助 | 验收/证据 | 人工审核 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-001 | IOT-PLATFORM-001 | 建立 PRD、架构和路线图 | 需求 | 已完成 | AI | 文档初稿与一致性检查 | [文档入口](../CONTEXT.md) | 待审核 |
| TASK-002 | IOT-DASH-001 | 建立 Dashboard 基线 | 开发 | 已完成 | AI | UI 草案与构建修复 | [Dashboard 代码](../../code/app/) | 待审核 |
| TASK-003 | IOT-QUALITY-001 | 迁移模板测试 | 测试 | 已完成 | AI | 测试用例调整 | [测试目录](../../code/tests/) | 已验证 |
| TASK-007 | IOT-PLATFORM-001 | 基于需求看板生成正式 PRD v1.0 | 需求 | 已完成 | AI | 结构化需求、验收与追溯矩阵 | [总 PRD](../prd/PRD.md)、[变更记录](../changes/CHG-2026-08-23-001-prd-v1.md) | 待审核 |
| TASK-004 | IOT-PLATFORM-004 | 建立完整交付流程与看板 | 方案设计 | 已完成 | AI | 流程建模与模板生成 | [交付流程](../process/DELIVERY-LIFECYCLE.md)、[看板说明](README.md) | 待审核 |
| TASK-005 | IOT-DOMAIN-001 | 设计领域实体与 Mock API 契约 | 方案设计 | 已完成 | AI | 领域模型、数据字典、权限、API 与契约测试计划 | [领域契约](../contracts/README.md) | REVIEW-003：通过 |
| TASK-006 | IOT-RELEASE-001 | 设计发布环境、版本、回滚与发布检查清单 | 完成 | 已完成 | AI | 环境矩阵、机器门禁与回滚风险分析 | [发布材料](../releases/ENVIRONMENTS.md) | 自动化验收通过 |
| TASK-008 | IOT-PLATFORM-001 | 基于需求看板拆分全部模块详细 PRD | 需求 | 已完成 | AI | 模块拆分、验收条件与追溯生成 | [详细 PRD 索引](../prd/README.md) | 待审核 |
| TASK-009 | IOT-PLATFORM-001 | 基于模块 PRD 生成全部交互规格 | 交互 | 已完成 | AI | 用户流、状态、异常、权限与验收映射 | [交互索引](../interaction/README.md) | 待审核 |
| TASK-010 | IOT-DASH-001 | 生成并固化统一视觉交互基线 | 交互 | 已完成 | AI | 视觉原型生成、设计语言提炼、Dashboard 令牌同步 | [视觉原型](../../code/public/design/iot-atlas-dashboard-visual-baseline-v1.png)、[设计语言](../design/STYLE.md) | 待审核 |
| TASK-011 | IOT-DOMAIN-001 | 实现共享领域包与固定 seed Mock API | 验收准备 | 已完成 | AI | 确定性数据、权限、异常场景和无框架契约测试 | [领域包](../../code/packages/domain/)、[Mock API 包](../../code/packages/mock-api/)、[契约测试](../../code/tests/mock-api.test.mjs) | REVIEW-003：通过 |
| TASK-012 | IOT-GEO-001 | 实现地理筛选、节点聚合与未定位设备契约 | 开发 | 已完成 | AI | 共享 DTO、固定 seed 查询、三端摘要适配与 12 项回归测试 | [Mock API 包](../../code/packages/mock-api/)、[契约测试](../../code/tests/mock-api.test.mjs)、[变更记录](../changes/CHG-2026-09-07-001-geo-contract.md) | REVIEW-002、REVIEW-003：通过 |
| TASK-013 | IOT-PRODUCT-001 | 实现产品查询、物模型校验与 DP 分步试运行 | 验收准备 | 已完成 | AI | 共享 DTO、确定性查询、命令校验与三端工作台 | [产品变更](../changes/CHG-2026-09-09-001-product-contract.md) | REVIEW-003：通过 |
| TASK-014 | IOT-PLATFORM-003 | 三框架独立工程与 TypeScript 门禁 | 验收准备 | 已完成 | AI | 三端构建、共享契约、无输出类型检查 | [基线测试](../../code/tests/framework-baseline.test.mjs)、[类型配置](../../code/tsconfig.verify.json) | REVIEW-004：通过 |
| TASK-015 | IOT-DASH-001 | 完成 Dashboard 聚合、联动、异常态与事件控制 | 验收准备 | 已完成 | AI | 共享查询、三端实现和响应式布局 | [Dashboard 变更](../changes/CHG-2026-09-11-007-dashboard-acceptance.md) | REVIEW-002：通过 |
| TASK-016 | IOT-DEVICE-001 | 完成设备管理与时序诊断 | 验收准备 | 已完成 | AI | 复合筛选、诊断页、时序/消息/告警/控制 | [实现审计](../acceptance/CURRENT-IMPLEMENTATION-AUDIT.md) | REVIEW-003：通过 |
| TASK-017 | IOT-RULE-001 | 完成规则引擎契约与三端工作台 | 验收准备 | 已完成 | AI | 图校验、trace、事件与日志 | [实现审计](../acceptance/CURRENT-IMPLEMENTATION-AUDIT.md) | REVIEW-003：通过 |
| TASK-018 | IOT-FIRMWARE-001、IOT-OTA-001 | 完成固件与 OTA 生命周期 | 验收准备 | 已完成 | AI | 校验、引用保护、灰度、阈值、重试和回滚 | [实现审计](../acceptance/CURRENT-IMPLEMENTATION-AUDIT.md) | REVIEW-003：通过 |
| TASK-019 | IOT-TENANT-001 | 完成租户、成员、角色与配额 | 验收准备 | 已完成 | AI | 隔离、权限预览、硬配额和三端工作台 | [实现审计](../acceptance/CURRENT-IMPLEMENTATION-AUDIT.md) | REVIEW-003：通过 |
| TASK-020 | IOT-LEARNING-001 | 完成三端组件与图表实验室 | 验收准备 | 已完成 | AI | Top 3 UI 库、三图表引擎和独立构建 | [实验室变更](../changes/CHG-2026-09-11-006-learning-labs.md) | REVIEW-004：通过 |
| TASK-021 | IOT-RELEASE-001 | 完成 preview 发布、门禁和验收草案 | 完成 | 已完成 | AI | 私有 preview 3、发布清单、负向 production 门禁 | [预览记录](../releases/PREVIEW-2026-09-11.json) | 自动化验收通过 |
| TASK-022 | IOT-PLATFORM-003、IOT-RELEASE-001 | 将三端生产构建接入学习门户并完成正式私有发布 | 完成 | 已完成 | AI | 三端静态入口、相对资源路径、62 项自动化测试、四入口运行态冒烟与 Sites 私有版本 5 | [正式发布记录](../releases/PRODUCTION-CANDIDATE.json) | 用户授权自动化验收通过 |

任务在开始前必须关联一个需求；无法关联时先创建或更新需求。每一次状态变更追加到对应变更记录。
