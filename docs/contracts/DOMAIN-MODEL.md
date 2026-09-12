# IOT-DOMAIN-001：领域模型

| 状态 | 待 REVIEW-003 审核 |
| --- | --- |
| 范围 | 仅浏览器内的确定性 Mock 领域模型；不连接真实 IoT 服务。 |

## 聚合与归属

```text
Tenant
├─ User / Role / Quota
├─ Product
│  ├─ ThingModel
│  │  └─ DpRule
│  ├─ Firmware
│  └─ Device
│     ├─ TelemetryPoint / DeviceMessage / Alarm
│     ├─ DeviceCommand
│     └─ OtaExecution
├─ EdgeNode
└─ RuleFlow / RuleExecution

OtaTask → Firmware + Device[] + OtaExecution[]
```

## 实体职责

| 实体 | 关键职责 | 不变量 |
| --- | --- | --- |
| Tenant | 资源隔离、套餐和配额所有者 | 所有业务资源只属于一个租户。 |
| User / Role | Mock 身份和权限判断 | 用户在每个租户至少具备一个角色。 |
| Quota | 设备、产品、消息、存储、OTA 并发限制 | `used <= limit` 时正常；到预警阈值提示；超过硬限制拒绝写入。 |
| EdgeNode | 国家/地域的接入节点 | 节点归属一个租户和一个国家；设备可选关联一个节点。 |
| Product | 设备产品定义和接入配置 | 同一租户内 `productKey` 唯一。 |
| ThingModel | 属性、事件、服务的声明 | 标识在产品内唯一；每项有明确数据类型和访问权限。 |
| DpRule | 原始 DP 到物模型值的转换 | 必须绑定一个 ThingModel 项；转换结果满足类型/范围。 |
| Device | 可观测和可控制的设备实例 | 归属一个产品、租户；状态不能跨租户读取。 |
| TelemetryPoint | 设备的历史时序点 | 以 UTC 递增存储；缺口是显式缺失，不填造数据。 |
| Alarm | 告警生命周期 | 级别、状态、来源设备和产生时间不可为空。 |
| RuleFlow / RuleExecution | 规则定义和一次执行 | 流程必须有一个触发器和至少一个动作，不允许环。 |
| Firmware | 固件元数据和兼容性 | 同产品内版本唯一；未校验或未发布不可用于 OTA。 |
| OtaTask / OtaExecution | 灰度升级任务和单设备尝试 | 回滚创建新尝试，不覆盖原执行历史。 |

## 枚举

- `DeviceStatus`: `inactive | online | offline | fault | maintenance`
- `AccessMode`: `read | write | readWrite`
- `AlarmSeverity`: `info | warning | critical`
- `AlarmStatus`: `active | acknowledged | resolved`
- `FirmwareStatus`: `draft | verified | released | archived`
- `OtaTaskStatus`: `draft | queued | downloading | verifying | installing | rebooting | paused | succeeded | failed | cancelled | rollingBack | rolledBack`
- `RoleCode`: `platformAdmin | tenantAdmin | operator | viewer`

## 状态机约束

- 设备由最后活动时间和 Mock 场景推导在线/离线；`fault` 和 `maintenance` 只能经显式命令进入。
- OTA 只能从 `draft` 进入 `queued`；失败可 `retry` 或 `rollingBack`；成功、取消、回滚为终态。
- 固件 `verified → released → archived` 单向流转；不能发布未经校验固件。

## 审核决策

技术负责人需确认：租户隔离边界、Device 与 EdgeNode 的归属、OTA 状态机、ThingModel/DP 转换的强校验策略，以及是否接受上述枚举命名。
