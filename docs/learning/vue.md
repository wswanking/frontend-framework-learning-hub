# Vue：从草稿追到 Composition API

先完成[共同操作](README.md)。入口 [main.ts](../../code/apps/vue/src/main.ts) 创建 router 并装到 `createApp(AppShell)`；[AppShell.vue](../../code/apps/vue/src/AppShell.vue) 的 RouterView 承载业务内容。路由组件以动态 import 懒加载。不要把根诊断页 [App.vue](../../code/apps/vue/src/App.vue) 误认为整个业务壳层。

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
