# Vue：从草稿追到 Composition API

先完成[共同操作](README.md)。入口 [main.ts](../../code/apps/vue/src/main.ts) 创建 router 并装到 `createApp(RootView)`；[AppShell.vue](../../code/apps/vue/src/AppShell.vue) 的 RouterView 承载业务内容。路由组件以动态 import 懒加载。不要把诊断页 [App.vue](../../code/apps/vue/src/App.vue) 误认为整个业务壳层。

## ref 与 computed 为什么分开

打开 [Devices.vue](../../code/apps/vue/src/Devices.vue)。`<script setup>` 的 `ref` 保存草稿、列表、详情和错误；脚本中访问 `.value`，模板中自动解包。`query` 是可写 computed：getter 从 route.fullPath 解析，setter 调用 router.push。`draft` 是可编辑副本，点击 `apply` 才修改 query。转换字段的函数在 [device-route.ts](../../code/apps/vue/src/device-route.ts)。

在 `loadList` 下断点，选择产品与在线状态、查询，再翻页。检查 `query.value` 和返回的 total；浏览器后退改变的是路由，watch 会重新读取已应用查询。尝试在搜索框输入文字但不查询，列表不应立即过滤；`v-model` 在这里只改草稿，不等于调用服务。

`selected` 也是可写 computed，写入详情 ID 时保留其他 query 字段。不要把 URL、响应对象、输入草稿混成一个 ref，否则刷新、重试与返回会互相覆盖。

## 模板、事件与组件边界

设备表单用 `v-model` 绑定名称/标签，用 `@click` 调用 `saveMetadata`，用 `v-if` 显示错误和权限状态；这是普通表单状态，没有接入额外表单库。列表 `v-for` 使用设备 ID 作为 key，保持同一业务实体的 DOM 身份，便于返回焦点。

父子通信可在 [Dashboard.vue](../../code/apps/vue/src/Dashboard.vue) 与 [DashboardChart.vue](../../code/apps/vue/src/DashboardChart.vue) 中观察：父组件传 data/kind，子组件 `defineProps` 接收，`defineEmits` 发出 country，父页面处理选择。子组件不是直接修改父组件的查询。图表在 onMounted 建立实例，watch 更新数据，onBeforeUnmount 释放 observer 与 chart。

## watch、请求和清理

找到 `watch([query, role, scenario, reload], loadList)`。依赖变化发起请求，`listRequest` 序号只允许最后一个结果更新列表。`detailRequest` 为详情做相同保护，卸载时递增序号使旧结果失效。它们没有中断底层 Promise，也不是网络 AbortController。真正可停止的遥测订阅有 `stopLive`，watch 重新订阅前和卸载时都会清理。

开启“缓慢”场景观察列表与详情加载提示。保存会显示 pending，控件暂时禁用；失败只改 saveError，输入还在。成功从服务响应回填，避免 trim/标签去重后留下假脏状态。错误与空数据分别渲染，不把服务拒绝当作零条设备。

## 守卫和键盘路径

[useUnsavedChanges.ts](../../code/apps/vue/src/useUnsavedChanges.ts) 在组件内注册 onBeforeRouteLeave、onBeforeRouteUpdate 与 beforeunload。进入详情后修改名字，再按后退，取消应保留输入。若只拦截菜单点击，浏览器后退与 query 更新就会漏过，因此守卫放在路由生命周期。

`watch(selected, ..., { flush: 'post' })` 结合 cleanup 管理 [device-detail-focus.ts](../../code/apps/vue/src/device-detail-focus.ts)。全宽抽屉限制 Tab 和背景滚动；控制预览是内层弹窗。已经被内层处理的键盘事件不能再关闭外层。把视口设为 768px，再扩大到 1440px，观察 aria-modal 和滚动锁随布局变化。

## 跟着运行

在开发模式把设备页面说明改成自己的练习标题，保存并观察更新，再仅还原这一行。热更新可能保留部分页面状态，不保证所有修改都保留；刷新后能恢复的是 URL 与已保存 Mock 数据。

执行 `npm run test:unit -- src/device-route.spec.ts`，然后 `npm run build` 和 `npm run test:e2e -- device-flow.spec.ts --workers=1`。阅读 [device-flow.spec.ts](../../code/apps/vue/tests/browser/device-flow.spec.ts) 的保存失败、并发冲突及平板缩放用例，再阅读 [shell.spec.ts](../../code/apps/vue/tests/browser/shell.spec.ts) 中持久壳层和慢路由用例。它们验证用户可观察结果，不能代替人工视觉审核。

## V3 重建：从批准交互到 Vue 原生工作区

默认入口已改为 `/v3/workspace`，旧诊断为 `/diagnostics`，旧业务 URL 保留为教学兼容区。[main.ts](../../code/apps/vue/src/main.ts) 注册两个独立父布局；[RootView.vue](../../code/apps/vue/src/RootView.vue) 挂载路由，[V3 Shell](../../code/apps/vue/src/v3/Shell.vue) 常驻侧栏、顶栏和子级 RouterView。内容切换通过 RouterLink，不刷新文档。没有 KeepAlive 页面缓存，也没有 iframe 或 HTML 注入复用原型。

[WorkspacePage.vue](../../code/apps/vue/src/v3/WorkspacePage.vue) 负责模块选择、标题及异常状态；[DevicesPage.vue](../../code/apps/vue/src/v3/DevicesPage.vue)、[AutomationPages.vue](../../code/apps/vue/src/v3/AutomationPages.vue)、[GovernancePages.vue](../../code/apps/vue/src/v3/GovernancePages.vue) 与 [ReferencePages.vue](../../code/apps/vue/src/v3/ReferencePages.vue) 分开资产、自动化、治理和参考模块。共同的 Panel、DataTable、StatusTag、Metrics、TrendChart 都在本端目录，不跨框架导入。

设备筛选 `q`、`status` 和时序窗口是输入草稿，点击应用才写 URL。computed 从已应用 route.query 推导结果，因此尚未应用的窗口不会影响 CSV。详情的 `back` 保存返回筛选；路由参数 watch 配合 `nextTick` 返回原设备链接焦点。详情电表仅展示 energy/power 和元数据，温控操作被排除。

[useOperations.ts](../../code/apps/vue/src/v3/useOperations.ts) 是页面级 composable，集中管理创建/编辑表单的字段、草稿、校验反馈和提交后跳转。[OperationsDialog.vue](../../code/apps/vue/src/v3/OperationsDialog.vue) 用 Vue 模板渲染表单及轻量详情，[Modal.vue](../../code/apps/vue/src/v3/Modal.vue) 封装原生 dialog 的焦点进入、Tab 圈定、Escape 请求关闭和触发点回焦。数字 input 的 v-model 会自动得到 number，提交时显式转为领域字符串输入。

`dirty` 仅传递离开信号，实际输入仍属于页面。全局 beforeEach 覆盖后退、前进和未知路由；Shell 的 beforeunload 负责刷新关闭。`markDirty` 忽略已关闭表单的尾随 change，防止焦点恢复时把已丢弃草稿重新标脏。移动菜单关闭先 `await nextTick()`，待 inert 真正移除后才聚焦菜单按钮。设置页与评审异常切换同样确认放弃并恢复已保存偏好。

[domain.ts](../../code/apps/vue/src/v3/domain.ts) 不依赖 Vue，只包含领域权限、输入及状态校验。[store.ts](../../code/apps/vue/src/v3/store.ts) 在 `structuredClone(toRaw(state))` 上运行命令，全部成功才提交响应式数据与本端 localStorage；失败不会留下半份修改或审计。快照结构验证兼顾温控与电表两种设备，损坏时回固定 [seed](../../code/apps/vue/src/v3/seed.ts)，存储拒绝会明确说明仅本次打开有效。

跟踪四条流程：注册→待接入→模拟上报；阈值规则→待确认告警→确认负责人→解决原因；OTA 待执行→运行→部分失败→仅失败目标重试→完成；邀请成员→角色→配额。活跃升级目标不能删除，推进/重试检查目标存在且在线；重试推进仅检查本次重试项。运维不能首次启动升级，但可以重试失败项和推进重试。成功目标尝试次数维持 1，重试项为 2。平台管理员之外不得修改治理资源，观察员不能写入。

## 本轮运行、构建与部署练习

在 `code/apps/vue` 独立执行 `npm ci`、`npm run diagnose`，随后 `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --retries=0`。领域测试见 [domain.spec.ts](../../code/apps/vue/src/v3/domain.spec.ts)，V3 浏览器测试见 [v3.spec.ts](../../code/apps/vue/tests/browser/v3.spec.ts)；完整浏览器套件还覆盖旧业务兼容区。本轮证据目录为 `reports/v3-rebuild/`，结果以本轮日志为准，不沿用旧环境数字。

开发时 `npm run dev` 提供 Vite 与 HMR；`npm run build` 编译 SFC/TypeScript 并打包本端资源到 `dist/`；`npm run preview` 只检查本地生产包。静态服务必须把非资源路由回退到 `index.html`，否则刷新 `/v3/devices/DEV-1001` 会返回 404。三个应用按独立 origin 发布，子路径部署须同步配置 Vite base 与 Router history base。参阅现有 [部署教学](deployment.md)，本轮不执行真实部署。

这是明确的本地 Mock：不连接 MQTT/设备、真实时序库或 IAM，不发送邀请邮件，也不访问连接器目的地。图表固定窗口为视觉示意；通用规则编排、完整 OTA 后台与不可篡改审计均未实现。用户批准的交互不等于自动批准新的视觉基线或最终验收。
