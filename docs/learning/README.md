# 从设备业务链学习三个框架

这是本仓库真实代码的中文操作教程，关联 IOT-LEARNING-001、IOT-DEVICE-001。先选一个框架跑通，再做横向比较。三个应用拥有独立源码、依赖、Mock、资源与测试；这里共用的是教学问题，不是运行时库。当前仍是浏览器 Mock，视觉和产品最终验收未完成。

1. [React：从一次点击追到 Hooks 和路由](react.md)
2. [Vue：从表单追到 Composition API](vue.md)
3. [Angular：从模板追到 signals 和 DI](angular.md)
4. [编译、调试、测试与构建](engineering.md)

## 先跑同一条业务链

准备 Node 24.15+ 的 24.x、npm 和浏览器。不要在仓库根安装依赖。以下以 React 为例；Vue、Angular 分别替换目录，端口为 14102、14103。

```sh
cd code/apps/react
npm ci
npm run dev
```

打开 `http://127.0.0.1:14101/dashboard`，再通过左侧导航进入设备中心。打开开发者工具 Network，勾选 Preserve log，筛选 Doc。应用内导航不应产生新的 HTML 文档请求，刷新页面则应产生文档请求。

在设备中心选择产品“工业温湿度传感器”和状态“在线”，点击查询，每页选 2 条，然后下一页。应看到共 4 条、位于第 2 页。复制地址：URL 应包含 `productId`、`status`、`pageSize=2` 和 `page=2`。输入筛选草稿时地址不变，点击查询才应用。

点击某个设备，地址增加 `device`。清空名称并保存：抽屉内显示校验失败，输入仍保留。填入“我的教学设备”，点击重试保存：出现成功提示。刷新后详情和保存值仍存在；关闭详情仍是原筛选第 2 页。正常关闭回焦设备按钮，刷新深链接后没有原触发元素时回焦列表标题。

再次编辑但不保存，按 Escape 或浏览器后退。取消确认应保留草稿；接受才离开。观察 Network：保存没有真实 HTTP 请求，因为本轮调用的是各端 `devices.ts`，数据保存在该应用浏览器 origin 的 localStorage 中。不要把这个演示当作真实鉴权或远端持久化。

最后关闭详情，展开“更多筛选与演示状态”，选服务离线、无权限，再切回正常。比较错误反馈与搜索不存在关键词的空结果。切换数据观察员后打开详情，应看到只读说明；它不是可绕过真实服务权限的前端安全方案。

## 同一个问题，三种落点

| 追踪点 | React | Vue | Angular |
| --- | --- | --- | --- |
| 启动 | createRoot / RouterProvider | createApp / use(router) | bootstrapApplication / provideRouter |
| 持久壳层 | AppShell + Outlet | AppShell + RouterView | ShellComponent + RouterOutlet |
| 本页草稿 | useState | ref | signal |
| 应用查询 | useSearchParams 派生值 | 可写 computed 对接 route.query | queryParamMap 更新 signals |
| 清理 | useEffect 返回函数 | watch cleanup / onBeforeUnmount | takeUntilDestroyed / ngOnDestroy |
| 离开保护 | useBlocker | onBeforeRouteLeave / Update | CanDeactivate / CanActivate |

每个分支教程都指出实际函数与文件。不要把“概念上可以使用”写成“项目已经使用”：本项目设备表单没有接入 React Hook Form、Pinia、NgRx 或 Angular Reactive Forms；Angular 的设备领域服务也不是通过 DI 注入的 HTTP 服务。

## 可复现的检查

在所选应用目录先执行 `npm run diagnose`，再执行 `npm run test:e2e -- device-flow.spec.ts --workers=1`。后者只跑设备教学链，不能代替完整 `npm run test:e2e`。报告在各端 `reports/playwright/index.html`，失败 trace 用 `npm run trace -- <trace.zip>` 打开。当前结果及浏览器限制以 [QUALITY](../architecture/QUALITY.md) 为准，不把教程中的预期当成已执行的验收结果。

- [构建候选、本地部署与回滚](deployment.md)：验证同一批文件，区分本地证据、CI 和正式发布。
