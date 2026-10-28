# IoT Atlas：AI 协作约定

开始工作前阅读本文件。用户最新指令优先。

## 当前阶段

2026-10-28 已从远端 M1–M4 基线和批准的 V3 交互重新实现三端独立工作区。默认 `/v3/workspace` 覆盖14模块、四条本地Mock流程；旧业务路由保留教学兼容。阶段代码已推送独立分支，完整验证与精确提交CI以 QUALITY 最新记录为准。真实后端未接入，视觉人工验收仍 VISUAL_PENDING；不得依据自动测试或局部截图宣称最终产品验收通过。

## 信息源

1. 用户当前指令。
2. [总 PRD](docs/prd/PRD.md)与模块需求。
3. [架构规范](docs/architecture/CONTEXT.md)、[仓库边界](docs/architecture/REPOSITORY.md)与[领域契约](docs/architecture/contracts/README.md)。
4. 已批准 [V3 设计](交互/DESIGN.md)与 [V3 实施契约](docs/interaction/V3-IMPLEMENTATION.md)；[统一交互 V2](docs/interaction/UNIFIED-V2.md)保留为旧教学路由依据。

## 独立维护原则

- 三端各自维护全部代码、Mock、领域规则、资源、依赖清单、锁文件、构建配置与测试。
- 不共享运行时包，不跨应用导入，不依赖父目录 node_modules 或其他应用资源。
- 共同遵循一套功能与交互文档，各端独立实现和验证同样字段、权限、状态与 Mock 结果。
- 统一构建仅在外层调度并汇总产物。
- docs 不放运行时代码；本地 .cleanup-archive 不参与实现或验收，不得提交归档依赖和构建产物。

## 工作与验收

先读工程上下文，将任务映射到 IOT-* 需求编号。用户改变需求时回写 PRD。实现采用最小可验证增量，使用各框架惯用模式，运行相称检查，并明确三端分别完成到哪一步。

不得自行批准关键交互、架构、权限、安全、部署或最终验收；已有用户明确指令时据实记录，不重复请求相同授权。本轮进展与验证证据记录在 docs/architecture/QUALITY.md，不创建空的计划、看板或交付证据暗示业务已实现。
