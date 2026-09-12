# 需求看板

快速导航：[需求看板](REQUIREMENTS.md) · [任务看板](TASKS.md) · [Issue 看板](ISSUES.md) · [待审核列表](REVIEW-QUEUE.md) · [工程上下文](../CONTEXT.md)

关键材料：[总 PRD](../prd/PRD.md) · [详细 PRD 索引](../prd/README.md) · [设计语言](../design/STYLE.md) · [领域契约](../contracts/README.md) · [仓库结构](../architecture/REPOSITORY.md)

| 编号 | 需求 | 优先级 | 当前阶段 | 状态 | 验收方式 | 关联证据 | 最后更新 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IOT-PLATFORM-001 | 工程上下文、PRD 与路线图 | P0 | 完成 | 已完成 | 文档追溯审计 | [工程上下文](../CONTEXT.md) | 2026-09-12 |
| IOT-PLATFORM-002 | AI 协作工程规范 | P0 | 完成 | 已完成 | 流程与看板审计 | [协作约定](../../AGENTS.md) | 2026-09-12 |
| IOT-DASH-001 | IoT Dashboard 学习门户基线 | P0 | 完成 | 已完成 | 三端构建与大盘契约测试 | [实现审计](../acceptance/CURRENT-IMPLEMENTATION-AUDIT.md) | 2026-09-12 |
| IOT-DOMAIN-001 | 共享领域模型与固定 seed Mock 数据 | P0 | 完成 | 已完成 | 领域契约测试 | [领域契约](../contracts/README.md)、[契约测试](../../code/tests/mock-api.test.mjs) | 2026-09-12 |
| IOT-PLATFORM-003 | 三框架独立工程初始化 | P0 | 完成 | 已完成 | 独立构建与门户可达性测试 | [三端源码](../../code/apps/)、[基线测试](../../code/tests/framework-baseline.test.mjs) | 2026-09-12 |
| IOT-RELEASE-001 | 本地、预览与正式发布流程及回滚预案 | P1 | 完成 | 已完成 | 用户授权的自动化发布门禁 | [正式发布记录](../releases/PRODUCTION-CANDIDATE.json)、[验收记录](../acceptance/IOT-RELEASE-001.md) | 2026-09-12 |
| IOT-GEO-001 | 全球节点与地理分析 | P0 | 完成 | 已完成 | 契约与三端标记测试 | [实现审计](../acceptance/CURRENT-IMPLEMENTATION-AUDIT.md) | 2026-09-12 |
| IOT-PRODUCT-001 | 产品、物模型与 DP 规则 | P0 | 完成 | 已完成 | 契约与三端标记测试 | [实现审计](../acceptance/CURRENT-IMPLEMENTATION-AUDIT.md) | 2026-09-12 |
| IOT-DEVICE-001 | 设备管理与时序数据 | P0 | 完成 | 已完成 | 契约与三端标记测试 | [实现审计](../acceptance/CURRENT-IMPLEMENTATION-AUDIT.md) | 2026-09-12 |
| IOT-RULE-001 | 规则引擎 | P1 | 完成 | 已完成 | 契约与三端标记测试 | [实现审计](../acceptance/CURRENT-IMPLEMENTATION-AUDIT.md) | 2026-09-12 |
| IOT-FIRMWARE-001 | 固件文件管理 | P1 | 完成 | 已完成 | 契约与三端标记测试 | [实现审计](../acceptance/CURRENT-IMPLEMENTATION-AUDIT.md) | 2026-09-12 |
| IOT-OTA-001 | OTA 升级演示 | P1 | 完成 | 已完成 | 状态机契约与三端标记测试 | [实现审计](../acceptance/CURRENT-IMPLEMENTATION-AUDIT.md) | 2026-09-12 |
| IOT-TENANT-001 | 租户、成员与配额 | P1 | 完成 | 已完成 | 隔离/权限契约与三端标记测试 | [实现审计](../acceptance/CURRENT-IMPLEMENTATION-AUDIT.md) | 2026-09-12 |
| IOT-LEARNING-001 | 控件库、图表库与框架对比实验室 | P2 | 完成 | 已完成 | 三端独立构建与实验标记测试 | [变更记录](../changes/CHG-2026-09-11-006-learning-labs.md) | 2026-09-12 |

新增需求必须先在 PRD 中定义，再写入本看板。需求完成前必须具备交互、方案、代码、测试、部署和验收的关联证据，纯文档类需求除外。
