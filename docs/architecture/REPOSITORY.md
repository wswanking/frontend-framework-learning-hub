# 仓库结构与代码边界

```text
frontend-framework-learning-hub/
├─ AGENTS.md                 # AI 协作入口与开发循环
├─ docs/                     # 只放知识、决策、计划、验收
│  ├─ prd/  ├─ architecture/  ├─ contracts/  ├─ decisions/  └─ plans/
└─ code/                     # 唯一运行时代码根目录
   ├─ app/                   # 当前部署入口：IoT Atlas 学习门户
   ├─ apps/                  # React、Vue、Angular 独立实现
   ├─ packages/              # 跨框架、无 UI 耦合的可复用代码
   ├─ tests/                 # 自动化验证
   └─ public/                # 静态资源
```

## 根应用职责

[Dashboard 应用](../../code/app/)是当前可部署的项目入口，不是三个框架业务应用之一。它承担学习导航、产品基线和首个 Dashboard 原型；当 [React 应用](../../code/apps/react/) 完整落地后，根门户只链接或展示进度，不复制业务代码。

## 依赖方向

```text
docs（规范）
  ↓
code/packages/domain ← code/packages/mock-api ← code/apps/{framework}
  ↓                                  ↑
code/packages/design-tokens ─────────┘
```

[应用目录](../../code/apps/)可以依赖[共享包目录](../../code/packages/)；共享包不可以依赖应用；文档不可以被运行时代码导入。任何反向依赖都需要 ADR。

## 暂不引入

不启用真实后端、D1、R2、鉴权、外部地图密钥或真实文件上传。若需求需要这些能力，先创建 ADR 和独立 PRD 需求，再调整运行时配置。
