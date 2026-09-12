# CHG-2026-09-12-001：PRD 全量完成与三框架统一入口

- 关联需求：IOT-PLATFORM-001、IOT-PLATFORM-002、IOT-PLATFORM-003、IOT-DASH-001、IOT-DOMAIN-001、IOT-GEO-001、IOT-PRODUCT-001、IOT-DEVICE-001、IOT-RULE-001、IOT-FIRMWARE-001、IOT-OTA-001、IOT-TENANT-001、IOT-LEARNING-001、IOT-RELEASE-001
- 关联任务：TASK-022
- 日期：2026-09-12
- 执行者：AI（用户明确授权自动化验收与私有发布）

## 变更

- 将 React、Vue、Angular 三个独立生产构建自动挂载到学习门户，支持从统一入口直接访问全部业务模块。
- 三端 Vite 产物改用相对资源路径；React 使用 Hash Router，保证嵌套静态部署的刷新与导航稳定。
- 根门户首屏改为真实三框架学习入口，展示共享固定 seed 指标、业务范围和框架技术栈。
- 新增专属 Open Graph / X 社交预览图与随请求主机生成的绝对元数据 URL。
- 正式发布门禁支持用户明确授权的自动化验收，同时保留缺授权或缺回滚基线时的拒绝测试。
- PRD、需求/任务/Issue/审核看板、环境矩阵与验收状态同步到本轮完成口径。

## 验证

- `npm test`：类型检查、根门户与三端生产构建、60 项自动化测试全部通过。
- `npm run lint`：零错误、零警告。
- `npm run release:check:preview`：通过。
- `npm run release:check:production`：通过。
- `code/dist/client/frameworks/{react,vue,angular}/index.html` 与 `code/dist/client/og.png` 均存在。

## 已知限制

- 组件/图表实验室刻意同时包含多套大型依赖，Vite 仍报告大 chunk 建议；实验室与主业务路由隔离，不影响验收。
- 所有设备、固件、OTA、身份和权限均为固定 seed 浏览器 Mock，不连接真实外部系统。
