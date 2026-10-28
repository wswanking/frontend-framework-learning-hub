# React V3 重建验证（2026-10-28）

仅记录本次可访问源码与新环境实际执行结果，不沿用遗失实现轮次结果。

## 环境与范围

- Node v24.19.0；系统 Chromium 154.0.8037.57，Debian GNU/Linux 13。见 environment.log。
- npm ci 使用 /tmp/react-npm-cache，成功；未新增运行依赖。见 install.log。
- 14 个 React 原生模块，4 条本地 Mock 闭环；旧教学页面仍独立保留，诊断迁往 /diagnostics。
- frozen-source.json 记录最终源文件、测试、脚本与配置的 SHA256；完整诊断和浏览器测试使用同份源码/构建。

## 验证进度

最终 diagnose 已通过：4 guard 测试、独立边界检查、TypeScript、lint、27 文件 126 unit 测试、build 4.49s。完整零重试浏览器套件 **224/224 通过（14.0min）**：desktop112/mobile112，含 V3 新测试22；0失败、0跳过、0重试。见 e2e-final.log、e2e-final.xml、playwright-final/；单测 XML 已归档 unit-final.xml。

已完成的阶段验证：domain-first.log（9 测试）、typecheck-stage1.log、typecheck-ui.log、lint-ui.log、build-ui.log 全部通过；v3-first.log 22/22 通过。最后补充 unit/tags 长度契约，domain-final.log 10/10 通过。

e2e-interrupted-before-length-contract.log 是为修复最终契约主动中断的旧构建运行（exit 130），不可计作最终全套通过。对应旧诊断保留于 diagnose-before-length-contract.log。

## 实际修复与边界

- 初轮真实截图发现移动端 shadow 技术标签覆盖值，局部网格换行修复；旧全局 main 焦点橙色 outline 渗入 V3，局部移除非交互 landmark outline，键盘控件/skip 焦点仍可见。
- 单位/标签现按 trim 后最长 12/80 校验；超长拒绝而非静默截断，单测验证原子性。
- 历史 clock 回归改为显式固定 epoch 后前进，避免 install/pause 的时间倒退；保留原断言。
- 改诊断 URL 包含 browser、dashboard 辅助导航、visual/capture 路径，未批准或重写视觉基线。
- visual-gate.log 真实结果 VISUAL_PENDING：Linux baseline 尚未人工审阅；不能声称视觉验收通过。
- 本地数据、遥测、命令、OTA、连接测试均为 Mock；没有设备/后台生产集成。build 的既有大 chunk 警告不等于失败。

## 可查看证据

screenshots/ 包含 desktop/mobile 的 workspace、devices、device-shadow、ota-failure 实际截图。独立跨端 reviewer 证据在仓库 reports/v3-rebuild-parity/；其计数单独记录，不与本端套件相加。

## 运行器问题记录

主动中断后父 shell 已返回 exit130，但 Playwright 子进程曾遗留：先造成端口启动拒绝（e2e-startup-port-conflict.log），随后发现新旧 runner 重叠、旧页面加载等待超时。已显式停止本端两个 runner/preview，保留 e2e-interrupted-overlap.log 与 overlapping-run/ 下 trace/error context，确认仅一个 React runner 后重新执行全套；没有放宽断言、跳过测试或改 retries。

## 最终源码与独立审阅

全套结束时 133 文件 SHA256 均匹配 frozen-source.json（source-verification.log），源码与最终 build 一致。之后按审阅要求仅修 tests/visual/diagnostic.spec.ts 的 render-environment 元数据，让显式系统浏览器标注 explicit-executable 和路径；此项不改变运行时代码或 browser 用例，单独执行 typecheck/lint/visual:capture。该元数据差异不会伪装为全套执行前已有，最终差异见 post-browser-manifest.json。

独立 reviewer 最终证据：仓库 reports/v3-rebuild-parity/react-final-delta.json（main 焦点不绘制橙框、390px 影子标签和值间隔10px）、react-nested-focus.json（产品嵌套弹窗桌面/移动准确返回按钮）、domain-results.json（本端20/20领域独立断言）。这些不与本端126unit、224browser混算。

视觉元数据修改后 typecheck、lint 通过；visual:capture **2/2 通过（14.6s）**，产生6张诊断候选截图（desktop/mobile × initial/invalid/success）。见 typecheck-visual-metadata.log、lint-visual-metadata.log、visual-capture.log、visual-final.xml；候选在 ../visual-candidates/，不是已批准产品基线。最终视觉门禁仍 VISUAL_PENDING，未人工批准。

## PR #2 首次 CI 失败与最小修复

精确运行 40688405912 / React job122816647559（PR合并测试765c6ddb，head2f00616）：guard4、unit126、build通过，浏览器222通过/2失败；desktop/mobile的56异常矩阵都在 loading 标题断言失败，自动retry1仍失败，0 flaky。原始日志归档 ci-original/react-job.log，远端诊断artifact12816745001保留trace；证据封装随浏览器失败拒绝，不属于独立产品失败。

Shell 曾在 location.key/path 的 passive effect 里异步重置 scenario，持久select在路由提交期间可继续操作；测试nav也未等待目标内容。修复为单个当前 URL（pathname+search）所属的scenario状态，路由render派生normal并清除前URL选择，避免延后effect覆盖下一次选择，不缓存所有页面；同URL点击保持已选异常。dirty/modal逻辑保持原样。nav helper现在等待目标h1。

新增同URL真实点击保持加载断言嵌入原case，所有56异常/axe断言保留，无新增retry或放宽等待。原Shell负对照desktop/mobile2/2失败，修复后矩阵2/2通过16.8s：ci-negative-same-route.log、ci-negative-results/、ci-fix-matrix-final.log。旧矩阵在154重复5×2为10/10通过（ci-race-reproduction.log），因此不声称CI153原始时序已本地稳定复现。

153下载被cdn.playwright.dev返回403 Domain forbidden，artifact文件引用读取被Tunnel403拒绝；已停止而未绕过。ci-browser-install.log记录限制。新远端精确CI负责153复验。本地继续使用实际系统Chromium154.0.8037.57。

修复后的完整diagnose通过：guard4/4、unit126/126、boundary/type/lint、build1.75s；ci-fix-diagnose.log、ci-fix-unit-final.xml。新冻结源码记录ci-fix-frozen-source.json。完整224零retry结果将在运行结束后记录。

### 修复后的测试 helper 修正（不隐藏第二轮失败）

中间运行40690310405 / job122823129593（head0905a2a）222通过/2失败，0 flaky；56异常矩阵已在153两端通过，失败变为 identity/search 的取消离开测试：新 nav helper 错误地在取消成功、页面仍停留settings时等待设备中心h1。本地对应轮同样222通过/2失败（7.2min）。证据：ci-original/react-fix1-job.log、ci-fix-helper-failure.log、ci-helper-failure/。

随后只拆分测试助手：clickNav仅触发导航供取消断言使用，nav为已预期成功的操作等待目标h1；两处prompt(false)改用clickNav，取消后的URL、草稿、再次编辑/离开保护断言不变。全文件检查没有其他取消/权限拒绝调用nav。runtime为0905a2a，测试helper修正提交874d036。

最新diagnose再次通过guard4、unit126、边界/type/lint/build1.93s，随后完整224零重试重新运行；不把上面的失败轮当作最终通过。

### 修复最终结果（本地）

- 完整 browser **224/224通过，6.9min，零重试、零失败、零跳过**；desktop/mobile112各，含V3各11。关键56异常矩阵、同URL加载保持、取消导航guard均通过。
- 证据：ci-fix-e2e-final.log、ci-fix-e2e-final.xml、ci-fix-playwright-final/；此前失败日志/trace全部保留，没有覆盖成成功。
- ci-fix-frozen-source.json 的133个文件在全套结束逐一SHA核验一致，见ci-fix-source-verification.log。运行时0905a2a、测试helper874d036，与本次diagnose/build相符。
- visual:capture 2/2通过；ci-fix-visual-capture.log、ci-fix-visual-final.xml。实际workspace/devices/shadow/OTA桌面移动截图由最终V3测试重新采集到screenshots/，视觉baseline仍待人工审阅。
- 精确最终HEAD远端CI由父线程跟踪；不把0905a2a失败的中间运行或本地154通过冒充最终153云端成功。
