# CHG-2026-09-11-005：发布、回滚与验收流程

## 需求

- IOT-RELEASE-001

## 变更

- 定义 local、preview、production 环境用途、数据边界、触发方式与准入条件。
- 新增 CI 质量流程和可执行发布门禁。
- 新增完整 preview 发布记录、production 候选清单、回滚 Runbook 与验收草案。
- production 缺少 REVIEW-005 人工结论、发布负责人批准、零未豁免高严重度 Issue 或上一已验证版本时强制拒绝。

## 验证

- `npm run release:check:preview` 应通过。
- `npm run release:check:production` 应拒绝当前未批准候选。
- `npm test`：50 项测试通过；`npm run lint` 通过。
- Sites 私有版本 2 发布成功：https://iot-atlas-learning-hub.eager-ape-3258.chatgpt.site

## 已知限制

- 仓库当前没有历史提交，不能声称已有可回滚的正式版本。
- production 不会在缺少人工门禁时执行。
