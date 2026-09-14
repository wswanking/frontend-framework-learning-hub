# CHG-2026-09-14-001：统一交互 V2 归档

## 关联范围

- 需求：IOT-PLATFORM-003、IOT-DASH-001、IOT-GEO-001、IOT-PRODUCT-001、IOT-DEVICE-001、IOT-RULE-001、IOT-FIRMWARE-001、IOT-OTA-001、IOT-TENANT-001、IOT-LEARNING-001
- 任务：TASK-023、TASK-024
- 审核：REVIEW-006

## 变更

- 将 01–10 号完整交互评审图归档到 `code/public/design/interaction-v2/`。
- 新增 [统一交互 V2 评审索引](../interaction/UNIFIED-V2.md)，关联每张图与对应文字规格。
- 保留既有 V1 视觉资产，不覆盖、不删除历史文件。
- 撤销“机器检查等同于交互一致性验收”的旧结论；三端实现继续保留为历史实现，等待用户审核 V2 后整改。

## 生成信息

- 工具：OpenAI 内置 ImageGen。
- 模式：`ui-mockup`。
- 输入：项目既有五张 V1 视觉原型，以及 10 个功能域的交互规格。
- 输出：10 张 1672 × 941 PNG。

## 验证

- 10 个预期文件均存在且可由 PNG 解码器读取。
- 所有图片尺寸一致为 1672 × 941。
- SHA-256 清单见 [`SHA256SUMS`](../../code/public/design/interaction-v2/SHA256SUMS)。
- Markdown 相对链接与 Git 差异检查通过。

## 已知限制

- 图片中的文案和控件细节是评审稿，不代表已完成的三端实现。
- REVIEW-006 未经用户明确通过前，不得标记为最终交互基线或完成最终验收。
