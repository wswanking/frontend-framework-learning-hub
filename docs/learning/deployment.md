# 从构建到可回退候选：M4 本地实操

关联 IOT-PLATFORM-003、IOT-DELIVERY-001。先完成[设备与工程教学](engineering.md)。这里交付的是外层构建、证据和本地静态托管闭环；不连接真实发布平台。页面中的交付看板仍是独立 Mock，不能触发这里的脚本。

## 基础拓扑：三个独立根站点

React、Vue、Angular 分别拥有自己的 origin、依赖、锁文件、资源和存储。浏览器打开每站的 `/devices?...`。跨框架链接可以重新加载文档；站内路由保持 Shell。生产可对应三个域名，但本轮不创建域名、云资源或远程部署。

| 应用 | 独立构建命令（在各应用目录） | 静态根目录 | 本地示例端口 |
| --- | --- | --- | --- |
| React | `npm ci && npm run diagnose` | `dist` | 15101 |
| Vue | `npm ci && npm run diagnose` | `dist` | 15102 |
| Angular | `npm ci && npm run diagnose` | `dist/diagnostics/browser` | 15103 |

统一使用 Node 24.19.0；各应用仍可完全脱离仓库安装。记录 npm 版本、系统、架构、锁文件与源码指纹；版本范围不是可复现证据。`npm ci` 不更新锁文件。构建日志中的包体积提示与失败分别记录。这里的生产构建不等于生产部署。

## 一次完整本地验证

在仓库根目录执行（须已具备各端锁文件所需 npm 包与可用浏览器）：

```sh
node --test tools/tests/*.test.mjs
# 可选：指定已安装的系统 Chromium；不指定时使用 Playwright 对应浏览器。
export PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium
node tools/validate-local.mjs reports/m4-run-001
```

输出目录必须不存在。脚本将每端已跟踪文件复制到系统临时目录，各自 `npm ci`、边界负向检查、边界/类型/lint/unit/build；再构建一次比较全部文件字节。其后记录快照，执行完整桌面/移动浏览器套件，核验构建未改变，再封装。最后直接托管封包内的文件完成浏览器与 HTTP 检查，不从源码再次构建。托管检查为每端启动独立子进程并加载本端 Playwright，避免多个安装在同一进程相互干扰。

`ATLAS_NPM_CACHE=/path/to/cache` 只配置 npm 下载缓存，不共享 node_modules 或应用运行时。独立目录、原始日志和失败证据保留在 `isolated-directory.txt` 指向的位置；清理前先归档所需报告。两次构建一致仅证明本次相同输入、同一安装和工具链下的可重复性，不声称跨操作系统或未来依赖源的完全可复现。

候选 `candidate/manifest.json` 记录 Git 提交、dirty 状态及状态摘要、每端源码/锁文件摘要、Node/npm/系统、完整文件 SHA-256、unit/browser 数量和小型证据哈希。dirty 候选只能用于诊断；正式交接要求干净提交、可信工作流来源及实际审核。摘要能检测意外变更，不是签名或可信发布者认证。不要手改 manifest 来“修复”失败。

## 为什么测试完不能再重新构建

`.github/workflows/diagnostics.yml` 的三端矩阵各自隔离安装。诊断后执行 `artifacts.mjs snapshot`，记录文件清单及预计浏览器测试数量；完整浏览器通过后 `seal` 要求相同源码、相同 Git 状态、相同 unit 证据、完整且新生成的浏览器报告以及逐字节不变的 dist。陈旧、部分、失败、跳过的报告不能封装。

矩阵上传 `tested-react/vue/angular`，汇总作业下载后 `assemble` 比较三端同一来源/工具链与完整领域导出，直接复制这些已测试文件。它没有 npm install 或 build 步骤。候选截图或视觉门禁失败时矩阵失败，汇总作业不会运行；无已批准基线则仍明确 VISUAL_PENDING。远程工作流需实际运行后才能声称 CI 通过。

旧 `diagnose-all.mjs build` / `collect-build-artifacts.mjs` 仅输出 v1 **未测试构建包**，不能代替 v2 browser-tested 候选。两个 schema 不互相冒充。

## 本地托管、深链和缓存

```sh
node tools/artifacts.mjs verify reports/m4-run-001/candidate
node tools/static-site.mjs reports/m4-run-001/candidate/apps/react 15101
# 另开终端分别启动 Vue 15102、Angular 15103。
```

这是绑定 127.0.0.1 的本地验证服务器，不承担生产 TLS、压缩、访问控制、CDN 或监控。打开 `http://127.0.0.1:15101/devices?productId=prod_as_001&status=online&pageSize=2&page=2`，打开详情后刷新，确认筛选与详情保留；关闭详情，导航到大盘再返回。未知业务路由由客户端显示“页面不存在”。

服务器只对 HTML 文档请求且无文件扩展名的业务路径回退 index.html；`/assets/missing.js`、`/source/missing` 等资源必须真实 404，不能回退 HTML 后引发脚本 MIME 错误。HTML 与非指纹配置资源使用 `no-cache` 和 ETag；符合当前构建命名规则的八位指纹 JS/CSS/字体使用一年 immutable。`no-cache` 表示缓存前重验证，不等于不允许缓存。工具测试覆盖 HEAD、304、405 和路径/符号链接越界。

任何前端环境变量、配置 JSON、源码展示文件都能被访客读取，不存放令牌、数据库口令或服务端密钥。需要后端鉴权时单独设计服务端边界，本轮不添加后端。当前公开的本端源码是教学功能。

## 发布与回滚演练

1. 保留两个独立、只读的版本目录 A/B，各自包含 manifest、apps 和 evidence；用 `artifacts.mjs verify` 检查。B 必须有本次完整证据，A 必须是已验证版本，不能只保留源码提交号。
2. 启动 B 的临时本地端口，运行 `verify-local-candidate.mjs <B> <新报告目录>`；它直接验证候选文件、设备详情深链刷新、站内导航、未知路由、资源 404、缓存。默认使用仓库各端自己的 Playwright，第三参数可指定独立安装目录的父目录。
3. 本地先记录 A 的文件摘要与可访问结果，停止当前本地服务器，再用同一端口启动 B；检查页面与产物摘要。发生回退时停止 B，按同样方式启动 A，重新检查。工具夹具覆盖版本根切换；真实远端原子切换、零停机与 CDN 行为需在选定平台另验。
4. 真实平台发布不能只覆盖旧文件：保留旧指纹资源一段兼容窗口，避免已打开的旧页面请求懒加载 chunk 时 404。HTML 入口切换和旧资源保留策略须结合 CDN/平台实现，不能声称本地重启已解决线上多版本请求。
5. 记录版本、提交/锁文件/构建摘要、操作者、原因、时间、验证结果与恢复目标。视觉批准、权限/安全/回滚审核和正式验收另行完成。切换域名、上线、回滚远端均需明确授权。

## 子路径属于进阶配置

当前三端以根路径工作。**不能直接把三个 dist 放到 `/react/`、`/vue/`、`/angular/` 就宣称支持。** 需要分别配置 Vite base 与 React router basename、Vue createWebHistory base、Angular base href（必要时 deploy URL），并逐项修正绝对资源/实验室 iframe/源码链接和跨端入口。服务器也必须知道前缀。`static-site.mjs` 的可选 `/prefix/` 参数只验证服务器能力，不改写应用或提供完整子路径兼容；应另开增量配置、重新构建并完整回归后交付。

本轮证据与未运行项见 [QUALITY](../architecture/QUALITY.md)。
