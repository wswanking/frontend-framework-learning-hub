# Angular：从模板追到 signals、路由与 DI

先完成[共同操作](README.md)。[main.ts](../../code/apps/angular/src/main.ts) 使用 `bootstrapApplication` 启动 standalone 根组件，由 `provideRouter` 提供路由。[RootComponent](../../code/apps/angular/src/root.component.ts) 与 [ShellComponent](../../code/apps/angular/src/shell.component.ts) 各有 router outlet；业务父路由保留 Shell，候选实验室 iframe 路由在壳层之外。这里没有用 NgModule 来组装根应用。

## standalone 与依赖注入分别解决什么

打开 [devices.component.ts](../../code/apps/angular/src/devices.component.ts) 的 `@Component`：standalone 为 true，imports 明确列出 RouterLink、Material 模块，templateUrl 指向本端 [HTML](../../code/apps/angular/src/devices.component.html)。这些是模板能够使用的能力。

再看 `inject(Router)`、`inject(ActivatedRoute)`、`inject(DeviceDraftGuard)`：它们由 Angular 注入器提供。领域 `devices` 则来自普通 TypeScript import，是本端服务对象，并没有被注册为 Injectable；不要把这里描述成已经实现 HttpClient 后端。真正的注入式草稿协作服务在 [unsaved-changes.ts](../../code/apps/angular/src/unsaved-changes.ts) 中，`providedIn: 'root'` 让守卫与页面拿到同一个实例，页面销毁时清掉它的检查回调。

## signals 与 URL

`draft`、`rows`、`detail` 是 signal，读取用 `rows()`，更新用 set/update；computed 派生 chips、dark 等值。模板的 `[value]` 负责显示，`(input)` 更新 signal，`@if`/`@for` 负责分支与列表。这是手动管理的表单，当前设备页没有使用 Reactive Forms 或 FormGroup。

在 `setQuery`、queryParamMap 订阅以及 `loadList` 下断点。点击查询时，页面先用 Router 更新地址；订阅读取 [device-route.ts](../../code/apps/angular/src/device-route.ts) 的解析结果，更新 query/draft 并查询。翻页和返回同样走这条链，不能只在按钮点击时维护一份与地址不一致的状态。动态 option 的 selected 绑定保证深链接刷新后能回显正确筛选值。

## 组件通信不要假定全部使用 signal input

设备页组合 Material 控件与本页模板。另一个清晰边界在 [DashboardComponent](../../code/apps/angular/src/dashboard.component.ts) 与 [DashboardChartComponent](../../code/apps/angular/src/dashboard-chart.component.ts)：这里实际使用 `@Input` 接收 data/kind、`@Output EventEmitter` 输出 country，并通过 ViewChild 获取图表宿主。不要把尚未采用的 `input()`/`output()` API 写成本项目实现。图表用 AfterViewInit 初始化、OnChanges 更新、OnDestroy 释放；页面本身使用 signals，这些机制可以共存。

## 异步、保存和销毁

`loadList`/`loadDevice` 用请求序号忽略过期响应。`takeUntilDestroyed` 自动结束路由可观察对象订阅；`ngOnDestroy` 还必须处理定时器、observer 或自建监听器，这些不会因为用了 RxJS helper 就全部自动清理。请求序号不是取消 HTTP，本项目也没有真正发出设备 HTTP 请求。

在 `saveMetadata` 中观察 detail.version 如何交给本端服务。清空名称保存会失败且保留输入；重复点击在保存中被禁用。遇到版本冲突，重新加载前先确认放弃草稿，不自动覆盖更新者的数据。`afterNextRender` 用于详情关闭后的焦点/滚动释放：内层弹窗先完成视图清理，再恢复外层，避免先恢复的滚动状态被内层覆盖。

## 守卫、取消与调试

在 [main.ts](../../code/apps/angular/src/main.ts) 找到 devices 路由的 CanDeactivate、CanActivate 和 `runGuardsAndResolvers: 'always'`。同路由 query 改变也可能离开当前设备，不能只依赖组件卸载。`canceledNavigationResolution: 'computed'` 用于取消浏览器历史导航后恢复位置。刷新由 beforeunload 处理，不能用 SPA 守卫代替。

把设备说明改成自己的练习标题，运行 `npm run dev` 后观察开发服务器更新，再手动还原这一行。执行 `npm run typecheck`：这里包含 ngc 的严格模板/AOT 检查和工具 TypeScript 检查，模板事件或绑定类型错误也会被检查。

执行 `npm run test:unit`（本端 Angular 测试构建与 Vitest），再 `npm run build`，最后 `npm run test:e2e -- device-flow.spec.ts --workers=1`。读 [device-flow.spec.ts](../../code/apps/angular/tests/browser/device-flow.spec.ts) 的后退关闭嵌套控制预览、平板缩放用例；它们验证 afterNextRender 的实际结果，不是只断言 signal 被调用。
