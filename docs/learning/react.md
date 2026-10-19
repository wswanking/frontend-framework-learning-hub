# React：沿着设备点击追踪数据

先完成[共同操作](README.md)。以下源码链接指向 React 自己的应用；在编辑器中按函数名搜索定位，比依赖易过期的行号更可靠。

## 页面怎样出现

从 [main.tsx](../../code/apps/react/src/main.tsx) 开始：`createRoot` 把应用挂到 `#app`，`createBrowserRouter` 定义父布局和业务子路由。打开 [AppShell.tsx](../../code/apps/react/src/AppShell.tsx)，找到 `Outlet`；它是当前页面的位置，导航与顶栏在它外面。业务组件通过 `lazy` 导入，内容中的 `Suspense` 在等待代码块时显示提示。根地址 `/` 是诊断页，业务入口是 `/dashboard`。

练习：在开发工具 Elements 中选中 `.app-shell`，存为临时变量。用站内链接切换设备与大盘，再比较该 DOM 对象；对象应仍在文档中。对应自动化在 [shell.spec.ts](../../code/apps/react/tests/browser/shell.spec.ts)，检查的是 DOM 身份和 document 请求，不只是“看起来没闪”。

## 从点击到 URL，再到列表

打开 [Devices.tsx](../../code/apps/react/src/Devices.tsx)，依次查找 `draft`、`query`、`setQuery`、`apply`。输入框 `value` 取自草稿，`onChange` 调用 setter；`apply` 才将草稿写入路由。`useSearchParams` 给出地址，`useMemo` 解析已应用查询；解析规则在 [device-route.ts](../../code/apps/react/src/device-route.ts)。`device` 不参与列表查询 key，因此打开详情不会仅因为详情参数改变而重新初始化列表查询。

在列表请求 `useEffect` 的 `devices.list(context(), query)` 处下断点，执行共同操作的第 2 页查询。观察 query 中 page、pageSize 与 productId，再继续运行，查看返回 items 与 total 怎样进入 `setRows`、`setTotal`。这是事件→路由→状态→渲染的实际链条，不需要额外全局 store。

`useState` 的 setter 请求下一次渲染，不会直接修改当前闭包里的值。把一次查询拆成多个互相依赖的 setter 容易读到旧值；本文件身份切换会构造完整参数再执行一次导航。尝试仅修改搜索输入但不点查询：列表与 URL 都不应变化，这说明草稿和已应用值是两个状态。

## 组件通信和副作用

设备页目前直接组合 MUI 控件和本地 `TelemetryChart`，不是每一个表格单元都拆成组件。`TelemetryChart` 接收 `points/metric/unit` props。更完整的父子通信可追踪 [Dashboard.tsx](../../code/apps/react/src/Dashboard.tsx) 到 [DashboardCharts.tsx](../../code/apps/react/src/DashboardCharts.tsx)：父组件传数据和回调，子图表调用回调传出国家代码。

图表有 DOM 实例、ResizeObserver 等外部对象，应由 effect 创建和清理。`useRef` 保存实例而不驱动渲染；地图事件使用 `useEffectEvent` 读取最新回调，避免把普通回调身份变化误当成销毁重建图表的理由。不要把 Effect Event 当作逃避所有依赖的通用工具。地图实例稳定性有 shell 测试覆盖。

## 保存、失败与离开

在 `saveMetadata` 下断点。它把草稿交给本端 [devices.ts](../../code/apps/react/src/devices.ts) 的 `updateMetadata`，携带 detail.version；保存中禁用控件，失败保留草稿，成功用服务返回的规范化名称与标签更新本页并刷新列表。并发版本不一致返回 CONFLICT，不能用前端覆盖来冒充成功。

列表和详情 effect 都有 `active` 标记，cleanup 后旧 Promise 的结果不会再写入当前视图。这是忽略过期结果，不是 AbortController，也没有取消真实 HTTP 请求。实时遥测由服务返回 unsubscribe，effect cleanup 才真正停止定时订阅。可开启时序实时追加，关闭详情，观察 localStorage 消息数停止增加。

[useUnsavedChanges.ts](../../code/apps/react/src/useUnsavedChanges.ts) 使用 `useBlocker` 处理 SPA 路由，使用 `beforeunload` 处理刷新。浏览器会决定刷新提示文字，页面不能定制它。保存后的例外放行是显式的一次性操作，不应把所有导航都强行放行。焦点与全宽抽屉滚动约束在 [device-detail-focus.ts](../../code/apps/react/src/device-detail-focus.ts)，由 effect 持有清理函数。

## 自己做一次可撤销调试

在开发模式把设备页说明文字改为“我的 React 学习工作台”，保存文件，观察热更新。用编辑器还原这一行，不要批量还原整个工作区。接着故意在名称输入中输入空白，跟踪 `saveMetadata` 和 `updateMetadata` 的分支，无需破坏服务源码。

运行 `npm run test:unit -- src/device-route.spec.ts` 检查 URL 编码和非法参数，再构建并运行 `npm run test:e2e -- device-flow.spec.ts --workers=1`。阅读 [device-flow.spec.ts](../../code/apps/react/tests/browser/device-flow.spec.ts) 中版本冲突测试：它模拟另一个写入者更新库存，再验证草稿保留和明确重新加载。调试测试请用 `npm run test:e2e -- device-flow.spec.ts --project=desktop --debug`，先保证没有占用预览端口的进程。
