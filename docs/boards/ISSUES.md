# Issue 看板

快速导航：[需求看板](REQUIREMENTS.md) · [任务看板](TASKS.md) · [Issue 看板](ISSUES.md) · [待审核列表](REVIEW-QUEUE.md) · [当前计划](../plans/ACTIVE.md)

关联材料：[总 PRD](../prd/PRD.md) · [领域契约](../contracts/README.md) · [交付流程](../process/DELIVERY-LIFECYCLE.md)

| 编号 | 类型 | 标题 | 严重度 | 状态 | 关联需求/任务 | 复现或影响 | 负责人 | 处理证据 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ISSUE-001 | 工程风险 | 三框架尚未初始化，不能声称具备跨框架一致性 | 高 | 已关闭 | IOT-PLATFORM-003 / TASK-014 | 三端可独立构建、共享确定性契约并由门户直接访问 | AI | [三端基线测试](../../code/tests/framework-baseline.test.mjs) |
| ISSUE-002 | 质量 | 未建立真实 Mock 契约与固定 seed 数据 | 高 | 已关闭 | IOT-DOMAIN-001 / TASK-011 | 共享领域与 Mock API 已覆盖核心查询、命令、权限和错误语义 | AI | [契约测试](../../code/tests/mock-api.test.mjs) |
| ISSUE-003 | 发布风险 | 当前项目仅本地运行，未设计发布与回滚流程 | 中 | 已关闭 | IOT-RELEASE-001 / TASK-022 | 环境矩阵、CI、正式记录、机器门禁、回滚 Runbook 与 Sites 私有发布齐全 | AI | [正式发布记录](../releases/PRODUCTION-CANDIDATE.json)、[门禁测试](../../code/tests/release-gate.test.mjs) |
| ISSUE-004 | 工程质量 | 全仓 TypeScript 检查缺少 Cloudflare Worker 类型并尝试写入增量缓存 | 中 | 已关闭 | IOT-PLATFORM-003 | 新增无输出、无增量缓存的源码检查配置，并纳入本地测试与 CI | AI | [TypeScript 配置](../../code/tsconfig.verify.json)、[CI](../../.github/workflows/quality-and-release-gate.yml) |

Issue 关闭前必须记录根因、修复、验证方式和关联需求/任务。本轮按用户明确授权，以自动化验收证据关闭已修复 Issue。
