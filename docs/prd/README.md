# PRD 文档索引

`PRD.md` 是产品总控说明；本目录下的 `features/` 是实施时使用的模块级详细 PRD。开发任务必须同时引用总需求与模块需求编号。

## 平台与交付

| 文档 | 编号 | 审核 |
| --- | --- | --- |
| [工程治理与 AI 协作](features/01-platform-governance.md) | IOT-PLATFORM-001、IOT-PLATFORM-002、IOT-PLATFORM-004 | REVIEW-001 |
| [领域与 Mock 规范](features/02-domain-mock.md) | IOT-DOMAIN-001 | REVIEW-003 |
| [三框架工程与实验室](features/11-framework-labs.md) | IOT-PLATFORM-003、IOT-LEARNING-001 | REVIEW-004 |
| [发布、回滚与验收](features/12-release-acceptance.md) | IOT-RELEASE-001 | REVIEW-005 |

## IoT 业务模块

| 文档 | 编号 | 审核 |
| --- | --- | --- |
| [数据大盘](features/03-dashboard.md) | IOT-DASH-001 | REVIEW-002 |
| [全球节点与地理分析](features/04-global-topology.md) | IOT-GEO-001 | REVIEW-002 |
| [产品、物模型与 DP 规则](features/05-product-thingmodel.md) | IOT-PRODUCT-001 | REVIEW-003 |
| [设备管理与时序数据](features/06-device-telemetry.md) | IOT-DEVICE-001 | REVIEW-003 |
| [规则引擎](features/07-rule-engine.md) | IOT-RULE-001 | REVIEW-003 |
| [固件文件管理](features/08-firmware.md) | IOT-FIRMWARE-001 | REVIEW-003 |
| [OTA 升级演示](features/09-ota.md) | IOT-OTA-001 | REVIEW-003 |
| [租户、成员与配额](features/10-tenant.md) | IOT-TENANT-001 | REVIEW-003 |

## 统一章节约定

每份模块 PRD 都包含：目标和边界、角色与权限、页面/交互、字段与业务规则、异常状态、验收条件、依赖/风险和审核门禁。验收条件使用可测试的 Given / When / Then 表述。
