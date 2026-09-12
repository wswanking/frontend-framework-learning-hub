# 验收记录：IOT-RELEASE-001

## 范围

local、preview、production 环境边界，机器门禁，正式发布记录，回滚 Runbook 与最终验收材料。

## 关联证据

| 阶段 | 产物/链接 | 结论 |
| --- | --- | --- |
| 需求 | `docs/prd/features/12-release-acceptance.md` | 已覆盖 |
| 方案 | `docs/releases/ENVIRONMENTS.md` | 已覆盖 |
| 开发 | `code/scripts/release-gate.mjs`、CI 工作流 | 已实现 |
| 测试 | `code/tests/release-gate.test.mjs`、`code/tests/framework-baseline.test.mjs` | 62 项测试与 ESLint 通过；preview/production 准入；缺自动化授权或回滚基线时 production 正确拒绝 |
| 部署 | `docs/releases/PRODUCTION-CANDIDATE.json` | Sites owner-private 正式版本 5 已发布：https://iot-atlas-learning-hub.eager-ape-3258.chatgpt.site |
| 回滚 | `docs/releases/ROLLBACK-RUNBOOK.md`、Sites 私有版本 3 | 已覆盖；上一验证版本为 `0.1.0-preview.3` |

## 验收结论

- 结论：自动化验收通过，正式私有发布成功
- 授权来源：用户在当前目标中明确要求“无需审核，满足验收标准就行”
- 验收执行者：Codex 自动化验收
- 日期：2026-09-12
- 正式版本：Sites 版本 5，提交 `901bd2d732b74a457b74ae5eef4d16613419987a`
- 遗留项：无阻塞项；大体积实验 chunk 和纯前端 Mock 边界已记录为已知限制
