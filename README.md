# IoT Atlas · 三框架独立实现

旧业务代码已清理。React、Vue、Angular 现各有独立的诊断基座、数据大盘（`/dashboard`）、全球节点（`/geography`）、产品与物模型（`/products`）、设备中心（`/devices`）、规则引擎（`/rules`）、固件与 OTA（`/firmware`）、租户与配额（`/tenants`）、组件及图表实验室（`/labs`）和交付治理 Mock（`/delivery`）页面。业务与候选库仍处在增量实施阶段；正式选型、完整交互和产品最终验收尚未完成。

- [需求](docs/prd/PRD.md)、[架构](docs/architecture/CONTEXT.md)、[统一交互 V2](docs/interaction/UNIFIED-V2.md)。
- [诊断环境与验证记录](docs/architecture/QUALITY.md)。
- 三端独立工程：[React](code/apps/react/README.md)、[Vue](code/apps/vue/README.md)、[Angular](code/apps/angular/README.md)。

## 使用

Node 24.15+（24.x），npm。在任一应用目录执行：

```sh
npm ci
npm run diagnose
npm run browser:install
npm run test:e2e
npm run visual:capture
npm run capture:v2
```

`diagnose` 无需浏览器；`test:e2e` 和截图需要浏览器引擎，可在 CI 无界面执行。先构建再运行 `capture:v2`，每端在 `reports/v2-candidates/` 生成九个业务路由及关键交互状态的桌面/移动候选截图与清单（当前每端 74 张）。三端都采集后，在仓库根运行 `node tools/build-v2-review.mjs`，可查看 `reports/v2-review/index.html` 中的 V2 图稿与三端候选对照。CI 在隔离安装、构建、浏览器检查和截图采集成功后生成 `reports/ci-evidence.json`，记录提交、运行链接、测试报告与构建文件哈希；它仅是诊断证据。候选截图不等于设计验收；`test:visual` 在当前系统没有审核基准时明确失败，`verify` 才是包含视觉检查的完整门禁。

外层用 `node tools/diagnose-all.mjs diagnose` 调度三端并比较固定场景下八个功能域的实际 DTO 与错误；也可单独运行 `node tools/diagnose-all.mjs parity`。不需要根 package.json 或根 node_modules。各端源码、依赖、锁文件、配置、测试和资源均独立维护。

本地三应用入口：分别在三个应用目录执行 `npm run preview`（先构建），然后在仓库根运行 `node tools/serve-portal.mjs`，访问 `http://127.0.0.1:14100/`。入口分别指向三端独立运行的 `/dashboard`。

## 清理记录

2026-09-16 保留 15 张原型图及校验清单。永久删除被工具策略拒绝，旧代码、依赖和交付资料位于 Git 忽略的 `.cleanup-archive/2026-09-16/`，不得作为新工程依赖。Git 历史保留，归档占用空间尚未释放。
