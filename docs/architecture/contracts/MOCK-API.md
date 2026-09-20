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
| devices | `list/get/create/update/executeCommand` | Device、命令回执 |
| telemetry | `query/subscribe` | 时序点、事件订阅器 |
| rules | `list/save/testRun/toggle` | RuleFlow、逐节点执行结果 |
| firmware | `list/create/verify/archive` | Firmware 与校验结果 |
| ota | `list/create/pause/retry/rollback/subscribe` | OtaTask、OtaExecution、进度事件 |
| tenants | `list/get/save/inviteMember/updateMember/removeMember/previewQuota/updateQuota/checkCapacity` | Tenant、Quota、Member |

## 错误码

`VALIDATION_ERROR`、`FORBIDDEN`、`NOT_FOUND`、`CONFLICT`、`QUOTA_EXCEEDED`、`DEVICE_OFFLINE`、`SCENARIO_TIMEOUT`、`PARTIAL_FAILURE`、`UNSUPPORTED_OPERATION`。

当前产品 Mock 将创建和更新合并为 `save`，独立的接入配置由 `saveAccessConfig` 保存，物模型与 DP 分别使用 `saveModel`、`saveDpRule`；`testDpRule` 返回逐步转换结果。接入配置只记录协议对应的上下行路径、JSON/Binary 报文格式和 10–3600 秒心跳间隔，不连接真实 Broker、HTTP/CoAP 服务或身份系统；旧浏览器存储缺少该字段时读取协议默认值。产品、接入配置、模型与 DP 写入先检查角色和租户，再检查字段与版本。新建产品接受本端已创建租户并检查产品数硬配额。修改接入协议先返回影响确认，显式确认后重置为新协议默认路径；有关联设备的 Product Key 修改也先要求确认。关联设备的模型类型修改或删除先返回影响确认冲突，显式确认后才执行。

DP 试运行先验证原始值类型。配置映射时，未命中的原始值返回错误；枚举目标校验映射值属于目标枚举，字符串目标返回映射文本，数值和布尔目标继续执行倍率、偏移、表达式、精度及目标阈值、范围、类型校验。映射不能绕过目标约束。

新增物模型项向 `saveModel` 提交空 ID，服务先校验同产品标识唯一，再分配不与现有项冲突的 ID；已有项提交其原 ID 表示修改。页面编辑标识时使用同一字符、长度与唯一性规则即时提示，服务保存时仍重检并保留版本冲突保护。

产品列表、详情与影响提示中的设备数优先从本端设备服务提交的完整库存快照按租户和产品重算；尚无设备库存快照时使用产品已有计数。设备创建、CSV 导入或批量删除后再次查询会反映最新计数，损坏的库存快照不会覆盖产品已有计数。

当前设备 Mock 提供 `list/get/create/previewImport/importBatch/deleteBatch/updateMetadata/queryTelemetry/writableItems/executeCommand/commandHistory/getShadow/applyTelemetry/subscribeTelemetry`。`create` 要求已发布且同租户的产品，并检查设备数硬配额，成功后创建未激活设备。设备控制从本端产品模型读取可写属性或服务并校验类型与范围；离线设备提交返回带原因的失败命令，页面在离线及无权限状态禁用控制。设备元数据和命令记录各自保存于应用本地浏览器存储，元数据编辑检查版本。 CSV 导入先预览、逐行校验并检查整个批次配额，确认后整批写入；删除要求显式确认且先检查全部目标权限，历史规则及 OTA 记录保留。时序点在设备创建前、最后活跃后及演示缺口处标记 `missing`，空值不插值；订阅每次提供确定性的模拟点，取消后停止推送。当前页面订阅回调将有效点交给 `applyTelemetry` 更新本端设备属性和影子；缺失、无效及乱序点不覆盖。

设备列表的标签筛选按完整标签精确匹配，接受登记、导入或元数据编辑产生的任意标签。页面“最后活跃（UTC）”输入按所写 UTC 分钟组成时间戳，例如 `2026-09-16T11:57` 对应 `2026-09-16T11:57:00.000Z`，不随浏览器时区换算；服务仅返回最后活跃时间不早于该时刻的设备。两项筛选与其他条件共同作用，清除单个筛选标签后回到第一页。

当前设备事件 Mock 提供 `listMessages/recordTelemetry/listAlarms/acknowledge`：消息包含设备、产品、租户、发生时间及属性报文；有效实时遥测按设备和时间去重后保存在本端浏览器。告警由故障设备、规则执行和 OTA 灰度失败超阈值生成；后者在失败设备的告警页按任务和设备呈现，发生时间取 OTA 超阈值事件，确认动作逐设备记录操作人和时间。观察员与跨租户请求在服务层拒绝。当前没有真实设备消息、后台流或跨端同步。

当前规则 Mock 提供 `list/get/save/toggle/testRun/applySimulation/consumeEvent/logsFor/samples/sampleCases/saveSampleCase/versionHistory/compareVersions`。规则图节点为 trigger、condition、transform、delay、alarm、storage、notification；保存前校验唯一触发器、至少一个动作、字段和端口、孤立节点、重复连线及循环依赖。表达式仅由受限解析器计算，模拟超时和动作失败返回对应节点原因。试运行返回各节点输入、输出、状态、耗时及匹配结果，不写日志或设备属性；`applySimulation` 需显式确认才写演示日志。命名样例保存复用试运行验证，可试运行角色可保存，每规则最多 20 个、名称不可重复；保存样例不写执行日志。规则保存或启停时追加版本快照，比较字段、节点和连线变化，旧版不可覆盖。禁用规则的 `consumeEvent` 返回空结果且不创建日志或模拟告警。规则、演示日志、样例与快照各自保存在应用本地浏览器存储，保存和启停检查版本；日志支持规则、设备、时间、状态筛选。旧浏览器存储在本次增量前没有的历史快照无法追溯。设备页开启“实时追加”时，本端订阅回调将有效遥测点按设备租户及产品筛选启用规则，调用 `consumeEvent` 生成执行记录。全缺失采样不消费；观察员不触发规则执行；规则服务再次检查权限与启用状态。同一规则、设备、发生时间的事件仅写入一次。此 Mock 桥接依赖设备页订阅生命周期，尚无独立于页面的后台事件流。

当前固件 Mock 提供 `inspectFirmwareFile/list/get/create/transition/remove/eligible`。浏览器读取本地文件计算 SHA-256，只保存文件名、大小、校验值、适配产品和操作历史；不保存二进制。只接受 `.bin/.hex/.ota` 与 64 MiB 内文件；同产品版本唯一。草稿仅在校验有效时进入已校验，再发布供 OTA 使用；被任务引用的固件不可归档或删除，已发布固件不能直接删除。读取、创建、状态变更和删除均按租户和角色检查。

当前 OTA Mock 提供 `preview/create/list/get/start/advance/pause/resume/cancel/retry/rollback/historyForDevice/subscribe`。草稿开始、已暂停任务恢复或重试重新进入运行态时检查 OTA 并发硬配额。预览在服务层验证已校验发布的兼容固件、目标设备租户/产品、灰度批次总和 100% 与失败阈值。`advance` 每次推进一个模拟阶段，页面本地定时推进并刷新当前记录；断开时标记可能过期。灰度按目标 ID 顺序逐批执行，失败率严格超过阈值自动暂停并追加模拟告警事件。重试添加 attempt+1，保留旧执行记录；回滚创建新反向任务，原任务不变。任务与设备尝试保存在本端浏览器存储；`subscribe` 可订阅本实例事件，取消订阅后不再推送。Mock 不连接真实设备或固件分发服务。

当前租户 Mock 使用本端浏览器存储，提供分页筛选、成员管理、权限预览、配额影响预览和硬上限检查。租户、成员及配额写入仅允许平台管理员；租户管理员可读本租户。消息量以租户确定性 seed 使用量加本端已保存的非 `msg_seed_*` 原始遥测报文数计算；`recordTelemetry` 在新增报文前检查消息硬上限，已存在的同设备同时间报文直接返回原记录且不重复计费。存储量仍仅有确定性使用量，没有对应创建操作。

## 事件契约

事件统一为 `{ id,type,occurredAt,tenantId,resourceId,payload,seed }`。

- `telemetry.appended`
- `device.statusChanged`
- `alarm.created | alarm.updated`
- `rule.executed`
- `ota.executionUpdated | ota.taskUpdated`

同一 seed 下事件顺序确定；订阅取消后不得再推送；`partialFailure` 仅中断指定分区，保留其他可用数据。

Dashboard 与地理 Mock 每次查询均从本端设备服务分页读取当前库存，设备导入/删除后刷新查询会更新设备数和地域聚合；未定位设备留在列表，不绘制伪设备点。

Dashboard 与地理 Mock 的消息量采用相同的 seed 演示基线，再加上本端设备消息服务中 `recordTelemetry` 持久化的原始报文数。新增报文按设备租户/产品/地域与 UTC `[from, to)` 过滤，每个去重后的报文计 1 条；`msg_seed_*` 初始演示快照不再叠加，以免与基线重复。大盘消息卡、趋势、洲/国家/节点排行与事件流，以及地理各层和详情消息量使用同一批新增报文。当前基线仍是演示生成量，不等于真实平台消息存储。 大盘页面监听本端 `iot-atlas-mock-changed` 写入通知和同源标签页的 `storage` 变化，沿用已应用的 DashboardQuery 重新查询；暂停仅延迟事件列表，其他指标仍更新。

Dashboard 的告警分布与活跃告警从当前筛选设备的设备告警服务读取，计入 `[from, to)` 内未确认的设备故障和规则模拟告警；已确认告警不计入活跃数，但创建事件仍保留。 大盘事件随同返回 `severity`：故障为 `critical`、规则预警为 `minor`、OTA 阈值告警为 `major`、遥测为 `info`；告警确认不改写历史创建事件等级。OTA 超阈值告警按任务去重计入“重要”级别；当前筛选设备中只要有该任务的未确认告警，就计 1 个活跃告警，逐设备确认后可归零。OTA 成功率从本端 OTA 任务在 `[from, to)` 内结束的设备执行计算；同一任务/设备在该范围只取最新尝试，仅成功与失败进入分母；没有完成执行时返回 `null`。大盘前期对比使用紧邻的等长时间段。 大盘洲入口把当前 DashboardQuery 的 `region` 改为洲 ID；国家与节点详情只读取同一查询返回的 `countries`、`nodes`，节点 URL 参数不改变指标聚合。上述汇总均先按当前租户、地域和产品筛出设备，再按设备 ID 关联事件与 OTA 记录；本端刷新页面重新读取浏览器持久化 Mock。

当前地理 Mock 的 `partialFailure` 令 `mapAvailable=false`，仍返回同查询的列表、统计与未定位设备；地图端自动展示列表。未定位设备不生成伪坐标。地理层级依次为 `global`、`continent`、`country`、`node`，各层返回下一层对象，设备数降序后按 ID 升序。

地图设备层的显示点按经纬度网格聚合：缩放倍数 `z` 限于 1–8，网格边长为 `16 / z` 度，网格索引用 `floor((经度 + 180) / 边长)` 与 `floor((纬度 + 90) / 边长)` 计算。仅有坐标的设备参与聚合；洲、国家、节点不重复聚合。聚合点坐标取成员坐标均值，设备数取成员之和，成员按 ID 升序，显示点按设备数降序再按 ID 升序。点击聚合点以其中心放大 1.5 倍，最多 8 倍；同坐标设备在最大倍数下仍可通过完整列表逐项访问。聚合只影响地图展示，不改变筛选、统计、列表或领域查询结果。
