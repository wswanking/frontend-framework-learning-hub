# 仓库结构与边界

```text
frontend-framework-learning-hub/
├─ AGENTS.md
├─ README.md
├─ code/apps/{react,vue,angular}/ # 独立诊断基座，业务待实现
├─ tools/diagnose-all.mjs         # 仅外层调度
├─ .github/workflows/            # 各端隔离 CI
└─ docs/
   ├─ CONTEXT.md
   ├─ prd/                  # 总需求与模块需求
   ├─ architecture/         # 架构边界
   │  ├─ contracts/         # 领域、字段、权限与 Mock 规范
   │  └─ decisions/         # 架构决策
   └─ interaction/          # 交互行为与页面规格
      ├─ design/            # 设计语言
      └─ assets/            # V1 原型、V2 图稿及校验清单
```

本地隐藏的 `.cleanup-archive/` 是清理时保留的可恢复资料，不属于当前项目，不得作为实现依赖或验收依据。Git 历史保留。

未来应用无论同仓或分仓，都必须满足[独立维护边界](CONTEXT.md)。每个项目拥有完整代码、资源、配置、依赖清单、锁文件和测试。公共目录仅保存规范；统一构建仅调度和收集产物。
