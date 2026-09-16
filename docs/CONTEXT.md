# 工程上下文

2026-09-16，按用户要求清理实现，仅保留需求、架构和交互。随后用户授权建立诊断环境，当前 code/apps 仅有三端独立诊断基座，IoT 业务未实现；旧运行结果不作为新实现验收证据。

## 阅读顺序

1. [总 PRD](prd/PRD.md)与[模块需求](prd/README.md)。
2. [架构边界](architecture/CONTEXT.md)与[仓库结构](architecture/REPOSITORY.md)。
3. [领域与 Mock 契约](architecture/contracts/README.md)。
4. [统一交互 V2](interaction/UNIFIED-V2.md)与[交互规格](interaction/README.md)。

三端各自维护全部代码与资源，不共享运行时包，不相互导入，不依赖父目录安装的依赖。功能、字段、权限、Mock 确定性规则与交互由共同文档约束，各端独立实现与验证。

本轮关联 IOT-PLATFORM-003。React、Vue、Angular 均待重新实现。交互设计通过不代表功能已实现。可恢复归档说明见根 README。

当前工作与检查点：[诊断与验收环境](architecture/QUALITY.md)。
