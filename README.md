# IoT Atlas · 三框架独立实现

2026-10-28 根据已批准 V3 设计重新实现三端工作区，默认入口为 `/v3/workspace`，14 个模块覆盖四条本地 Mock 流程。React、Vue、Angular 的源码、领域规则、资源、依赖和测试分别独立。旧 `/dashboard`、`/devices`、`/labs` 等路径保留为教学兼容区，诊断入口迁至 `/diagnostics`。实际验证结果见 [QUALITY](docs/architecture/QUALITY.md)；不沿用遗失版本的通过数字，真实后端与最终人工验收尚未完成。

- [从设备业务链学习三个框架](docs/learning/README.md)。
- [需求](docs/prd/PRD.md)、[架构](docs/architecture/CONTEXT.md)、[已批准 V3](交互/README.md)、[V3 实施契约](docs/interaction/V3-IMPLEMENTATION.md)。
- [三端实际截图与独立审阅](交互/实现核对-20261028/README.md)。
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

本地三应用入口：分别在三个应用目录执行 `npm run preview`（先构建），然后在仓库根运行 `node tools/serve-portal.mjs`，访问 `http://127.0.0.1:14100/`。入口分别指向三端独立运行的 `/v3/workspace`，跨框架跳转是独立文档导航。

## 清理记录

2026-09-16 保留 15 张原型图及校验清单。永久删除被工具策略拒绝，旧代码、依赖和交付资料位于 Git 忽略的 `.cleanup-archive/2026-09-16/`，不得作为新工程依赖。Git 历史保留，归档占用空间尚未释放。
