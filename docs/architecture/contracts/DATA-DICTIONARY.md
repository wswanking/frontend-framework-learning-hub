# IOT-DOMAIN-001：核心数据字典

## 通用字段

所有实体使用 `id`、`tenantId`（平台级 Tenant 自身除外）、`createdAt`、`updatedAt`。ID 格式为 `{实体缩写}_{区域或日期}_{序号}`；时间为 ISO 8601 UTC 字符串。

| 实体 | 必填字段 | 说明 |
| --- | --- | --- |
| Tenant | `id,name,key,status,plan,contact,email,quota,revision` | 状态为 active / suspended；quota 含 devices、products、messages、storageMb、otaConcurrent 的 limit 和 warningAt。 |
| Member | `id,tenantId,name,email,role,status,invitedAt,revision` | role 为 tenantAdmin / operator / viewer；最后一位有效 tenantAdmin 不可移除。 |
| Product | `id,tenantId,name,productKey,category,protocol,status,version,accessConfig,deviceCount` | `productKey` 为 3–64 位小写字母、数字、`-`；编辑使用版本冲突校验。`accessConfig` 为本端 Mock 的上下行路径、JSON/Binary 报文格式和 10–3600 秒心跳间隔，不含接入凭据。`deviceCount` 从当前本端设备库存重算。 |
| ThingModelItem | `id,productId,kind,identifier,name,dataType,accessMode` | kind 为 property/event/service。数值类必须定义 unit 与范围。 |
| DpRule | `id,productId,thingModelItemId,rawType,transform` | transform 含 scale、offset、precision、enumMap、threshold。 |
| Device | `id,tenantId,productId,name,status,lastActiveAt,location,version` | status 为 unactivated / online / offline / fault / maintenance；location 可为空，进入未定位列表；元数据编辑按 version 校验。 |
| DeviceShadow | `deviceId,lastActiveAt,entries[]` | 每项含 identifier、reported、desired、desiredCommandId；reported 取设备当前属性，实时有效遥测点或成功命令可更新；desired 仅取该属性最新待执行命令，命令成功后清空。缺失和旧遥测点不覆盖现值。当前为浏览器 Mock 影子，不代表真实设备确认。 |
| EdgeNode | `id,tenantId,name,continent,countryCode,coordinates` | 坐标为演示级城市精度。 |
| TelemetryPoint | `deviceId,metric,timestamp,value,unit,quality` | quality 为 good / stale / invalid / missing。 |
| RuleFlow | `id,tenantId,productId,name,enabled,version,versionNote,createdAt,updatedAt,nodes,edges` | 节点含 kind、坐标和配置；连线含 from/to，图需无环并可从唯一触发器到达所有节点。 |
| RuleExecution | `id,ruleId,tenantId,deviceId,occurredAt,mode,status,traces` | mode 为 event/applied；轨迹含逐节点输入、输出、耗时、匹配结果和失败原因。 |
| DeviceMessage | `id,tenantId,deviceId,productId,occurredAt,kind,payload` | kind 当前为 property；有效实时上报与初始演示消息按发生时间显示。 |
| DeviceAlarm | `id,tenantId,deviceId,occurredAt,severity,source,description,status` | status 为 open / acknowledged；确认后保留 `acknowledgedAt` 与 `acknowledgedBy`。source 为 device / rule / ota；OTA 超阈值告警另含 taskId，同任务失败设备分别可见，聚合时每任务计一次。独立的 resolved 状态尚未实现。 |
| Firmware | `id,tenantId,productId,compatibleProductIds,name,version,fileName,sizeBytes,checksum,checksumValid,status,revision,history` | checksum 为浏览器 SHA-256 文本；仅保存元数据，不保存文件字节。 |
| OtaTask | `id,tenantId,firmwareId,productId,targetSelector,batches,failureThreshold,status,kind,revision,currentBatch,executions,events` | batches 总和必须为 100；rollback 用 sourceTaskId 指向原任务。 |
| OtaExecution | `id,otaTaskId,deviceId,batch,attempt,status,fromVersion,toVersion,startedAt,events` | `attempt` 从 1 起递增；重试追加记录。 |

## 查询对象

| 查询 | 必填参数 | 可选参数 | 默认排序 |
| --- | --- | --- | --- |
| DashboardQuery | `tenantId,from,to,seed` | region、productId | 事件按 `occurredAt desc` |
| ProductListQuery | `tenantId,page,pageSize,seed` | keyword、category、status | `updatedAt desc`，同时间按 ID 升序 |
| DeviceListQuery | `tenantId,seed` | productId、status、region、keyword、page、pageSize | `lastActiveAt desc` |
| TelemetryQuery | `deviceId,from,to,metrics,seed` | granularity | `timestamp asc` |
| GeoQuery | `tenantId,from,to,seed` | productId、status、continent、countryCode、nodeId、level、parentId | 设备量 `desc`，同数按 ID 升序 |
| RuleListQuery | `tenantId,page,pageSize,seed` | keyword、productId、enabled | ID 升序 |
| RuleLogQuery | `tenantId,page,pageSize,seed` | ruleId、deviceId、from、to、status | `occurredAt desc`，同时间按 ID 降序 |
| FirmwareQuery | `tenantId,page,pageSize,seed` | productId、status、keyword | `updatedAt desc`，同时间按 ID 升序 |
| OtaListQuery | `tenantId,seed` | firmwareId、status、page | `updatedAt desc` |
| TenantQuery | `tenantId,seed,page,pageSize` | keyword、status、plan、health | ID 升序 |

## 校验规则

- `page` 从 1 开始，`pageSize` 限制为 1–100。
- `from < to`，时间跨度超出场景允许范围返回 `VALIDATION_ERROR`。
- 枚举映射键不可重复；`precision` 为 0–6 整数；`scale` 不可为 0。
- 设备控制参数必须通过 ThingModelItem 的数据类型、范围与访问权限校验。
- 设备时序点的 `value` 在 `quality=missing` 时为 `null`；设备创建前和最后活跃后的缺点不得插值为连续值。
- 规则图必须有一个触发器和至少一个动作，禁止不兼容连线、孤立节点及环；条件组仅支持 AND/OR，转换表达式使用白名单。
- 固件文件只接受 `.bin/.hex/.ota`，大小为 1 B–64 MiB；同产品版本唯一。只有校验成功、已发布且适配目标产品的固件可用于 OTA；任务引用期间不可归档或删除。
- OTA 批次为 1–10 个正整数百分比且总和为 100；失败阈值为 0–1。失败率超过阈值时后续批次不启动，任务暂停并追加模拟告警；重试和回滚不覆盖原尝试。
- 设备、产品创建和 OTA 从草稿进入运行态前检查租户硬上限；已用量达到上限返回含 `已用/上限` 的 `CONFLICT`。预警阈值达到后仍可在上限内创建。
