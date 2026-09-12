# 验收记录：IOT-RELEASE-001

## 范围

local、preview、production 环境边界，机器门禁，预览发布记录，回滚 Runbook 与最终验收材料。

## 关联证据

| 阶段 | 产物/链接 | 结论 |
| --- | --- | --- |
| 需求 | `docs/prd/features/12-release-acceptance.md` | 已覆盖 |
| 方案 | `docs/releases/ENVIRONMENTS.md` | 已覆盖 |
| 开发 | `code/scripts/release-gate.mjs`、CI 工作流 | 已实现 |
| 测试 | `code/tests/release-gate.test.mjs` | 46 项测试与 ESLint 通过；preview 准入、production 缺门禁拒绝 |
| 部署 | `docs/releases/PREVIEW-2026-09-11.json` | 私有 preview 已发布：https://iot-atlas-learning-hub.eager-ape-3258.chatgpt.site |
| 回滚 | `docs/releases/ROLLBACK-RUNBOOK.md` | 已覆盖 |

## 验收结论

- 结论：待人工验收
- 验收人：待填写
- 日期：待填写
- 遗留项与接受条件：REVIEW-005 和 production 发布负责人批准不得由 AI 代填。
