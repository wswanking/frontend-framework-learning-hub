# IoT Atlas 视觉语言 v1

## 设计主张

**“信号地形（Signal Terrain）”**：用深色、分层、低噪声的工业数据界面呈现全球 IoT 信号流动。界面不追求赛博装饰，而强调“可观测、可定位、可行动”。

## 视觉基线

主视觉原型：[`../../code/public/design/iot-atlas-dashboard-visual-baseline-v1.png`](../../code/public/design/iot-atlas-dashboard-visual-baseline-v1.png)。所有后续交互图和最终页面必须以此作为布局密度、信息层级和色彩方向的基线，而非逐像素复制。

## 已生成的视觉交互基线

| 场景 | 视觉资产 | 关联需求 |
| --- | --- | --- |
| 全球运营大盘与地图下钻 | [视觉原型](../../code/public/design/iot-atlas-dashboard-visual-baseline-v1.png) | IOT-DASH-001、IOT-GEO-001 |
| 产品物模型与 DP 编辑 | [视觉原型](../../code/public/design/iot-atlas-product-thingmodel-visual-v1.png) | IOT-PRODUCT-001 |
| 设备时序与 OTA 监控 | [视觉原型](../../code/public/design/iot-atlas-device-ota-visual-v1.png) | IOT-DEVICE-001、IOT-OTA-001 |
| 可视化规则引擎 | [视觉原型](../../code/public/design/iot-atlas-rule-engine-visual-v1.png) | IOT-RULE-001 |
| 交付看板与人工审核 | [视觉原型](../../code/public/design/iot-atlas-delivery-control-visual-v1.png) | IOT-PLATFORM-001、IOT-PLATFORM-002、IOT-RELEASE-001 |

## 设计令牌

| 语义 | 暗色 | 亮色 | 用途 |
| --- | --- | --- | --- |
| 画布 | `#07131C` | `#F4F7F9` | 页面背景 |
| 表面 | `#0D1E2A` | `#FFFFFF` | 面板、抽屉 |
| 浮层 | `#132A38` | `#F8FAFC` | 筛选、悬浮卡片 |
| 边框 | `#24404E` | `#DCE5EA` | 低对比结构线 |
| 主信号 | `#22D3EE` | `#078EA6` | 选中、主趋势、交互焦点 |
| 健康 | `#36D399` | `#108A63` | 在线、成功 |
| 注意 | `#F5B942` | `#B7791F` | 警告、待处理 |
| 风险 | `#FB6A79` | `#C93549` | 告警、失败、破坏操作 |
| 主文字 | `#EAF5F8` | `#17232C` | 标题、核心数值 |
| 次文字 | `#91A7B1` | `#60737D` | 元数据、辅助说明 |

## 布局与层级

- 左侧导航为稳定定位锚点；顶部仅承载全局上下文和低频操作。
- 内容采用 8px 间距体系，面板圆角 12px，边框弱于内容层级。
- 首屏必须优先显示“状态概览 + 可下钻的异常/地域信号”，而非普通后台表格。
- KPI 使用大数值、小解释和语义趋势；图表使用一条主信号色，告警色只表示异常。
- 地图是拓扑工作台：节点发光、连线克制、详情从右侧抽屉进入，不使用装饰性 3D 地球。

## 交互语言

- 筛选应用后只对受影响区域显示骨架，保留已有可读内容。
- 选择状态使用主信号色、边框和图标，不依赖填充色。
- 危险操作使用风险色和影响范围确认；成功操作提供简洁确认与可回看记录。
- 表格、图表、地图都有相同的数据层级：摘要 → 详情抽屉 → 独立详情页。

## 适配约束

- React、Vue、Angular 的最终实现共用语义令牌和信息架构，但允许遵从各组件库的本地模式。
- 交互视觉产物以 PNG/WebP 原型图为主，放在[视觉资产目录](../../code/public/design/)；Markdown 只保存需求关联、审核和实现说明，不再作为视觉稿。
- 新的视觉资产必须标注版本、关联需求和与本设计语言的差异；重大视觉偏离进入 REVIEW-002。
