# 工程上下文入口

本目录是 IoT Atlas 的长期记忆。所有实现前先读取本页及其链接；不要只根据当前页面代码推测业务规则。

## 阅读路线

| 场景 | 必读文档 |
| --- | --- |
| 任何开发任务 | [协作约定](../AGENTS.md)、[当前计划](plans/ACTIVE.md)、[总 PRD](prd/PRD.md) |
| 修改业务功能 | `prd/PRD.md`、`architecture/CONTEXT.md`、关联 ADR |
| 设计或实现页面 | `interaction/README.md`、关联模块 PRD、关联 ADR |
| 修改目录或依赖 | `architecture/REPOSITORY.md`、`decisions/` |
| 新增 Mock 数据或接口 | `architecture/CONTEXT.md`、`contracts/README.md` |
| 进入任何交付阶段 | `process/DELIVERY-LIFECYCLE.md`、`boards/REVIEW-QUEUE.md` |

## 文档地图

- `prd/`：产品事实、功能范围与验收标准。
- `architecture/`：系统边界、目录、数据流和技术约束。
- `plans/`：当前任务与阶段路线图；`ACTIVE.md` 是唯一进行中任务清单。
- `decisions/`：已确认且会影响后续实现的 ADR。
- `contracts/`：领域模型、Mock API 与跨框架契约说明。
- `research/`：会变化的生态排名、版本和调研日期。
- `process/`：AI 与人工协作的交付阶段、门禁与留痕规则。
- `boards/`：需求、任务、Issue 和待审核事项的当前状态。
- `interaction/`：页面布局、用户流、控件状态、异常与可访问性规格。

## 当前状态

共享领域包、固定 seed Mock API、React/Vue/Angular 三端业务工作台、Dashboard 验收交互、组件/图表实验室、全仓 TypeScript/构建/测试质量门禁和 Sites 私有 preview 均已建立。所有业务需求已达到“实现完成、待最终验收”；production 继续由 REVIEW-005 与发布负责人结论阻止。逐项事实以[当前实现审计](acceptance/CURRENT-IMPLEMENTATION-AUDIT.md)为准。
