# 交互规格索引

本目录保存交互的需求关联与审核说明；**视觉原型图才是交互主交付物**，统一存放在[视觉资产目录](../../code/public/design/)。Markdown 不再作为最终视觉稿，只保留实现需要的行为、状态和验收注释。

| 文档 | 关联需求 | 审核 |
| --- | --- | --- |
| [交互原则](00-principles.md) | 全局 | REVIEW-002 |
| [数据大盘](01-dashboard.md) | IOT-DASH-001 | REVIEW-002 |
| [全球节点地图](02-global-topology.md) | IOT-GEO-001 | REVIEW-002 |
| [产品、物模型与 DP](03-product-thingmodel.md) | IOT-PRODUCT-001 | REVIEW-003 |
| [设备与时序](04-device-telemetry.md) | IOT-DEVICE-001 | REVIEW-003 |
| [规则引擎](05-rule-engine.md) | IOT-RULE-001 | REVIEW-003 |
| [固件与 OTA](06-firmware-ota.md) | IOT-FIRMWARE-001、IOT-OTA-001 | REVIEW-003 |
| [租户与配额](07-tenant.md) | IOT-TENANT-001 | REVIEW-003 |
| [框架实验室](08-framework-labs.md) | IOT-LEARNING-001 | REVIEW-004 |
| [交付看板与发布](09-delivery-boards.md) | IOT-PLATFORM-001、IOT-PLATFORM-002、IOT-RELEASE-001 | REVIEW-001、REVIEW-005 |

“待审核”状态的交互规格仅作为草案；人工结论前不得把关键取舍视为最终设计。

视觉基线与可复用设计语言见 [`../design/STYLE.md`](../design/STYLE.md)。

当前可评审的视觉原型位于[视觉资产目录](../../code/public/design/)：全球运营、产品物模型、设备/OTA、规则引擎和交付看板。实现页面应先对齐这些原型的结构与令牌，再补充细节。
