# 三端交互一致性机器检查（2026-09-12，验收已撤销）

> 2026-09-14：用户复核确认三端交互仍不一致。本文件仅保留当时的构建、源码标记与契约测试结果，不再作为交互验收通过的证据。新的候选基线见[统一交互 V2 评审包](../interaction/UNIFIED-V2.md)。

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 根首页只有三个应用入口 | 通过 | 服务端渲染测试断言恰好三个 `.launcher-card`，且无数据大盘、全球节点、交付看板文本 |
| 三端一级导航一致 | 通过 | 八个模块名称、顺序、应用壳层标记由跨框架测试逐端断言 |
| 三端路由可直达 | 通过 | React HashRouter、Vue Router Hash History、Angular Router Hash Location 均纳入源码与构建检查 |
| 交互图视觉语言 | 通过 | 深色画布、分层表面、青色主信号、状态色、左导航、顶部上下文和响应式布局分别在三端独立样式中实现 |
| 业务契约未回退 | 通过 | Mock API、Dashboard、拓扑、产品、设备、规则、固件、OTA、租户测试全部通过 |
| 独立生产构建 | 通过 | 三端 Vite 构建成功，产物已由 staging 脚本写入 `code/public/frameworks` |

验证命令：

```text
cd code
npm.cmd test
npm.cmd run lint
```

结果：63 项测试通过，ESLint 通过。
