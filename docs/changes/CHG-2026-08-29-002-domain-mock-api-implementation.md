# 变更记录：CHG-2026-08-29-002

- 日期：`2026-08-29`
- 阶段：开发
- 关联需求：`IOT-DOMAIN-001`
- 关联任务：`TASK-011`
- 执行者：AI
- 变更摘要：新增无框架领域类型、权限校验、分页与时间范围校验，以及固定 seed 的 Mock API。
- 已实现能力：Dashboard、设备列表、地域拓扑、时序查询、设备控制；包含 forbidden、slow、offline 等场景错误。
- 影响范围：[领域包](../../code/packages/domain/)、[Mock API 包](../../code/packages/mock-api/)、[契约测试](../../code/tests/mock-api.test.mjs)。
- 验证证据：`node --experimental-strip-types --test tests/mock-api.test.mjs` 通过；共享包的 `tsc --noEmit` 检查无错误；`npm.cmd test` 通过（构建成功，5 个测试全部通过）。
- 已知限制：命令服务当前演示创建/试运行结果，不持久化浏览器会话状态；完整工程的 TypeScript 检查受既有 Cloudflare Worker 类型配置影响，见 ISSUE-004。
