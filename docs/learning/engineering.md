# 从源码到浏览器：每条命令在做什么

先完成[设备操作教程](README.md)。所有应用命令都在所选 `code/apps/<framework>` 内运行。读取自己的 package.json，而不是猜测另一个框架的脚本也相同。

| 阶段 | 本仓库操作 | 得到什么 | 不代表什么 |
| --- | --- | --- | --- |
| 安装 | npm ci | 按本端锁文件安装依赖 | 不运行应用、不批准依赖升级 |
| 开发 | npm run dev | React/Vue 为 Vite；Angular 为 ng serve，带开发更新能力 | 不是生产静态托管 |
| 类型检查 | npm run typecheck | React tsc、Vue vue-tsc、Angular ngc + 工具 tsc 检查 | 通过不保证点击行为正确 |
| 单元/组件测试 | npm run test:unit | Vitest；Angular 通过 ng test 构建测试 | DOM 模拟环境不是完整浏览器 |
| 生产构建 | npm run build | HTML、JS、CSS、资源与懒加载块 | 没有上传任何站点 |
| 预览 | npm run preview | 读取已有 dist 启动本地 HTTP 服务 | 不会自动重新构建、不等于线上服务器配置 |
| 浏览器测试 | npm run test:e2e | Playwright 启动已有生产构建并执行桌面/移动场景 | 不会自动运行 build，也不批准视觉基准 |

React 的 TSX、Vue 的 SFC、Angular 的模板都要转换成浏览器可执行的 JavaScript。类型信息在运行时不会自动保护输入，所以设备服务仍校验权限、名称、版本等。Vite 构建的代码转换不能代替 tsc/vue-tsc；Angular 的生产构建同时涉及模板编译与优化，项目仍保留显式 typecheck 方便快速定位。

## 做一次完整本地检查

停止手动启动的同端口 preview，避免与 Playwright 自己的 webServer 冲突。依次执行：

```sh
npm run diagnose
npm run browser:install
npm run test:e2e -- --workers=1
npm run report
```

`diagnose` 包含门禁负向测试、边界、类型、ESLint/Stylelint、单元测试和 build。React/Vue 的输出是 `dist/`，Angular 的静态根是 `dist/diagnostics/browser/`，不要把它的父目录当作站点根。

固定浏览器无法安装时，先保留错误。若环境已经允许使用系统 Chromium，可显式执行 `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --workers=1`（POSIX shell），并记录实际版本。它不是固定 Playwright 浏览器通过的证据。当前环境限制见 [QUALITY](../architecture/QUALITY.md)。

浏览器测试失败先打开报告和 trace：定位用户最后一步、URL、DOM 快照及控制台。不要第一时间增大超时或删除断言。比如“取消离开”应等待对话框被处理，不能等待一次本来就被取消的文档 load；暂停测试时钟后，需要明确推进框架渲染帧。

## 对照产物理解懒加载与缓存

构建后打开 dist/index.html（Angular 用上述 browser 目录），找到模块脚本和样式路径，再在 dist 中找到对应文件。使用 preview 打开 `/devices?device=dev_as_001`，观察首次加载的 JS 块与再次站内切换的差异。懒加载分包由 bundler 生成，不是每次导航重新下载整个 HTML。

在开发模式修改组件时，HMR 可能复用模块/状态，也可能重新加载。是否持久化要看 URL 和本端 localStorage，不能依赖 HMR 偶然保留的内存。生产环境则只提供构建后的字节；修改源码不会让已部署站点自动更新，必须经过新的构建、验证与发布流程。

部署时还需要 SPA 深链回退、正确静态资源 404、缓存策略和版本切换。三独立站点为基础拓扑；子路径部署要同时调整构建资源 base、router base、静态资源绝对路径及服务器前缀，不能只移动 dist 目录。具体本地验证和发布/回滚操作见 [M4 部署实操](deployment.md)，远端平台尚未选定。

前端环境变量无论叫 VITE_*、Angular file replacement 还是运行时 JSON，只要传给浏览器就可被读取。只能放公开的 API 地址、功能标记等；秘密必须由真实服务端保管。这个项目没有真实后端，也没有把 Delivery Mock 的“发布”按钮接到部署平台。

## V3 与教学兼容区的验证

默认入口为 `/v3/workspace`，诊断页为 `/diagnostics`。先独立安装本端依赖，执行 `npm run diagnose` 生成生产产物，再运行完整 `npm run test:e2e -- --retries=0`；`-- v3.spec.ts` 只做V3专项，不能代替旧业务加V3的完整回归。最后修改源码后需要重新构建并复验，报告记录对应提交及源码摘要。

构建输入是各端真实TSX、SFC、Angular组件/模板，不是 `交互/index.html`。源码与已保存Mock、URL、页面草稿属于不同层次；真正服务端校验、异步取消和并发冲突仍需独立后端设计，不可把同步Mock成功推断成生产能力。
