# CHG-2026-09-11-006：三框架组件与图表实验室

## 需求

- IOT-LEARNING-001

## 变更

- React 实验室覆盖 MUI、Ant Design 与源码所有的 shadcn/ui 风格组件。
- Vue 实验室覆盖 Element Plus、Ant Design Vue 与 Vuetify。
- Angular 实验室覆盖 Angular Material、PrimeNG 与 NG-ZORRO。
- 三端均以固定 `seed: 20260829`、同一租户和时间范围展示 ECharts 柱状图、Chart.js 趋势图与 D3 饼图，并说明体积与 API 取舍。
- React 与 Vue 将实验室拆为独立异步模块；Angular 使用独立 standalone 组件和局部样式。各框架保留独立构建命令，不跨应用共享 UI 组件。
- 补充 2026-09-11 生态版本快照与官方资料索引。

## 验证

- `npm test`：50 项测试通过，包含门户与 React、Vue、Angular 四个生产构建。
- `npm run lint`：通过。
- `npm run build:react`、`npm run build:vue`、`npm run build:angular` 可分别执行。

## 已知限制

- ECharts 和完整组件库实验包触发 Vite 的 500 kB chunk 提示；实验模块已与主要业务入口隔离，后续可按组件粒度继续拆包。
- 实验室用于生态教学对比，不改变业务页面采用的主 UI 库。
