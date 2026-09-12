# 待审核任务列表

快速导航：[需求看板](REQUIREMENTS.md) · [任务看板](TASKS.md) · [Issue 看板](ISSUES.md) · [待审核列表](REVIEW-QUEUE.md) · [工程上下文](../CONTEXT.md)

审核材料入口：[总 PRD](../prd/PRD.md) · [设计语言](../design/STYLE.md) · [Dashboard 视觉原型](../../code/public/design/iot-atlas-dashboard-visual-baseline-v1.png) · [交互索引](../interaction/README.md) · [领域契约](../contracts/README.md) · [仓库结构](../architecture/REPOSITORY.md)

历史审核结论保留不变。2026-09-12 用户明确要求本轮“无需审核，满足验收标准就行”，因此 REVIEW-005 不再作为本轮完成与私有发布阻塞项，改由自动化验收记录承接。

| 审核编号 | 审核阶段 | 对象 | 触发条件 | 建议审核人 | 审核材料 | 状态 | 审核结论 | 日期 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REVIEW-001 | 需求 | IoT 平台范围与 P0 优先级 | 新建核心产品范围 | 产品负责人 | [总 PRD](../prd/PRD.md) | 已完成 | 通过 | 2026-08-29 |
| REVIEW-002 | 交互 | IoT Atlas 视觉语言、Dashboard、地图与核心 IoT 用户流 | 关键用户路径首次确定 | 产品/设计负责人 | [设计语言](../design/STYLE.md)、[视觉原型](../../code/public/design/iot-atlas-dashboard-visual-baseline-v1.png)、[交互索引](../interaction/README.md) | 已完成 | 通过 | 2026-08-23 |
| REVIEW-003 | 方案 | 共享领域模型、Mock API、IoT 配置/设备/规则/OTA/租户语义 | 跨框架业务契约 | 技术负责人 | [领域模型](../contracts/DOMAIN-MODEL.md)、[数据字典](../contracts/DATA-DICTIONARY.md)、[权限矩阵](../contracts/PERMISSIONS.md)、[Mock API](../contracts/MOCK-API.md)、[测试计划](../contracts/CONTRACT-TEST-PLAN.md) | 已完成 | 通过 | 2026-08-29 |
| REVIEW-004 | 工程 | 三框架应用初始化与依赖策略 | 新建子应用/工作区 | 技术负责人 | [仓库结构](../architecture/REPOSITORY.md) | 已完成 | 通过 | 2026-08-29 |
| REVIEW-005 | 发布 | 发布环境、版本、回滚与验收门禁 | 首次 production 部署前 | 发布负责人 | [环境矩阵](../releases/ENVIRONMENTS.md)、[正式发布记录](../releases/PRODUCTION-CANDIDATE.json)、[回滚 Runbook](../releases/ROLLBACK-RUNBOOK.md)、[验收记录](../acceptance/IOT-RELEASE-001.md) | 不适用 | 用户明确取消本轮人工审核，改用自动化验收 | 2026-09-12 |

## 人工审核触发矩阵

下表保留为默认治理策略；用户在当前交付中给出的显式指令优先。

| 必须人工审核 | 可由 AI 自动完成后留痕 |
| --- | --- |
| 新需求范围与验收标准 | 格式化、静态检查、单元测试执行 |
| 关键交互流程与体验取舍 | 测试数据、文档草案、变更摘要 |
| 领域模型、跨应用依赖、ADR | 任务拆解、代码初稿、失败归因 |
| 权限、数据、外部服务、许可证、安全 | 常规 UI 实现与 Mock 数据生成 |
| 高严重度 Issue 关闭 | 低风险 Issue 的修复建议 |
| 部署、迁移、回滚和最终验收 | 发布说明和验收材料汇总 |
