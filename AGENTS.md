# IoT Atlas：AI 协作工程约定

开始任何实现前阅读本文件。

## 项目目标

以 React、Vue、Angular 分别实现同一套纯前端物联网 SaaS 演示平台。所有业务数据由可复现的 Mock API 提供；平台覆盖全球数据大盘、产品与物模型、DP 规则、设备、时序数据、规则引擎、固件、OTA 与租户管理。

## 信息源优先级

1. 用户在当前对话中的最新指令。
2. [总 PRD](docs/prd/PRD.md)：业务范围、需求编号与验收标准。
3. [架构文档](docs/architecture/CONTEXT.md)：架构边界、目录职责与技术决策。
4. [当前计划](docs/plans/ACTIVE.md)：当前阶段、进行中的任务和下一步。
5. [架构决策](docs/decisions/ADR-001-ai-driven-workflow.md)：已确认的架构决策。
6. [交付流程](docs/process/DELIVERY-LIFECYCLE.md) 与 [工程看板](docs/boards/README.md)：当前交付阶段、门禁和待审核事项。

业务实现与文档冲突时，以 PRD 为准；PRD 与用户最新指令冲突时，以用户指令为准，并立即回写 PRD。

## 目录边界

| 目录 | 允许放置的内容 |
| --- | --- |
| `docs/` | 需求、决策、架构、计划、验收、研究与教学文档；禁止运行时代码。 |
| [code/app](code/app/) | 当前可部署的学习门户与 Dashboard 基线代码。 |
| [code/apps](code/apps/) | React、Vue、Angular 三个独立可运行应用；禁止跨应用直接引用 UI 组件。 |
| [code/packages/domain](code/packages/domain/) | 无框架依赖的实体、DTO、枚举、纯函数和校验。 |
| [code/packages/mock-api](code/packages/mock-api/) | 固定 seed 的数据、查询、命令、错误和实时事件模拟。 |
| [code/packages/design-tokens](code/packages/design-tokens/) | 语义设计令牌；各框架自行适配各自 UI 库。 |
| [code/tests](code/tests/) | 与产品现状一致的自动化验证；禁止保留模板断言。 |

## AI 开发循环

1. 阅读 [工程上下文](docs/CONTEXT.md)、PRD、当前计划、交付流程、待审核列表和关联 ADR。
2. 将任务映射到 `IOT-*` 需求编号；若无编号，先补 PRD。
3. 在 [当前计划](docs/plans/ACTIVE.md) 写明目标、影响范围、验收方式和状态。
4. 先修改共享领域契约和 Mock API，再按框架实现适配层与 UI。
5. 以最小可验证增量实现，不顺带重构无关模块。
6. 运行相称的检查；修复失败后再继续。
7. 回写看板、变更记录、测试/发布/验收证据和必要的 ADR。

## 人工审核门禁

AI 不得批准需求范围、关键交互、架构/领域模型、跨应用依赖、权限与安全、许可证、高严重度 Issue、部署/回滚或最终验收。此类事项必须创建或更新[待审核任务列表](docs/boards/REVIEW-QUEUE.md)中的条目，等待人工明确结论。

## 三框架一致性规则

- 三端共享 [领域包](code/packages/domain/) 与 [Mock API 包](code/packages/mock-api/) 的业务契约，不共享组件实现。
- 页面不得直接生成业务随机数据，必须传入显式 `seed`。
- 同一需求在三端保持相同字段、权限、状态和 Mock 结果。
- 完整应用只使用一套主 UI 库；其余热门库仅用于独立实验室页面。
- ECharts 是业务 Dashboard 默认图表；Chart.js 与 D3.js 用于对比实验。

## 完成定义

任务仅在需求、实现、验证与文档同步后才能标记完成。最终说明需求编号、检查、已知限制，以及三端是否均已实现。
