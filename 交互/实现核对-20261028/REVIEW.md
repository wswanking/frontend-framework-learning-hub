# 2026-10-28 V3 重建独立审阅

本目录是本轮重新执行的证据，依据批准设计 d809519 和本轮 V3-IMPLEMENTATION.md。不是遗失源码的同字节恢复，也不复用旧轮通过数字。审阅者只读产品文件，修复由各实现owner完成；证据脚本位于产品运行时之外，不成为共享运行依赖。

## 证据与复现

使用 Node24、本端 Playwright/axe 依赖、系统 `/usr/bin/chromium`，独立只读preview端口14601/14602/14603，避免占用owner的141xx测试服务。

- `domain-audit.mjs`：本端真实命令边界（Vue为store.command），对照原型精确seed，四流程、权限、事务、OTA失败only/删除/重复目标、存储恢复、字段trim与超长拒绝。`domain-results.json`包含检查时源码SHA；每端20场景。
- `browser-audit.mjs`：14模块常驻Shell/同文档、56异常/端、CSV已应用查询与草稿隔离、深层未知路由、电表边界、224/64几何、390手机菜单焦点/空toast/横溢出。
- `dirty-audit.mjs`：每端12个真实浏览器场景，包括后退/前进取消和接受、路由取消、原生beforeunload取消和接受、Escape/焦点、未知路由历史目标与Shell身份。取消刷新不等待不存在的load。
- `accessibility-audit.mjs`：每端14模块×桌面/手机；记录WCAG2/2.1 A/AA violations、需人工判断的incomplete及页面横溢出。`REVIEW_MODULES=workspace`等只复核受影响页面，`*-axe-recheck.json`保留追加记录。
- `responsive-audit.mjs`：1050/1051及680/681临界、390手机，验证导航折叠、单列布局、表格键盘滚动入口与横滑提示。
- `react-final-delta.mjs`：最后修复的手机影子标签和值不重叠；main landmark无旧橙色outline（保留实际控件的键盘焦点提示）。
- `vue-final-delta.mjs`：1440/390两视口删除清理勾选、dialog Tab圈定、触发按钮被删除时回main、刷新后删除保留。
- `capture-final.mjs`：6张最终工作区桌面/手机图，`*-capture.json`记录浏览器版本、构建时间、dist index SHA、PNG SHA。
- `summarize.mjs`：汇总生成稳定`summary.json`，明确自动审阅状态与`VISUAL_PENDING`。
- `teaching-links.json`：三端中文教学83条本地源码链接均存在。

运行示例：

```sh
node reports/v3-rebuild-parity/domain-audit.mjs react vue angular
node reports/v3-rebuild-parity/browser-audit.mjs react vue angular
node reports/v3-rebuild-parity/dirty-audit.mjs react vue angular
node reports/v3-rebuild-parity/accessibility-audit.mjs react vue angular
node reports/v3-rebuild-parity/responsive-audit.mjs react vue angular
node reports/v3-rebuild-parity/capture-final.mjs react vue angular
node reports/v3-rebuild-parity/summarize.mjs
```

## 本轮发现与修复核对

- 统一OTA首次/正常推进管理员权限、运维仅失败重试及重试中推进；重试只核验本次失败目标，已成功设备删除不阻碍失败项恢复；重复目标拒绝。
- Vue原数组shape把电表当温控结构导致正常保存快照被重置，已改为产品联合结构并验证roundtrip；非法连接器FTP拒绝。
- unit/tags统一trim及12/80字符上限，超长领域拒绝，不截断，失败不残留状态/审计。
- Angular图表背景/曲线、告警数、连接状态标签及导航行距已按批准稿复核；React手机影子字段重叠、非交互main的旧焦点轮廓已复核修复。
- 新代码保持React父Outlet/hooks/Context、Vue SFC/RouterView/composables、Angular standalone/Signals/ReactiveForms/RouterOutlet；壳、视图、领域、存储按职责拆分。静态审阅未发现iframe、HTML字符串注入或跨应用运行时导入。
- URL持有已应用查询/页签，页面持有草稿/勾选，独立localStorage持有已提交领域状态；旧路径为教学兼容区，不能充当V3完成证据。

一次Vue首轮执行正遇构建清空dist而未启动，构建结束后完整重新执行；一次测试误把outline-width非零视作可见，已改为同时检查outline-style:none的真实CSS语义。两者是审阅工具/时序问题，不伪装产品回归。

## 限制

自动axe不能替代屏幕阅读器和全部人工检查，incomplete不标为通过。实际桌面/手机截图已与批准图比较，但Unicode图标、个别文案/状态标签微观样式等不承诺逐像素相同。本轮未代用户批准视觉基线或最终验收。四业务流程都是本地Mock，不代表硬件、邮件、鉴权或生产服务接入。

每端完整类型/lint/unit/build/E2E和远程精确提交CI以owner/根线程报告为准，不能由本目录独立抽查结果替代。`summary.json`是本审阅范围内自动结果；`VISUAL_PENDING`保留。

## 定稿

独立范围内60/60领域场景、42模块路由、168异常状态、36脏数据/历史/刷新场景通过；84页axe零违规、零页面横溢出。三端产品嵌套对话框精确回原产品行按钮，桌面/手机共6场景通过。Angular最终焦点修复3efc352构建已复核。新增源文件清单 `source-provenance.json` 绑定HEAD 3efc35285ce0c244623aff1958076bc5fdbf499c 与三端无未提交生产源码的SHA；最终dist/截图对应 `*-capture.json`，不把前期完整矩阵假称每次最终构建都重跑。

完整独立矩阵运行后仅针对产品改动做影响复核，最后重新捕获6图；各端最终完整suite与远程CI另由根线程汇总。移动影子排版、标签规范化、错误重置、删除选中项、嵌套焦点等修复均有针对性证据。

独立审阅预览14601/14602/14603已在完成后停止，未影响owner的141xx测试服务。产品文件未由本审阅者修改、提交或推送；报告与脚本供根线程选择持久归档。
