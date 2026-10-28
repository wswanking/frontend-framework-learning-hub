# Angular V3 本轮重建验证（2026-10-28）

源码最后修改提交：`3efc352`。本端源码在最终 diagnose → 完整浏览器 → 视觉候选采集链执行期间冻结；`frozen-source.sha256` 包含 155 文件，最终全部匹配，详见 `frozen-source-verification.txt`。未沿用上一轮丢失环境的结果。

| 检查 | 本轮实际结果 | 证据 |
| --- | --- | --- |
| guard 脚本 | 4/4 通过 | diagnose-final.log |
| 边界、类型、lint、build | 全通过 | diagnose-final.log |
| 完整 unit | 28 文件、151/151 通过，0失败 | unit-final.xml |
| 完整 browser | 246/246 通过，0失败、0跳过、0重试，13.0 分钟 | e2e-full-final.log、e2e-full-final.xml、playwright-full/index.html |
| 诊断视觉候选采集 | 2/2 通过，六张候选图 | visual-capture-final.log、visual-final.xml、visual-candidates-final/ |
| 视觉基线验收 | 待人工批准，VISUAL_PENDING，exit 2 | visual-check.log |

完整浏览器包含原有 200 回归及新增 46 V3 测试：14 模块导航/持久 Shell/四种异常状态、axe、四条本地 Mock 闭环、角色及配额、URL 状态恢复、CSV 已应用参数隔离、电表领域差异、后退/前进/刷新/未知路由脏数据保护、移动导航及嵌套对话框焦点返回。两视口均执行，无过滤或重试。unit-final.xml 在根级旧 DTO parity 执行前已独立归档，保留完整 151 条报告。

真实渲染证据：`workspace-desktop.png`、`workspace-mobile.png`、`devices-desktop.png`、`devices-mobile.png`。最终桌面和移动图已实际查看；不存在空 toast、页面横向溢出，工作区 breadcrumb、图表白底/折线、黄色离线状态、桌面 224/64 和移动收起导航已复核。图标采用 Unicode，部分细微样式不宣称像素一致，也不代替人工视觉批准。

阶段失败和修复保留：初版新测试 16 通过/2 失败（导航告警计数改变可访问名称），补稳定 aria-label；下一版 16 通过/2 失败（Angular 同路径导航 NavigationSkipped 未关闭移动菜单，以及单个聚合异常/axe 测试 90 秒预算超时），处理 NavigationSkipped 并拆分为每模块独立测试，所有断言保留。最终全部 246 通过。旧设备流程时钟安装与暂停时刻改固定且明确未来时间，避免并发墙钟竞争，原业务断言保留。嵌套 product/field 和 alarm 对话框保留根触发元素，专项 4/4 通过，亦纳入最终完整套件。

环境：Node v24.19.0、npm 11.9.0、系统 Chromium 154.0.8037.57，`PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium`。版本原始输出见 versions.txt；视觉元数据标明 explicit-executable 和真实 browser.version，不冒充 Playwright 默认浏览器。

范围与限制：14 模块由 Angular standalone Shell、页面及按功能分组组件实现，Signals / Reactive Forms / Router 原生交互；各端源码、Mock、领域规则及测试独立。数据仅本浏览器本地模拟，注册、遥测、命令、OTA、邀请、连接及通知均不连接真实后端/硬件/邮件。构建成功不等于部署验证；未合并、未部署、未批准视觉基线。源码与构建部署教学见仓库 docs/learning/angular.md。
