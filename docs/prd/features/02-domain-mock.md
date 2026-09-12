# PRD：共享领域与 Mock 平台

| 项目 | 内容 |
| --- | --- |
| 需求编号 | IOT-DOMAIN-001 |
| 优先级 | P0 |
| 状态 | 已完成（2026-09-12 自动化验收通过） |
| 审核门禁 | REVIEW-003 |

## 目标与边界

定义所有框架共用的 IoT 业务契约和确定性 Mock 数据。只提供浏览器内的查询、命令和事件模拟；不实现真实 API、消息 Broker 或持久化服务。

## 实体与契约

Tenant、User、Role、Quota、EdgeNode、Product、ThingModel、DpRule、Device、TelemetryPoint、Alarm、RuleFlow、RuleExecution、Firmware、OtaTask。

每项契约必须定义字段类型、枚举、默认值、校验、权限、分页、排序、过滤、错误和实时事件。实体 ID 格式为 `{实体缩写}_{地区或日期}_{序号}`，时间以 ISO 8601 UTC 存储。

## 交互与规则

- 所有查询都接收显式 `seed`、租户上下文和时间范围。
- 同一 seed、查询参数和时区必须产生相同 DTO；页面不可直接调用 `Math.random()`。
- Mock API 可切换正常、慢速、局部失败、无权限和离线情景。
- 命令返回可追踪操作 ID；时序、告警、规则和 OTA 以事件流追加。

## 异常状态

无权限返回可解释的权限码；校验失败标记具体字段；离线、超时、冲突和部分失败均可被前端稳定显示。

## 验收条件

- Given 相同 seed 和 DashboardQuery，When 三端请求数据，Then 返回完全一致的业务值与排序。
- Given 请求无权限资源，When 查询，Then 返回统一错误语义且不泄露数据。
- Given 切换“局部失败”，When 查询列表，Then 页面仍展示成功分区并报告失败分区。

## 依赖与风险

领域模型决定后才能初始化三端业务应用。实体命名、数据保留和权限语义均必须由技术负责人审核。
