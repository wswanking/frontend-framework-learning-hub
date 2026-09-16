# IoT Atlas angular 诊断与验收基座

IOT-QUALITY-001 / IOT-PLATFORM-003。仅诊断页面，业务功能待实现。本目录可独立复制使用，不依赖父目录。

Node 24.15+（24.x）。先 npm ci，再运行：

- npm run diagnose：无浏览器，边界/类型/模板/Lint/组件测试/构建。
- npm run browser:install：安装 Chromium。
- npm run test:e2e：先 build，启动 14103 生产预览，检查桌面/窄屏实际交互及无障碍。
- npm run visual:capture：生成 reports/visual-candidates 中的候选图，不自动批准。
- npm run test:visual：没有审核当前系统基准时以 VISUAL_PENDING 退出 2。
- npm run verify：完整门禁，必须包含已审核视觉比较。
- npm run report：查看 HTML 报告；npm run trace -- <trace.zip> 回看失败现场。

每端单独维护依赖、源码、资源、测试及配置。Storybook 可在产品组件建立后接入，当前不添加空的展示目录。

## 基准审核

人工审核候选图后复制到 tests/visual/baselines，保留 desktop/mobile 子目录。在 baseline-review.json 的 platforms 下按 win32/linux/darwin 记录 status=approved、reviewer、reviewedAt 和 sha256（相对基准目录路径到哈希的映射）。每平台 6 张图，工具检查完整性及审核后文件未变化。诊断页基准不代表 V2 产品设计验收；各平台分开审核。

CI 未实际执行前不得宣称远程通过。无浏览器时可以完成 diagnose，但完整交互和视觉必须另行执行。

本地如已有 Chrome，可设置 PLAYWRIGHT_CHANNEL=chrome 执行浏览器检查；默认使用 Playwright 固定版本 Chromium。截图审核需固定操作系统、浏览器版本和字体，不将不同环境的候选图混用。
