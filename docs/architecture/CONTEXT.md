# 工程上下文

## 仓库职责

- `app/`：项目总控门户和 React Dashboard 视觉基线。
- `apps/react/`、`apps/vue/`、`apps/angular/`：三个独立完整示例。
- `packages/domain/`：无框架依赖的实体、枚举和业务规则。
- `packages/mock-api/`：内存数据库、固定 seed、请求与实时事件。
- `packages/design-tokens/`：颜色、间距、排版和图表色板。
- [PRD 文档](../prd/README.md)：业务事实来源；[架构决策](../decisions/ADR-001-ai-driven-workflow.md)：架构决策记录。

```text
PRD → 领域契约 → Mock API → 框架适配层 → 页面交互 → 契约测试
```

三端共享业务契约，不共享 UI 组件。每个框架使用自己的惯用模式，避免把一种框架的写法机械复制到另外两种。

## 应用内分层

```text
src/
├─ app/       # 启动、路由、Provider、布局
├─ pages/     # 路由页面
├─ features/  # 按业务用例组织
├─ entities/  # 领域实体的 UI 与状态适配
├─ shared/    # 通用组件与工具
└─ mocks/     # Mock 接入
```

## 选型策略

- React 主应用使用 MUI；实验室覆盖 Ant Design、shadcn/ui。
- Vue 主应用使用 Element Plus；实验室覆盖 Ant Design Vue、Vuetify。
- Angular 主应用使用 Angular Material；实验室覆盖 PrimeNG、NG-ZORRO。
- 主图表使用 Apache ECharts；实验室覆盖 Chart.js、D3.js。
- 地图使用可离线演示的矢量地理数据，不依赖在线密钥。
- IndexedDB 保存业务演示数据，LocalStorage 保存主题等设备偏好。

## Mock 行为

- Promise API 模拟 REST，默认延迟 120–600ms。
- 浏览器事件模拟遥测、告警与 OTA 推送。
- 支持分页、排序、过滤、全文检索和时间范围。
- 可切换正常、慢速、局部失败、离线和无权限状态。
- 所有业务随机数据由显式 seed 生成，页面禁止直接使用 `Math.random()`。
