# Vue V3 重建验证证据（2026-10-28）

本目录仅记录本轮实际执行。旧环境的历史通过数不作为本轮证据。最终执行期间源码冻结；源文件清单见 `source-sha256.txt`。

## 已完成诊断

`diagnose-final.log`：guards 4/4、边界、TypeScript、ESLint/Stylelint、27 个 unit 文件 131/131、生产构建通过。`unit-final.xml` 为该次 JUnit。
环境：Node 24.19.0、npm 11.9.0、系统 Chromium 154.0.8037.57（Debian 13）；原始输出见版本文件。

## 失败与修复记录

- `v3-initial.log`：初轮 18 通过、2 失败，原因 nodes 的 h1→h3 标题跳级。改为 h2 后 `v3-ready.log` 20/20 通过。
- `e2e-interrupted-before-reset-fix.log`：旧完整运行 74 通过、1 失败、2 主动中断、145 未运行；不作为完整验收。因实际发现工作区错误态重置后未恢复正常而主动中断，新增 reset 事件与回归断言；`reset-fix-test.log` 2/2。
- 该轮旧 OTA 多段闭环超过默认 30 秒总预算，原始 trace/截图保存在 `legacy-ota-timeout/`，`legacy-ota-timing.json` 记录逐步时长。70 个完成调用均无动作错误；在 30 秒附近仍正常导航历史并断言两次尝试，31.524 秒最后页面错误断言完成。仅该完整业务用例总预算改为 60 秒，所有单步 expect 与零重试保持不变。
- `diagnose-unit-timeout.log`：最终诊断第一次 130/131，旧 101 条规则遍历用例在多浏览器并行负载下超过 5 秒。未改源码、并发配置或超时：`device-events-isolated.log` 11/11（该用例 1.664 秒）；随后原样完整 diagnose 131/131。
- `domain-bounds.log`：新领域 15/15，包含 tags/unit trim、超长拒绝及失败事务原子性。

## 视觉与范围

`workspace-*.png`、`devices-*.png` 为实际浏览器截图；独立审阅证据另在仓库根 `reports/v3-rebuild-parity/`。实现以批准原型为依据，不宣称逐像素一致。`visual-gate.log` 退出 2：Linux 基线尚未人工审阅（VISUAL_PENDING）；未修改批准记录或替用户批准。

所有注册、遥测、命令、OTA、告警、成员、配额均为本端独立 localStorage Mock；未接生产后端、硬件或发布部署。

## 最终浏览器验证

`e2e-before-outline-fix.log`：222/222 通过（14.2 分钟），0 失败、0 跳过，命令显式 --retries=0。旧回归200例 + V3新增22例（桌面/移动各11）；V3包含14模块×4异常和14模块axe。`e2e-final.xml` 与 `playwright-final/` 为完整归档。完成后 `source-hash-check.log` 全部一致。

完整测试结束后，仅修正 `tests/visual/diagnostic.spec.ts` 环境附件字段：显式系统路径正确记作 explicit-executable，并附路径。不改变运行时或 browser 测试；单独 type/lint 与 visual:capture 验证，详见对应日志。完整运行所用哈希仍保留在 `source-sha256.txt`，最后哈希另记 `source-final-sha256.txt`。

后续父线程截图发现旧全局focus-visible导致非交互main出现橙色大框。仅V3 main移除该轮廓，保留skip和所有控件焦点轮廓，并在V3用例加入断言。修复后再次完整222零重试通过（6.6分钟），0失败/跳过；最终e2e-final.xml与playwright-final/已替换为该次归档，type/lint/build-landmark-final.log全部通过，source-final-hash-check.log全部一致。

最终归档以 `source-final-sha256.txt`、`build-manifest.json` 为准；之前222通过所用manifest另存 `build-before-outline-fix.json`。本次之后无待补产品源码修改。

最终同份源码完整unit再次通过27文件131/131（unit-final.log/XML）；visual:capture-final.log 2/2，visual-final.xml与visual-candidates-final/归档6张诊断候选。候选捕获不等于视觉基线批准，VISUAL_PENDING仍如实保留。
