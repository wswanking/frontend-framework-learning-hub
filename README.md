# IoT Atlas · 三框架独立实现

旧业务代码已清理。当前搭建 React、Vue、Angular 各自独立的诊断与验收基座，业务页面待按统一交互重新实现。

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
```

`diagnose` 无需浏览器；`test:e2e` 和截图需要浏览器引擎，可在 CI 无界面执行。候选截图不等于设计验收；`test:visual` 在当前系统没有审核基准时明确失败，`verify` 才是包含视觉检查的完整门禁。

外层用 `node tools/diagnose-all.mjs diagnose` 调度三端，不需要根 package.json 或根 node_modules。各端源码、依赖、锁文件、配置、测试和资源均独立维护。

## 清理记录

2026-09-16 保留 15 张原型图及校验清单。永久删除被工具策略拒绝，旧代码、依赖和交付资料位于 Git 忽略的 `.cleanup-archive/2026-09-16/`，不得作为新工程依赖。Git 历史保留，归档占用空间尚未释放。
