# 架构规范

## 决策与状态

2026-09-16 用户要求三个项目隔离，各自维护全部代码与资源，遵循同一套交互并实现相同功能；随后要求清理代码，仅保留需求、架构与交互。用户随后授权搭建独立诊断环境，业务于 2026-09-17 起按设计基线分增量重新实现，此决策覆盖旧共享 domain、Mock API、design-tokens 运行时包方案。

关联：IOT-PLATFORM-003、IOT-DOMAIN-001。

## 应用边界

- React、Vue、Angular 各自维护依赖清单、锁文件、构建/类型检查/测试配置、环境配置与部署资源。
- 各端自行维护组件、路由、状态、领域类型、业务校验、Mock、设计令牌、样式、图片、字体及图表资源。
- 禁止跨应用导入、依赖公共运行时包、父目录 node_modules 或其他应用的资源地址。
- 任一项目复制到仓库外，均应可独立安装、启动、检查、测试与构建。
- 第三方依赖由各端清单和锁文件管理，构建工具可按框架需要选择。

## 一致性

共同遵循 [PRD](../prd/PRD.md)、[领域契约](contracts/README.md)与[统一交互 V2](../interaction/UNIFIED-V2.md)。保持字段、流程、状态、权限、错误语义、确定性数据和验收场景一致，各端独立实现，不通过共享源码强制一致。

React 主 UI 为 MUI，Vue 为 Element Plus，Angular 为 Angular Material；业务图表使用 ECharts，其他库仅用于各端独立实验室。

## 数据与后端

目标仍为纯前端演示：各端独立实现固定 seed Mock，模拟查询、命令、失败、延迟、权限和实时事件，不接真实设备、消息 Broker、鉴权或生产数据库。持久化与异步行为按契约规范重新实现；2026-09-19 三端各有大盘、地理、产品、设备、规则、固件/OTA 和租户的本地 Mock 增量；其余业务与最终验收未完成。

## 统一构建

外层 `node tools/diagnose-all.mjs build` 依次调用各项目自己的 build 命令，再把三个独立输出收进忽略提交的 `reports/build-candidate-*` 候选包。候选包含提交号、各端独立文件清单与 SHA-256，可用 `node tools/collect-build-artifacts.mjs verify <目录>` 复核。各端编译链与依赖安装独立；候选包不是可直接部署的统一站点，也不引入跨应用代码依赖。

## 验收

三端分别在脱离仓库后验证安装、运行与构建，检查无跨项目源码和资源引用，并逐端验证统一业务交互场景。所有实现证据须重新建立。

## M1 持久 AppShell（2026-10-18）

React 使用 `createBrowserRouter` 的父布局、`Outlet` 与内容内的 `Suspense`；Vue 根 `AppShell` 持有 `RouterView`；Angular 由 `RootComponent` 启动，业务父路由持有 `ShellComponent`，内部 `RouterOutlet` 只替换路由组件；实验室候选 iframe 使用壳层外的独立路由，避免嵌套导航。三端分别维护九项导航，站内采用 `Link/NavLink`、`RouterLink`、`RouterLink/RouterLinkActive`。源码下载与跨应用地址仍为普通资源链接。

壳层只拥有导航展开状态与固定应用标识。业务标题、租户/身份/时间筛选、局部反馈仍由当前页面拥有；既有主题偏好和已保存 Mock 数据由本端 localStorage 保存。设备详情 ID 由路由 query 拥有，M1 中列表筛选与抽屉页签由设备页面拥有，同页开关详情保留列表状态；跨业务路由返回时重新查询，不保留无限页面实例。图表、订阅和媒体监听随页面销毁清理。

React `useBlocker`、Vue `onBeforeRouteLeave/onBeforeRouteUpdate`、Angular `CanDeactivate` 与设备 query 激活守卫各自拦截脏草稿。Angular 使用 `canceledNavigationResolution: computed` 恢复被取消的历史位置。原有页内保存/放弃/取消流程保留；路由离开使用原生确认，刷新关闭使用 `beforeunload`。React 地图点击回调通过 Effect Event 读取最新闭包，普通回调身份变化不再销毁地图。

锁文件中不可访问的 HTTP 镜像地址统一为官方 npm HTTPS 地址，保留依赖版本与 integrity。Playwright 可通过 `PLAYWRIGHT_EXECUTABLE_PATH` 显式指定环境已安装的浏览器；默认仍使用锁定 Playwright Chromium，报告须区分实际浏览器版本。

## M2 URL 与设备请求状态（2026-10-18）

已应用列表查询提升至 URL；筛选输入草稿、勾选、页签及未保存元数据仍由页面持有，不引入全局页面缓存。React 从 search params 派生查询并通过 router setter 提交；Vue 通过可写 computed 对接 route query；Angular 的 queryParamMap 订阅更新 signals，用户操作通过 Router 提交查询。各端独立的 device-route 模块负责同一字段规范，不跨应用导入。

列表请求与详情请求独立显示反馈，过期请求不能覆盖新详情。保存成功只刷新列表与当前详情数据，不重新初始化详情草稿；失败保留输入与版本。Mock 的 slow 场景也覆盖详情与元数据保存，便于确定性检查 pending 状态。设备抽屉 DOM 焦点适配器由各框架生命周期注册和释放，每个应用独立维护。
