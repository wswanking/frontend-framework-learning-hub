# IOT-DOMAIN-001：核心数据字典

## 通用字段

所有实体使用 `id`、`tenantId`（平台级 Tenant 自身除外）、`createdAt`、`updatedAt`。ID 格式为 `{实体缩写}_{区域或日期}_{序号}`；时间为 ISO 8601 UTC 字符串。

| 实体 | 必填字段 | 说明 |
| --- | --- | --- |
| Tenant | `id,name,status,plan,quota` | 租户状态为 active / suspended。 |
| Product | `id,tenantId,name,productKey,category,protocol,status` | `productKey` 为 3–64 位小写字母、数字、`-`。 |
| ThingModelItem | `id,productId,kind,identifier,name,dataType,accessMode` | kind 为 property/event/service。数值类必须定义 unit 与范围。 |
| DpRule | `id,productId,thingModelItemId,rawType,transform` | transform 含 scale、offset、precision、enumMap、threshold。 |
| Device | `id,tenantId,productId,name,status,lastActiveAt,location` | location 可为空；为空时进入未定位列表。 |
| EdgeNode | `id,tenantId,name,continent,countryCode,coordinates` | 坐标为演示级城市精度。 |
| TelemetryPoint | `deviceId,metric,timestamp,value,unit,quality` | quality 为 good / stale / invalid / missing。 |
| Alarm | `id,deviceId,severity,status,source,message,occurredAt` | resolved 后保留 `resolvedAt` 与处理人。 |
| Firmware | `id,productId,version,fileName,sizeBytes,checksum,status` | checksum 使用 Mock SHA-256 文本。 |
| OtaTask | `id,tenantId,firmwareId,targetSelector,batches,failureThreshold,status` | batches 总和必须为 100。 |
| OtaExecution | `id,otaTaskId,deviceId,status,attempt,startedAt` | `attempt` 从 1 起递增。 |

## 查询对象

| 查询 | 必填参数 | 可选参数 | 默认排序 |
| --- | --- | --- | --- |
| DashboardQuery | `tenantId,from,to,seed` | region、productId | 事件按 `occurredAt desc` |
| DeviceListQuery | `tenantId,seed` | productId、status、region、keyword、page、pageSize | `lastActiveAt desc` |
| TelemetryQuery | `deviceId,from,to,metrics,seed` | granularity | `timestamp asc` |
| GeoQuery | `tenantId,from,to,seed` | level、parentId、status | 设备量 `desc` |
| OtaListQuery | `tenantId,seed` | firmwareId、status、page | `updatedAt desc` |

## 校验规则

- `page` 从 1 开始，`pageSize` 限制为 1–100。
- `from < to`，时间跨度超出场景允许范围返回 `VALIDATION_ERROR`。
- 枚举映射键不可重复；`precision` 为 0–6 整数；`scale` 不可为 0。
- 设备控制参数必须通过 ThingModelItem 的数据类型、范围与访问权限校验。
