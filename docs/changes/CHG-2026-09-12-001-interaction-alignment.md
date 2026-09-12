# CHG-2026-09-12-001：三端交互图对齐与首页收敛

## 关联需求

IOT-DASH-001、IOT-PLATFORM-003。

## 变更

- 根首页删除业务导航、Dashboard 指标、交付看板和模块跳转，只保留 React、Vue、Angular 三个应用入口。
- 三端应用采用交互图定义的深色工业控制台壳层：稳定左侧主导航、顶部全局上下文、语义状态色、紧凑工作区和响应式降级。
- 三端统一八个一级模块的名称、顺序、激活态和主题入口。
- React 保留 React Router HashRouter；Vue 接入 Vue Router Hash History；Angular 接入 Angular Router Hash Location，模块均可直达并支持浏览器前进/后退。
- 保留三端各自主 UI 库和已有共享 Mock API 业务操作，不共享 UI 组件实现。

## 验证

- `npm.cmd test`：63/63 通过，包含根首页仅三入口、三端路由与壳层一致性、三端构建、Angular 模板解析和共享契约测试。
- `npm.cmd run lint`：通过。
- React、Vue、Angular 生产构建均成功并重新暂存到门户静态目录。

## 已知限制

- ECharts 与实验室依赖生成的部分 bundle 超过 500 kB，构建给出性能提示但不影响功能。
