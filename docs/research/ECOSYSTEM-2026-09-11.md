# 2026-09-11 三框架组件与图表生态快照

## 口径

“Top 3”不是绝对下载量排名，而是截至 2026-09-11 依据公开采用度、组件覆盖、维护活跃度、TypeScript/当前框架兼容性和教学差异性选出的三组代表。主业务库保持不变，另外两组只进入隔离实验页。

| 框架 | 代表库 | 本项目版本 | 教学侧重点 | 官方资料 |
| --- | --- | --- | --- | --- |
| React | MUI | 9.4.0 | Material 系统、主题和 sx | https://mui.com/material-ui/ |
| React | Ant Design | 6.6.3 | 企业表格、表单、弹窗 | https://ant.design/docs/react/introduce/ |
| React | shadcn/ui | source-owned | 源码所有权、组合式 primitives | https://ui.shadcn.com/docs |
| Vue | Element Plus | 2.14.5 | Vue 3 企业组件与主题变量 | https://element-plus.org/ |
| Vue | Ant Design Vue | 4.2.6 | Ant Design 的 Vue 实现 | https://antdv.com/ |
| Vue | Vuetify | 4.2.1 | Material 设计、布局与主题 | https://vuetifyjs.com/ |
| Angular | Angular Material | 20.2.14 | 官方 CDK、Material 与可访问性 | https://material.angular.dev/ |
| Angular | PrimeNG | 20.4.0 | 数据密集组件和主题 preset | https://primeng.org/ |
| Angular | NG-ZORRO | 20.4.4 | Angular 企业级 Ant Design | https://ng.ant.design/ |

图表对比采用 ECharts 6.1.0、Chart.js 4.5.1 与 D3 7.9.0。同一固定 seed Dashboard 地域数据分别绘制柱状、趋势和饼图，同时记录 API 风格、按需加载方式和当前构建体积提示。

## 隔离规则

- 实验组件位于各框架自己的 `labs` 文件，禁止业务页面导入次要 UI 库。
- React/Vue 通过动态导入只在打开实验室时加载实验依赖；Angular 使用独立 standalone 组件作用域。
- 示例 class 使用 `lab-*` 前缀，禁止覆盖业务库全局选择器。
- 三端读取相同 `tenantId`、时间范围和 seed，不在页面生成随机数据。
