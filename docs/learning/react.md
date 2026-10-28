# React：从 V3 工作区追踪状态、路由和领域命令

先完成[共同操作](README.md)。以下源码链接指向 React 自己的应用；在编辑器中按函数名搜索定位，比依赖易过期的行号更可靠。

## 当前 V3 入口与源码职责

打开 `/v3/workspace`。这是按已批准设计重建的 React 原生工作区，不是 iframe 或 HTML 原型包装；原有 MUI/ECharts 页面保留为后面的教学兼容区。新的 14 个模块使用 React 模板渲染原生表格、对话框和 SVG，业务与其他框架遵守同一文档契约，但没有跨端运行共享。

| 从哪里读 | 对应责任 |
| --- | --- |
| [main.tsx](../../code/apps/react/src/main.tsx) | 父路由与默认重定向；V3 与旧业务地址并存 |
| [Shell.tsx](../../code/apps/react/src/v3/Shell.tsx) | 常驻导航、顶栏、Context、模拟身份、持久快照与对话框宿主 |
| [Page.tsx](../../code/apps/react/src/v3/Page.tsx) | 14 模块分派、权限拒绝和可恢复的异常状态 |
| [pages/Devices.tsx](../../code/apps/react/src/v3/pages/Devices.tsx) | 列表草稿、URL 查询、详情页签、返回位置与焦点 |
| [pages/Assets.tsx](../../code/apps/react/src/v3/pages/Assets.tsx) | 物模型目录、时序查询与已应用查询 CSV |
| [pages/Automation.tsx](../../code/apps/react/src/v3/pages/Automation.tsx) | 规则、告警与 OTA 页面 |
| [actions.tsx](../../code/apps/react/src/v3/actions.tsx)、[WorkspaceDialog.tsx](../../code/apps/react/src/v3/WorkspaceDialog.tsx) | 任务字段配置、原生 form/dialog、失败保留输入、焦点循环 |
| [types.ts](../../code/apps/react/src/v3/types.ts)、[seed.ts](../../code/apps/react/src/v3/seed.ts)、[domain.ts](../../code/apps/react/src/v3/domain.ts) | 本端类型、批准种子、权限校验与原子领域命令 |

在 Elements 中选中 `[data-testid="v3-shell"]` 保存为临时变量，然后跨 14 个模块导航；该 DOM 对象应一直相同。`Outlet` 只替换内容，导航使用 `Link/NavLink`，移动菜单在 1050px 以下折叠并限制键盘焦点；680px 以下单列，表格在自己的区域横滚。

## V3：三个不同生命周期的状态

Shell 的 `useState` 保存已提交业务快照，通过 Context 提供命令入口；本端 `iot-atlas-react-v3` localStorage 与旧 Mock、其他框架分别隔离。持久化数据必须通过 schema 和模板字段校验，损坏内容回到独立种子；写存储失败会提示“仅在本次打开保留”。这不是后台服务，也不提供跨浏览器同步。

异常状态选择属于当前 `pathname + search`，只保存一个路由的选择；路由改变时在渲染阶段派生正常态并同步替换旧记录。这样无需在延后的 effect 中重置选择，避免导航刚完成时覆盖用户刚选的加载状态；点击同一 URL 保持当前选择，也不会缓存所有页面。成功导航的浏览器 helper 等目标页面标题出现后再操作常驻控件；取消离开只触发点击，再断言仍停在原页，不能等待被取消的目标页面。另有同 URL 点击的负对照回归。

URL 保存已应用筛选、设备详情 ID、页签及返回列表的查询。设备页的 `draft` 和状态下拉仍由页面持有，按“应用”才写入 URL；勾选不跨页面无限缓存。时序页的 CSV 从 URL 派生已应用数据，改变下拉而未查询不会悄悄改变导出结果。详情返回携带 `focusDevice`，在列表重新出现后聚焦原设备链接。

表单草稿属于当前页面或 dialog。设置草稿被接受放弃时，会通过内容组件 key 销毁旧实例；取消则保持原输入。仅更新 Context 的 `dirty=false` 而继续显示旧草稿，会让后续离开保护失效，这种写法不应使用。

## V3：跟踪四条本地业务闭环

在 `domain.ts` 的 `execute` 断点观察：先检查角色能力，再复制旧快照，验证输入/状态，最后返回新快照和审计。任何步骤抛错都不会部分修改原状态。React `setState` 闭包并不立即变更，因此 Shell 的 ref 保存最新事务快照，连续调用命令也不能回写过期状态。

1. 注册→待接入→模拟上报：ColdSense 的读数与日志更新，EnergyLink 仅展示能耗规格与元数据，不能调用温控命令。
2. 规则试运行→待确认告警→负责人确认→原因解决：状态前置条件在领域层校验，按钮不是唯一权限边界。
3. OTA→运行→最后目标失败→仅失败目标重试：活跃批次目标不能删除；推进/重试检查本次目标仍存在且在线；成功项尝试次数保持 1，重试项变 2。普通开始/推进需管理员，运维仅可重试及推进重试阶段。
4. 成员邀请→角色分配→配额：仅平台管理员治理，配额不能低于设备用量；模拟邀请不发邮件。

[领域测试](../../code/apps/react/src/v3/domain.spec.ts) 直接绕过 UI 验证权限、失败回滚、删除成功历史目标后仍可重试失败项，以及损坏快照。不要用界面隐藏按钮替代领域校验，也不要将本地 Mock 当作生产后端鉴权。

## V3：离开保护、效果与可访问性

[useUnsavedChanges.ts](../../code/apps/react/src/useUnsavedChanges.ts) 通过 Router blocker 处理路由/历史、`beforeunload` 处理刷新；同一被阻止的导航只确认一次。保存后留在原页无需任何一次性放行；只有保存后明确导航才放行该次跳转，避免影响下一份草稿。对话框关闭/Escape 另有确认，并返回触发按钮；原生刷新提示由浏览器决定文字。

[ui.tsx](../../code/apps/react/src/v3/ui.tsx) 的趋势 SVG 使用 `useId` 生成独立渐变引用。曲线是明确标注的视觉示意，精确读数见表格；没有以装饰曲线冒充真实遥测。通知、连接测试和升级进度都明确本地模拟边界。监听器、toast 定时器和对象 URL 分别由 effect cleanup 或释放函数结束，不保存无限页面实例。

## 独立安装、编译与部署学习

在 `code/apps/react` 使用锁定引擎要求的 Node 24 与 `npm ci`；`npm run dev` 启动本端 14101。`npm run diagnose` 顺序执行守卫、边界、TypeScript、lint、unit 和 Vite 构建，生成本端 `dist`。TypeScript 检查不等于浏览器执行；`npm run build` 不等于测试，更不等于部署。

构建完成并释放 14101 后，运行 `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --retries=0`。浏览器脚本自行启动 preview；[v3.spec.ts](../../code/apps/react/tests/browser/v3.spec.ts) 验证四闭环、14 模块×4 异常状态、Shell DOM 身份、权限/过滤/CSV、历史/刷新、焦点、axe 和桌面/手机截图。取消刷新时测试观察 beforeunload，而不等待已被取消的页面加载。旧 `device-flow.spec.ts` 使用明确固定时钟起点和未来暂停时刻，避免并发时采样时刻落在过去。

部署方案是各框架独立 origin 的根应用，仅发布各自 `dist`，深链接须由服务器回退至该应用 `index.html`，资源路径、缓存与回滚按本端构建产物配置。跨端切换可重新加载独立文档。当前本地 preview 不是真实部署，视觉候选截图也不自动成为已批准基线；本轮实测请看 QUALITY 和 `reports/v3-rebuild/`，不沿用遗失源码轮次的旧数字。

## 旧教学兼容区

以下保留已有 M1–M4 教学链，入口 `/dashboard`、`/devices` 等，与 V3 的本地数据分离。

## 页面怎样出现

从 [main.tsx](../../code/apps/react/src/main.tsx) 开始：`createRoot` 把应用挂到 `#app`，`createBrowserRouter` 定义父布局和业务子路由。打开 [AppShell.tsx](../../code/apps/react/src/AppShell.tsx)，找到 `Outlet`；它是当前页面的位置，导航与顶栏在它外面。业务组件通过 `lazy` 导入，内容中的 `Suspense` 在等待代码块时显示提示。当前根地址 `/` 重定向至 `/v3/workspace`；旧诊断迁到 `/diagnostics`，旧业务入口 `/dashboard` 等保留为教学兼容区。

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
