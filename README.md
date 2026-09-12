# IoT Atlas · 前端框架学习中心

以物联网 SaaS 为真实业务场景的前端学习仓库。React、Vue、Angular 已分别使用 TypeScript 实现同一套 Dashboard、全球拓扑、设备管理、物模型、规则引擎、固件、OTA、租户管理与组件/图表实验室；所有逻辑在浏览器端以可复现 Mock 数据运行。

## 从这里开始

先阅读 [工程上下文](docs/CONTEXT.md)、[产品需求](docs/prd/PRD.md)、[当前计划](docs/plans/ACTIVE.md) 与 [AI 协作约定](AGENTS.md)。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
cd code
npm install
npm run dev
```

默认地址为 `http://localhost:13100/`。

## 代码与文档

- `docs/`：需求、架构、计划、契约与决策；不放运行时代码。
- `code/`：唯一运行时代码根目录，包含应用、共享包、测试、构建配置与静态资源。
- `code/app/`：当前可部署的 IoT Dashboard 学习门户基线。
- `code/apps/`：React、Vue、Angular 的独立实现位置。
- `code/packages/`：共享领域、Mock API 与设计令牌。

当前 PRD 业务范围已经完成。门户构建会同时生成并挂载三个框架应用，统一入口可直接进入任一框架的完整业务实现；完成证据见[当前实现审计](docs/acceptance/CURRENT-IMPLEMENTATION-AUDIT.md)。

## 命令

- `cd code && npm run dev`：启动本地开发服务。
- `cd code && npm run build`：构建门户、三个框架应用并将三端挂载到统一入口。
- `cd code && npm test`：运行类型检查、四个生产构建和全部自动化验收。
- `cd code && npm run lint`：运行全仓静态检查。
