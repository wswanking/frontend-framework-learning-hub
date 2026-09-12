# 跨框架契约

本目录描述将来由[领域包](../../code/packages/domain/)与[Mock API 包](../../code/packages/mock-api/)实现的稳定契约。契约先于 UI：先确定实体、查询、命令、错误与事件，再分别实现 React、Vue、Angular 的页面。

| 审核材料 | 内容 |
| --- | --- |
| [领域模型](DOMAIN-MODEL.md) | 聚合、实体职责、不变量、枚举和状态机。 |
| [数据字典](DATA-DICTIONARY.md) | 实体字段、查询对象与校验。 |
| [权限矩阵](PERMISSIONS.md) | 角色能力和跨租户拒绝规则。 |
| [Mock API](MOCK-API.md) | Service 面、输入/输出、错误和事件。 |
| [契约测试计划](CONTRACT-TEST-PLAN.md) | 确定性、权限、领域规则和事件测试。 |

以上五份文档是 REVIEW-003 的审核包。通过前，不创建三框架工程或业务 Mock 代码。
