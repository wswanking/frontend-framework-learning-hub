# 诊断与验收环境

关联 IOT-QUALITY-001、IOT-PLATFORM-003。2026-09-16 用户授权搭建；三端环境已完成本地验证。IoT 业务与 V2 设计验收仍未完成。

## 架构与范围

三个项目位于 code/apps/react、code/apps/vue、code/apps/angular。分别维护 package.json、package-lock.json、源码、样式、测试、工具脚本和所有配置。无根依赖安装，无共享运行时代码。React/Vue 使用各自 Vite，Angular 使用官方 CLI/AOT 与 strictTemplates。

最小诊断页验证空输入、超长输入、忙碌状态、失败反馈、输入保留和重试。它是工具链测试载体，不是产品交互图实现，也不替代任何业务需求验收。

## 环境与版本

本地验证：Windows，Node 24.19.0，npm 12.0.2。项目要求 Node 24.15+（24.x）。各端锁文件固定依赖；以下是本轮实际安装版本。

| 项目 | 框架 | 构建工具 | TypeScript |
| --- | --- | --- | --- |
| react | 19.3.0 | Vite 8.3.0 | 6.0.3 |
| vue | 3.5.42 | Vite 8.3.0 | 6.0.3 |
| angular | 22.1.6 | Angular CLI 22.1.8 | 6.0.3 |

三端 Vitest 4.1.11、Playwright 1.63.0。ESLint 已采用支持当前插件的 10.x，Stylelint 检查 CSS 语法和规则。并未把样式规则检查描述为视觉验收。

## 使用命令

在任一应用目录先执行 `npm ci`。

| 命令 | 检查范围 | 浏览器 |
| --- | --- | --- |
| npm run diagnose | 门禁负向测试、边界、类型/模板、ESLint、Stylelint、组件/逻辑测试、生产构建 | 不需要 |
| npm run browser:install | 安装 Playwright Chromium headless shell | 下载浏览器 |
| npm run test:e2e | 桌面和窄屏交互、运行错误、axe、横向溢出 | 需要，先 build |
| npm run visual:capture | 初始、校验失败、成功状态候选截图 | 需要，先 build |
| npm run test:visual | 验证审核记录与图像哈希，再比较视觉基准 | 需要；无审核基准时退出 2 |
| npm run verify | diagnose + e2e + 经审核的视觉比较 | 需要 |
| npm run report | 查看浏览器验收 HTML 报告 | 查看报告 |
| npm run trace -- 路径 | 查看失败 Trace | 查看报告 |

外层 `node tools/diagnose-all.mjs diagnose` / `build` / `test:e2e` / `visual:capture` / `test:visual` / `verify` 只调度各端，不提供共享编译器或依赖。失败返回非零退出码。

本地固定 Chromium 下载缓慢，本轮停止下载并通过 `PLAYWRIGHT_CHANNEL=chrome` 使用已安装 Chrome 执行了真实浏览器验证。默认配置和 CI 使用 Playwright 固定版本 Chromium；本轮不宣称 Linux Chromium 已验证。

## 2026-09-16 本地验证证据

| 检查 | React | Vue | Angular |
| --- | --- | --- | --- |
| 无浏览器诊断与生产构建 | 通过 | 通过 | 通过（AOT + 严格模板） |
| 边界/视觉门禁负向测试 | 4 通过 | 4 通过 | 4 通过 |
| 业务逻辑与组件测试 | 3 通过 | 3 通过 | 3 通过 |
| 浏览器行为、axe、窄屏无横向溢出 | 4 通过 | 4 通过 | 4 通过 |
| 候选图生成 | 6 张 | 6 张 | 6 张 |
| 视觉批准与基准比较 | 待审核，明确退出 2 | 待审核，明确退出 2 | 待审核，明确退出 2 |
| 仓库外独立 npm ci --offline + diagnose | 通过 | 通过 | 通过 |

独立性验证在系统临时目录分别复制每端源文件，排除 node_modules、dist、reports 和缓存后，使用本地 npm 下载缓存重新安装。不是复制已有 node_modules；三端各自在仓库外通过完整 diagnose。工作区根和 code 根均无 node_modules。

额外在临时 React 副本中运行故意失败的探针，确认退出码为 1，生成失败截图、error-context.md 与 trace.zip。故障用例未加入项目；证据保存在本地 `code/apps/react/reports/trace-probe/`。外层 build 成功；外层 test:visual 正确汇总三端 VISUAL_PENDING 并返回失败。锁文件与清单一致，文档本地链接和 git diff --check 通过。

## 报告位置

各应用独立保存：

- reports/unit.xml：组件与逻辑测试 JUnit。
- reports/e2e.xml、reports/playwright/：浏览器功能验收。
- reports/test-results/：失败截图、错误上下文和 Trace。
- reports/visual-candidates/：候选图，不自动变为基准。
- reports/visual.xml、reports/visual-report/、reports/visual-results/：视觉工具输出，不覆盖功能报告。

报告和依赖不入 Git；规范、测试、锁文件和已审核基准可入 Git。候选图报告附操作系统、浏览器版本、channel 与 viewport，审核时需固定环境和字体。

## CI

`.github/workflows/diagnostics.yml` 为三端矩阵任务，每个任务仅复制自己的应用到 runner 临时目录，再安装、诊断、构建、运行 Chromium 行为检查并生成候选图。报告通过 artifact 上传。

没有 Linux 视觉基准时，CI 摘要明确标记 VISUAL_PENDING；诊断任务成功不表示完整设计验收。一旦 Linux 基准标记 approved，CI 自动强制视觉比较。也可通过 workflow_dispatch 的 visual=true 显式执行完整视觉门禁，此时缺少基准会失败。

CI 配置已建立，但尚未推送或运行远程工作流；本轮没有部署。

## 后续接入业务

每个业务交互场景关联 IOT-* 编号，在各端新增各自组件测试和浏览器场景。图稿相符性先人工核对，确认后把候选图复制到 tests/visual/baselines，在 baseline-review.json 按操作系统记录审核人、日期和 SHA256。不能由 AI 自行填写产品设计批准，也不能把首次截图当成正确答案。

当前基准覆盖的是诊断页，不能用于 V2 产品验收。真实布局、焦点、滚动、字体和遮挡仍需浏览器验证；axe 自动扫描不能替代全部无障碍验收。Storybook 在产品组件形成后再按需接入，本轮不建立空展示页。

## 工具依据

- [Angular 官方测试环境](https://angular.dev/guide/testing)：CLI 的 Vitest/jsdom 和官方编译链。
- [Playwright 视觉比较](https://playwright.dev/docs/test-snapshots)：环境一致性与基准比较。
- [Playwright CI](https://playwright.dev/docs/ci)：浏览器安装和 CI 运行。

## 恢复检查点

环境配置及本地验证完成。下一步是按统一交互逐个建立业务页面与验收场景；当前无待修复的诊断失败。未完成事项为产品视觉基准审核、真实业务实现及远程 CI 首次运行，不应使用历史业务完成记录推进状态。

## 提交与临时文件整理

用户随后授权清理临时文件、提交并同步远程。已将本轮 37 个系统临时目录移到本机 LocalAppData/IoTAtlas/diagnostic-archive/2026-09-16；永久删除被自动审批策略拒绝（blocked by policy），因此采用可恢复归档，没有释放空间。后续门禁测试的临时夹具改放各端 reports/guard-fixtures，不再散落系统临时目录。依赖、缓存、报告、候选图及归档均不提交。
