# IOT-DOMAIN-001：Mock API 与事件契约

## 调用约定

所有 API 以 TypeScript service 函数暴露，不绑定 HTTP；输入第一层包含 `context`：`actorId`、`role`、`tenantId`、`seed`、`scenario`。`scenario` 为 `normal | slow | partialFailure | forbidden | offline`。

成功返回 `{ data, meta: { requestId, seed, generatedAt } }`；失败返回 `{ error: { code, message, fieldErrors?, retryable? } }`。

## 服务面

| 服务 | 操作 | 输出 |
| --- | --- | --- |
| dashboard | `getSummary(query)` | 指标、地域、趋势、事件摘要 |
| geography | `getTopology(query)` | 洲/国家/节点/设备聚合与未定位列表 |
| products | `list/get/create/update` | Product 与分页元数据 |
| thingModels | `list/save/testDpRule` | 模型项、校验错误、转换步骤 |
| devices | `list/get/update/executeCommand` | Device、命令回执 |
| telemetry | `query/subscribe` | 时序点、事件订阅器 |
| rules | `list/save/testRun/toggle` | RuleFlow、逐节点执行结果 |
| firmware | `list/create/verify/archive` | Firmware 与校验结果 |
| ota | `list/create/pause/retry/rollback/subscribe` | OtaTask、OtaExecution、进度事件 |
| tenants | `list/get/updateQuota/manageMember` | Tenant、Quota、Member |

## 错误码

`VALIDATION_ERROR`、`FORBIDDEN`、`NOT_FOUND`、`CONFLICT`、`QUOTA_EXCEEDED`、`DEVICE_OFFLINE`、`SCENARIO_TIMEOUT`、`PARTIAL_FAILURE`、`UNSUPPORTED_OPERATION`。

## 事件契约

事件统一为 `{ id,type,occurredAt,tenantId,resourceId,payload,seed }`。

- `telemetry.appended`
- `device.statusChanged`
- `alarm.created | alarm.updated`
- `rule.executed`
- `ota.executionUpdated | ota.taskUpdated`

同一 seed 下事件顺序确定；订阅取消后不得再推送；`partialFailure` 仅中断指定分区，保留其他可用数据。
