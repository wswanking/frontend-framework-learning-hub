import {
  type ApiFailure,
  type ApiMeta,
  type ApiResult,
  type DashboardQuery,
  type Device,
  type DeviceCommandResult,
  type DeviceListQuery,
  type EdgeNode,
  type Alarm,
  type Product,
  type ProductListQuery,
  type RequestContext,
  type RawDeviceMessage,
  type TelemetryPoint,
  type TelemetryQuery,
  type Tenant,
  type TenantDetail,
  type TenantQuotaItem,
  type TenantSummary,
  type User,
  type RoleCode,
  type PermissionPreview,
  type RuleExecutionLog,
  type RuleFlow,
  type RuleLogQuery,
  type RuleTestResult,
  type Firmware,
  type RegisterFirmwareInput,
  type CreateOtaInput,
  type OtaTask,
  type ThingModel,
  type SaveThingModelPropertyInput,
  type DpRule,
  type DpTestStep,
  type TopologyQuery,
  type TopologyResult,
  canControlDevice,
  canManageProducts,
  validatePage,
  validateTimeRange,
} from "../domain/index.ts";

type Dataset = { tenants: Tenant[]; users: User[]; nodes: EdgeNode[]; products: Product[]; devices: Device[] };

const generatedAt = "2026-08-29T00:00:00.000Z";
const continents = [
  ["亚洲", "CN", "上海", 31.2304, 121.4737],
  ["欧洲", "DE", "法兰克福", 50.1109, 8.6821],
  ["北美洲", "US", "弗吉尼亚", 37.4316, -78.6569],
  ["南美洲", "BR", "圣保罗", -23.5505, -46.6333],
  ["非洲", "ZA", "开普敦", -33.9249, 18.4241],
  ["大洋洲", "AU", "悉尼", -33.8688, 151.2093],
] as const;

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function dataset(seed: number): Dataset {
  const next = random(seed);
  const tenants: Tenant[] = [
    { id: "ten_cn_001", name: "星图制造", plan: "enterprise", status: "active" },
    { id: "ten_de_002", name: "NordWerk", plan: "growth", status: "active" },
  ];
  const users: User[] = [
    { id: "usr_001", tenantId: "ten_cn_001", name: "林管理员", role: "tenantAdmin", status: "active" },
    { id: "usr_002", tenantId: "ten_cn_001", name: "周运维", role: "operator", status: "active" },
    { id: "usr_003", tenantId: "ten_cn_001", name: "陈观察员", role: "viewer", status: "active" },
    { id: "usr_004", tenantId: "ten_de_002", name: "Mia Keller", role: "tenantAdmin", status: "active" },
  ];
  const nodes = continents.map(([continent, countryCode, city, latitude, longitude], index) => ({
    id: `node_${countryCode.toLowerCase()}_00${index + 1}`,
    tenantId: index % 2 ? "ten_de_002" : "ten_cn_001",
    continent,
    countryCode,
    name: `${city} 接入节点`,
    location: { latitude, longitude },
  }));
  const products = tenants.flatMap((tenant, tenantIndex) => [
    { id: `prd_${tenantIndex + 1}_001`, tenantId: tenant.id, name: "环境传感器", productKey: `env-sensor-${tenantIndex + 1}`, category: "传感器", protocol: "MQTT" as const, status: "active" as const, updatedAt: generatedAt, deviceCount: 0 },
    { id: `prd_${tenantIndex + 1}_002`, tenantId: tenant.id, name: "工业网关", productKey: `edge-gateway-${tenantIndex + 1}`, category: "网关", protocol: "Modbus" as const, status: "active" as const, updatedAt: generatedAt, deviceCount: 0 },
  ]);
  const devices = Array.from({ length: 36 }, (_, index) => {
    const tenantId = index % 3 === 0 ? "ten_de_002" : "ten_cn_001";
    const product = products.find((item) => item.tenantId === tenantId && item.id.endsWith(index % 2 ? "002" : "001"))!;
    const tenantNodes = nodes.filter((item) => item.tenantId === tenantId);
    const node = tenantNodes[Math.floor(next() * tenantNodes.length)];
    const statuses: Device["status"][] = ["online", "online", "online", "offline", "maintenance", "fault"];
    return {
      id: `dev_${tenantId.slice(4, 6)}_${String(index + 1).padStart(3, "0")}`,
      tenantId,
      productId: product.id,
      nodeId: node.id,
      name: `${product.name}-${String(index + 1).padStart(3, "0")}`,
      status: statuses[Math.floor(next() * statuses.length)],
      lastActiveAt: new Date(Date.parse(generatedAt) - Math.floor(next() * 86_400_000)).toISOString(),
      location: index % 7 ? { latitude: Number((next() * 120 - 60).toFixed(3)), longitude: Number((next() * 300 - 150).toFixed(3)) } : undefined,
      tags: [index % 2 ? "production" : "lab", index % 3 ? "temperature" : "gateway"],
      shadow: { temperature: Number((18 + next() * 12).toFixed(1)), enabled: index % 4 !== 0, firmware: `1.${index % 3}.${seed % 10}` },
    };
  });
  for (const product of products) product.deviceCount = devices.filter((device) => device.productId === product.id).length;
  return { tenants, users, nodes, products, devices };
}

function meta(seed: number, operation: string): ApiMeta {
  return { requestId: `mock_${operation}_${seed}`, seed, generatedAt };
}

function failure(context: RequestContext): ApiFailure | undefined {
  if (context.scenario === "forbidden") return { code: "FORBIDDEN", message: "当前场景拒绝访问。" };
  if (context.scenario === "slow") return { code: "SCENARIO_TIMEOUT", message: "模拟请求超时。", retryable: true };
  if (context.scenario === "partialFailure") return { code: "PARTIAL_FAILURE", message: "Mock partial failure", retryable: true };
  return undefined;
}

export function createMockApi(context: RequestContext) {
  const data = dataset(context.seed);
  const models = new Map<string, ThingModel>(data.products.map((product) => [product.id, {
    id: `tm_${product.id}_001`, productId: product.id, version: 1,
    properties: [{ identifier: "temperature", name: "温度", dataType: "number", unit: "°C", access: "read", min: -40, max: 125 }],
    events: [{ identifier: "overheat", name: "过热", severity: "warning" }],
    services: [],
  }]));
  const rules = new Map<string, RuleFlow>(data.tenants.map((tenant, index) => {
    const product = data.products.find((item) => item.tenantId === tenant.id)!; const id = `rule_${tenant.id}_001`;
    return [id, { id, tenantId: tenant.id, name: "高温告警与归档", productId: product.id, enabled: index === 0, version: 1, versionNote: "初始规则", updatedAt: generatedAt, lastExecutedAt: generatedAt, successRate: 98.6, nodes: [{ id: "trigger", type: "trigger", name: "遥测触发", config: { metric: "temperature" } }, { id: "condition", type: "condition", name: "高温判断", config: { operator: ">", threshold: 24 } }, { id: "transform", type: "transform", name: "单位转换", config: { scale: 1 } }, { id: "alarm", type: "alarm", name: "创建告警", config: { severity: "warning" } }, { id: "storage", type: "storage", name: "写入存储", config: {} }], edges: [{ id: "edge_1", from: "trigger", to: "condition" }, { id: "edge_2", from: "condition", to: "transform" }, { id: "edge_3", from: "transform", to: "alarm" }, { id: "edge_4", from: "alarm", to: "storage" }] } satisfies RuleFlow];
  }));
  const ruleLogs: RuleExecutionLog[] = [];
  const firmwares = new Map<string, Firmware>(data.products.map((product, index) => {
    const id = `fw_${product.id}_001`; const valid = index % 2 === 0;
    return [id, { id, tenantId: product.tenantId, productId: product.id, version: `1.${index + 1}.${context.seed % 10}`, status: valid ? "released" : "draft", checksum: valid ? "a".repeat(64) : "0".repeat(64), checksumStatus: valid ? "valid" : "invalid", fileName: `${product.productKey}.bin`, fileType: "application/octet-stream", sizeBytes: 1_048_576 + index * 1024, description: `${product.name} 演示固件`, compatibleProductIds: [product.id], createdBy: "usr_001", createdAt: generatedAt, history: [{ action: "registered", actorId: "usr_001", occurredAt: generatedAt }, ...(valid ? [{ action: "verified" as const, actorId: "usr_001", occurredAt: generatedAt }, { action: "released" as const, actorId: "usr_001", occurredAt: generatedAt }] : [])], referencedOtaIds: index === 0 ? ["ota_active_001"] : [] } satisfies Firmware];
  }));
  const otaTasks = new Map<string, OtaTask>();
  const guard = () => failure(context);
  const own = <T extends { tenantId: string }>(resource: T) =>
    context.role === "platformAdmin" || resource.tenantId === context.tenantId;
  const permissionMap: Record<RoleCode, string[]> = {
    platformAdmin: ["tenant.read", "tenant.manage", "member.manage", "quota.manage", "device.create"],
    tenantAdmin: ["tenant.read", "member.manage", "quota.read", "device.create"],
    operator: ["tenant.read", "quota.read", "device.control", "ota.manage"],
    viewer: ["tenant.read", "quota.read", "device.read"],
  };
  const quotasFor = (tenantId: string): TenantQuotaItem[] => {
    const deviceCount = data.devices.filter((item) => item.tenantId === tenantId).length;
    const productCount = data.products.filter((item) => item.tenantId === tenantId).length;
    const limits = tenantId === "ten_cn_001" ? { devices: deviceCount, products: 20 } : { devices: 50, products: 10 };
    const values: Array<[TenantQuotaItem["resource"], number, number, number]> = [
      ["devices", deviceCount, limits.devices, Math.floor(limits.devices * .8)], ["products", productCount, limits.products, Math.floor(limits.products * .8)],
      ["messages", tenantId === "ten_cn_001" ? 820_000 : 310_000, 1_000_000, 800_000], ["storageGb", 68, 100, 80], ["otaConcurrency", 2, 10, 8],
    ];
    return values.map(([resource, used, limit, warningAt]) => ({ resource, used, limit, warningAt, status: used >= limit ? "exceeded" : used >= warningAt ? "warning" : "normal" }));
  };
  const tenantSummary = (tenant: Tenant): TenantSummary => {
    const quotas = quotasFor(tenant.id); const devices = data.devices.filter((item) => item.tenantId === tenant.id);
    return { ...tenant, memberCount: data.users.filter((item) => item.tenantId === tenant.id).length, deviceCount: devices.length, messageCount: devices.length * (800 + (context.seed % 73)), quotaUsagePercent: Math.max(...quotas.map((item) => Math.round(item.used / item.limit * 100))) };
  };
  const validateRule = (flow: RuleFlow): ApiFailure | undefined => {
    const triggers = flow.nodes.filter((node) => node.type === "trigger"); const actions = flow.nodes.filter((node) => ["alarm", "storage", "notification"].includes(node.type));
    if (triggers.length !== 1) return { code: "VALIDATION_ERROR", message: "规则必须且只能包含一个触发器。" };
    if (!actions.length) return { code: "VALIDATION_ERROR", message: "规则至少需要一个动作节点。" };
    const ids = new Set(flow.nodes.map((node) => node.id)); const invalidEdge = flow.edges.find((edge) => !ids.has(edge.from) || !ids.has(edge.to));
    if (invalidEdge) return { code: "VALIDATION_ERROR", message: `连线 ${invalidEdge.id} 引用了不存在的节点。` };
    const adjacency = new Map(flow.nodes.map((node) => [node.id, flow.edges.filter((edge) => edge.from === node.id).map((edge) => edge.to)])); const visiting = new Set<string>(); const visited = new Set<string>();
    const cyclic = (id: string): boolean => { if (visiting.has(id)) return true; if (visited.has(id)) return false; visiting.add(id); if ((adjacency.get(id) ?? []).some(cyclic)) return true; visiting.delete(id); visited.add(id); return false; };
    const cycleNode = flow.nodes.find((node) => cyclic(node.id)); if (cycleNode) return { code: "VALIDATION_ERROR", message: `规则存在环路，涉及节点 ${cycleNode.id}。` };
    return undefined;
  };

  return {
    getDashboard(query: DashboardQuery): ApiResult<{
      metrics: { connectedDevices: number; onlineDevices: number; onlineRate: number | null; messageCount: number; activeAlarms: number; otaSuccessRate: number | null; comparisons: Record<string, number>; updatedAt: string };
      regions: { continent: string; devices: number; messages: number }[];
      ranking: { countryCode: string; nodeId: string; name: string; devices: number; messages: number }[];
      trend: { timestamp: string; messages: number }[];
      alarmDistribution: { severity: "info" | "warning" | "critical"; count: number }[];
      events: { id: string; type: string; severity: "info" | "warning" | "critical"; occurredAt: string; deviceId: string }[];
    }> {
      const invalid = validateTimeRange(query.from, query.to) || guard();
      if (invalid) return { error: invalid };
      if (context.role !== "platformAdmin" && query.tenantId !== context.tenantId) {
        return { error: { code: "FORBIDDEN", message: "不能读取其他租户的大盘数据。" } };
      }
      const devices = data.devices
        .filter((item) => item.tenantId === query.tenantId)
        .filter((item) => !query.region || data.nodes.find((node) => node.id === item.nodeId)?.continent === query.region);
      const activated = devices.filter((item) => item.status !== "inactive");
      const rangeHours = Math.max(1, Math.round((Date.parse(query.to) - Date.parse(query.from)) / 3_600_000));
      const messageUnit = Math.max(1, Math.round((800 + (query.seed % 73)) * rangeHours / 24));
      const regions = continents.map(([continent]) => {
        const count = devices.filter((device) => data.nodes.find((node) => node.id === device.nodeId)?.continent === continent).length;
        return { continent, devices: count, messages: count * messageUnit };
      }).filter((item) => item.devices > 0);
      const ranking = data.nodes.map((node) => { const count = devices.filter((device) => device.nodeId === node.id).length; return { countryCode: node.countryCode, nodeId: node.id, name: node.name, devices: count, messages: count * messageUnit }; }).filter((item) => item.devices > 0).sort((a, b) => b.messages - a.messages);
      const messageCount = devices.length * messageUnit;
      return {
        data: {
          metrics: {
            connectedDevices: devices.length,
            onlineDevices: devices.filter((item) => item.status === "online").length,
            onlineRate: activated.length ? Math.round(devices.filter((item) => item.status === "online").length / activated.length * 1000) / 10 : null,
            messageCount,
            activeAlarms: devices.filter((item) => item.status === "fault").length,
            otaSuccessRate: devices.length ? Math.round((92 + query.seed % 7) * 10) / 10 : null,
            comparisons: { connectedDevices: devices.length ? 2.4 : 0, onlineRate: devices.length ? 1.2 : 0, messageCount: devices.length ? 5.8 : 0, activeAlarms: devices.length ? -3.1 : 0, otaSuccessRate: devices.length ? 0.7 : 0 },
            updatedAt: query.to,
          },
          regions,
          ranking,
          trend: Array.from({ length: 8 }, (_, index) => ({ timestamp: new Date(Date.parse(query.from) + (Date.parse(query.to) - Date.parse(query.from)) * index / 8).toISOString(), messages: Math.round(messageCount * (.08 + ((query.seed + index * 7) % 9) / 100)) })),
          alarmDistribution: [{ severity: "info", count: devices.filter((item) => item.status === "maintenance").length }, { severity: "warning", count: devices.filter((item) => item.status === "offline").length }, { severity: "critical", count: devices.filter((item) => item.status === "fault").length }],
          events: devices.slice(0, 8).map((device, index) => ({
            id: `evt_${query.seed}_${index}`,
            type: device.status === "fault" ? "alarm.created" : "telemetry.appended",
            severity: device.status === "fault" ? "critical" : device.status === "offline" ? "warning" : "info",
            occurredAt: new Date(Date.parse(generatedAt) - index * 60_000).toISOString(),
            deviceId: device.id,
          })),
        },
        meta: meta(query.seed, "dashboard"),
      };
    },

    listDevices(query: DeviceListQuery): ApiResult<{ items: Device[]; total: number; page: number; pageSize: number }> {
      const invalid = validatePage(query.page, query.pageSize) || guard();
      if (invalid) return { error: invalid };
      if (context.role !== "platformAdmin" && query.tenantId !== context.tenantId) {
        return { error: { code: "FORBIDDEN", message: "不能读取其他租户的设备。" } };
      }
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 20;
      const keyword = query.keyword?.trim().toLowerCase();
      const filtered = data.devices
        .filter((device) => device.tenantId === query.tenantId)
        .filter((device) => !query.productId || device.productId === query.productId)
        .filter((device) => !query.status || device.status === query.status)
        .filter((device) => !keyword || device.name.toLowerCase().includes(keyword))
        .filter((device) => !query.region || data.nodes.find((node) => node.id === device.nodeId)?.continent === query.region)
        .filter((device) => !query.tags?.length || query.tags.every((tag) => device.tags.includes(tag)))
        .filter((device) => !query.activeAfter || device.lastActiveAt >= query.activeAfter)
        .filter((device) => !query.activeBefore || device.lastActiveAt <= query.activeBefore)
        .sort((a, b) => {
          const field = query.sortBy ?? "lastActiveAt"; const direction = query.sortOrder === "asc" ? 1 : -1;
          return String(a[field]).localeCompare(String(b[field])) * direction;
        });
      return { data: { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize }, meta: meta(query.seed, "devices") };
    },

    getDevice(deviceId: string): ApiResult<Device> {
      const invalid = guard();
      if (invalid) return { error: invalid };
      const device = data.devices.find((item) => item.id === deviceId);
      if (!device) return { error: { code: "NOT_FOUND", message: "Device not found" } };
      if (!own(device)) return { error: { code: "FORBIDDEN", message: "Device belongs to another tenant" } };
      return { data: device, meta: meta(context.seed, "device") };
    },

    getTopology(query: TopologyQuery | string): ApiResult<TopologyResult> {
      const invalid = guard();
      if (invalid) return { error: invalid };
      const normalized: TopologyQuery = typeof query === "string" ? { tenantId: query, seed: context.seed } : query;
      const tenantId = normalized.tenantId;
      if (context.role !== "platformAdmin" && tenantId !== context.tenantId) {
        return { error: { code: "FORBIDDEN", message: "不能读取其他租户的节点。" } };
      }
      const nodes = data.nodes
        .filter((node) => node.tenantId === tenantId)
        .filter((node) => !normalized.continent || node.continent === normalized.continent)
        .filter((node) => !normalized.countryCode || node.countryCode === normalized.countryCode)
        .filter((node) => !normalized.nodeId || node.id === normalized.nodeId);
      const nodeIds = new Set(nodes.map((node) => node.id));
      const devices = data.devices
        .filter((device) => device.tenantId === tenantId && nodeIds.has(device.nodeId))
        .filter((device) => !normalized.productId || device.productId === normalized.productId)
        .filter((device) => !normalized.status || device.status === normalized.status);
      return {
        data: {
          nodes: nodes.map((node) => {
            const members = devices.filter((device) => device.nodeId === node.id);
            return {
              ...node,
              deviceCount: members.length,
              onlineCount: members.filter((device) => device.status === "online").length,
              messageCount: members.length * (800 + (normalized.seed % 73)),
              alarmCount: members.filter((device) => device.status === "fault").length,
              lastActiveAt: members.map((device) => device.lastActiveAt).sort().at(-1),
            };
          }),
          devices: devices.filter((device) => device.location),
          unlocatedDevices: devices.filter((device) => !device.location),
        },
        meta: meta(normalized.seed, "topology"),
      };
    },

    queryTelemetry(deviceId: string, from: string, to: string): ApiResult<TelemetryPoint[]> {
      const invalid = validateTimeRange(from, to) || guard();
      if (invalid) return { error: invalid };
      const device = data.devices.find((item) => item.id === deviceId);
      if (!device) return { error: { code: "NOT_FOUND", message: "设备不存在。" } };
      if (!own(device)) return { error: { code: "FORBIDDEN", message: "不能读取其他租户的设备。" } };
      const next = random(context.seed + deviceId.length);
      return {
        data: Array.from({ length: 12 }, (_, index) => ({
          deviceId,
          metric: "temperature" as const,
          timestamp: new Date(Date.parse(from) + index * ((Date.parse(to) - Date.parse(from)) / 11)).toISOString(),
          value: Number((18 + next() * 12).toFixed(2)),
          unit: "°C",
          quality: "good" as const,
        })),
        meta: meta(context.seed, "telemetry"),
      };
    },

    queryTelemetrySeries(query: TelemetryQuery): ApiResult<TelemetryPoint[]> {
      const invalid = validateTimeRange(query.from, query.to) || guard(); if (invalid) return { error: invalid };
      const device = data.devices.find((item) => item.id === query.deviceId); if (!device) return { error: { code: "NOT_FOUND", message: "设备不存在。" } };
      if (!own(device)) return { error: { code: "FORBIDDEN", message: "不能读取其他租户的设备。" } };
      const next = random(query.seed + query.deviceId.length); const count = query.granularity === "minute" ? 24 : query.granularity === "hour" ? 12 : 7;
      const duration = Date.parse(query.to) - Date.parse(query.from);
      return { data: Array.from({ length: count }, (_, index) => ({ deviceId: query.deviceId, metric: query.metric, timestamp: new Date(Date.parse(query.from) + index * duration / Math.max(1, count - 1)).toISOString(), value: Number((18 + next() * 12).toFixed(2)), unit: query.metric === "temperature" ? "°C" : query.metric === "humidity" ? "%" : "条", quality: index % 7 === 3 ? "missing" as const : "good" as const })), meta: meta(query.seed, "telemetry-series") };
    },

    listDeviceMessages(deviceId: string): ApiResult<RawDeviceMessage[]> {
      const invalid = guard(); if (invalid) return { error: invalid };
      const device = data.devices.find((item) => item.id === deviceId); if (!device) return { error: { code: "NOT_FOUND", message: "Device not found" } };
      if (!own(device)) return { error: { code: "FORBIDDEN", message: "Device belongs to another tenant" } };
      return { data: Array.from({ length: 8 }, (_, index) => ({ id: `msg_${deviceId}_${index + 1}`, deviceId, topic: `devices/${deviceId}/telemetry`, payload: { temperature: 20 + index }, occurredAt: new Date(Date.parse(generatedAt) - index * 60_000).toISOString(), direction: index % 4 ? "upstream" as const : "downstream" as const })), meta: meta(context.seed, "device-messages") };
    },

    listDeviceAlarms(deviceId: string): ApiResult<Alarm[]> {
      const invalid = guard(); if (invalid) return { error: invalid };
      const device = data.devices.find((item) => item.id === deviceId); if (!device) return { error: { code: "NOT_FOUND", message: "Device not found" } };
      if (!own(device)) return { error: { code: "FORBIDDEN", message: "Device belongs to another tenant" } };
      return { data: device.status === "fault" ? [{ id: `alm_${deviceId}_001`, tenantId: device.tenantId, deviceId, severity: "critical", status: "active", occurredAt: device.lastActiveAt }] : [], meta: meta(context.seed, "device-alarms") };
    },

    controlDevice(deviceId: string): ApiResult<DeviceCommandResult> {
      const invalid = guard(); if (invalid) return { error: invalid };
      if (!canControlDevice(context.role)) return { error: { code: "FORBIDDEN", message: "No control permission" } };
      const device = data.devices.find((item) => item.id === deviceId); if (!device) return { error: { code: "NOT_FOUND", message: "Device not found" } };
      if (!own(device)) return { error: { code: "FORBIDDEN", message: "Device belongs to another tenant" } };
      const failed = context.scenario === "offline" || device.status === "offline";
      return { data: { id: `cmd_${deviceId}_${context.seed}`, deviceId, status: failed ? "failed" : "succeeded", createdAt: generatedAt, reason: failed ? "DEVICE_OFFLINE" : undefined }, meta: meta(context.seed, "control") };
    },

    listProducts(tenantId: string): ApiResult<Product[]> {
      const invalid = guard();
      if (invalid) return { error: invalid };
      if (context.role !== "platformAdmin" && tenantId !== context.tenantId) {
        return { error: { code: "FORBIDDEN", message: "不能读取其他租户的产品。" } };
      }
      return { data: data.products.filter((product) => product.tenantId === tenantId), meta: meta(context.seed, "products") };
    },

    queryProducts(query: ProductListQuery): ApiResult<{ items: Product[]; total: number; page: number; pageSize: number }> {
      const invalid = validatePage(query.page, query.pageSize) || guard();
      if (invalid) return { error: invalid };
      if (context.role !== "platformAdmin" && query.tenantId !== context.tenantId) return { error: { code: "FORBIDDEN", message: "不能读取其他租户的产品。" } };
      const page = query.page ?? 1; const pageSize = query.pageSize ?? 20; const keyword = query.keyword?.trim().toLowerCase();
      const items = data.products.filter((product) => product.tenantId === query.tenantId)
        .filter((product) => !keyword || `${product.name} ${product.productKey}`.toLowerCase().includes(keyword))
        .filter((product) => !query.category || product.category === query.category)
        .filter((product) => !query.status || product.status === query.status)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      return { data: { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize }, meta: meta(query.seed, "product-query") };
    },

    getThingModel(productId: string): ApiResult<ThingModel> {
      const invalid = guard(); if (invalid) return { error: invalid };
      const product = data.products.find((item) => item.id === productId);
      if (!product) return { error: { code: "NOT_FOUND", message: "产品不存在。" } };
      if (!own(product)) return { error: { code: "FORBIDDEN", message: "不能读取其他租户的物模型。" } };
      return { data: structuredClone(models.get(productId)!), meta: meta(context.seed, "thing-model") };
    },

    saveThingModelProperty(input: SaveThingModelPropertyInput): ApiResult<ThingModel> {
      const invalid = guard(); if (invalid) return { error: invalid };
      if (!canManageProducts(context.role)) return { error: { code: "FORBIDDEN", message: "当前角色不能编辑物模型。" } };
      const product = data.products.find((item) => item.id === input.productId);
      if (!product) return { error: { code: "NOT_FOUND", message: "产品不存在。" } };
      if (!own(product)) return { error: { code: "FORBIDDEN", message: "不能编辑其他租户的物模型。" } };
      const model = models.get(input.productId)!; const property = input.property;
      if (input.expectedVersion !== model.version) return { error: { code: "CONFLICT", message: "物模型已被其他操作更新，请刷新后重试。" } };
      if (!/^[a-z][a-zA-Z0-9_]{1,63}$/.test(property.identifier) || !property.name || !property.access) return { error: { code: "VALIDATION_ERROR", message: "属性标识、名称和读写权限为必填项。" } };
      if (property.dataType === "number" && (!property.unit || !Number.isFinite(property.min) || !Number.isFinite(property.max) || property.min! >= property.max!)) return { error: { code: "VALIDATION_ERROR", message: "数值属性必须提供单位及有效的最小值和最大值。" } };
      if (property.dataType === "enum" && (!property.enumValues?.length || new Set(property.enumValues).size !== property.enumValues.length)) return { error: { code: "VALIDATION_ERROR", message: "枚举值不能为空或重复。" } };
      const existing = model.properties.find((item) => item.identifier === property.identifier);
      if (existing && existing.dataType !== property.dataType && product.deviceCount > 0 && !input.confirmImpact) return { error: { code: "IMPACT_CONFIRMATION_REQUIRED", message: `已有 ${product.deviceCount} 台设备，修改关键数据类型需要确认影响。` } };
      const next = { ...model, version: model.version + 1, properties: [...model.properties.filter((item) => item.identifier !== property.identifier), property] };
      models.set(input.productId, next); return { data: structuredClone(next), meta: meta(context.seed, "thing-model-save") };
    },

    testDpRule(productId: string, rule: DpRule, rawValue: number): ApiResult<{ finalValue: number; steps: DpTestStep[] }> {
      const invalid = guard(); if (invalid) return { error: invalid };
      const product = data.products.find((item) => item.id === productId); if (!product) return { error: { code: "NOT_FOUND", message: "产品不存在。" } };
      if (!own(product)) return { error: { code: "FORBIDDEN", message: "不能测试其他租户的 DP 规则。" } };
      const property = models.get(productId)?.properties.find((item) => item.identifier === rule.identifier);
      if (!property) return { error: { code: "VALIDATION_ERROR", message: "DP 规则必须绑定现有物模型项。" } };
      if (!Number.isFinite(rawValue) || !Number.isFinite(rule.scale) || rule.scale === 0 || !Number.isInteger(rule.precision) || rule.precision < 0 || rule.precision > 6) return { error: { code: "VALIDATION_ERROR", message: "原始值、倍率或精度无效。" } };
      const scaled = rawValue * rule.scale; const offset = scaled + rule.offset; const finalValue = Number(offset.toFixed(rule.precision));
      const min = rule.threshold?.min ?? property.min; const max = rule.threshold?.max ?? property.max;
      if ((min !== undefined && finalValue < min) || (max !== undefined && finalValue > max)) return { error: { code: "VALIDATION_ERROR", message: `转换结果 ${finalValue} 超出目标范围。` } };
      return { data: { finalValue, steps: [{ stage: "input", value: rawValue }, { stage: "scale", value: scaled }, { stage: "offset", value: offset }, { stage: "precision", value: finalValue }, { stage: "range", value: finalValue }] }, meta: meta(context.seed, "dp-test") };
    },

    saveDpRule(productId: string, rule: { identifier: string; scale: number; offset: number; precision: number }): ApiResult<{ id: string; productId: string; preview: number }> {
      const invalid = guard();
      if (invalid) return { error: invalid };
      if (!canManageProducts(context.role)) return { error: { code: "FORBIDDEN", message: "当前角色不能编辑物模型或 DP 规则。" } };
      const product = data.products.find((item) => item.id === productId);
      if (!product) return { error: { code: "NOT_FOUND", message: "产品不存在。" } };
      if (!own(product)) return { error: { code: "FORBIDDEN", message: "不能编辑其他租户的产品。" } };
      if (!rule.identifier || rule.scale === 0 || !Number.isInteger(rule.precision) || rule.precision < 0 || rule.precision > 6) {
        return { error: { code: "VALIDATION_ERROR", message: "DP 规则的标识、比例和精度不合法。" } };
      }
      return {
        data: { id: `dpr_${productId}_001`, productId, preview: Number((25 * rule.scale + rule.offset).toFixed(rule.precision)) },
        meta: meta(context.seed, "dp-rule"),
      };
    },

    listRules(tenantId: string): ApiResult<RuleFlow[]> {
      const invalid = guard();
      if (invalid) return { error: invalid };
      if (context.role !== "platformAdmin" && tenantId !== context.tenantId) return { error: { code: "FORBIDDEN", message: "不能读取其他租户的规则。" } };
      return { data: [...rules.values()].filter((item) => item.tenantId === tenantId), meta: meta(context.seed, "rules") };
    },

    saveRuleFlow(flow: RuleFlow): ApiResult<RuleFlow> {
      const invalid = guard() || validateRule(flow); if (invalid) return { error: invalid };
      if (!canManageProducts(context.role) || (context.role !== "platformAdmin" && flow.tenantId !== context.tenantId)) return { error: { code: "FORBIDDEN", message: "当前角色不能保存规则。" } };
      const current = rules.get(flow.id); if (current && flow.version !== current.version) return { error: { code: "CONFLICT", message: `规则版本冲突，当前版本为 ${current.version}。` } };
      const saved = { ...flow, version: flow.version + 1, updatedAt: generatedAt }; rules.set(flow.id, saved); return { data: saved, meta: meta(context.seed, "rule-save") };
    },

    toggleRule(ruleId: string, enabled: boolean): ApiResult<RuleFlow> {
      const invalid = guard(); if (invalid) return { error: invalid }; const flow = rules.get(ruleId); if (!flow) return { error: { code: "NOT_FOUND", message: "规则不存在。" } };
      if (!canManageProducts(context.role) || !own(flow)) return { error: { code: "FORBIDDEN", message: "当前角色不能启停规则。" } };
      const changed = { ...flow, enabled, version: flow.version + 1, updatedAt: generatedAt }; rules.set(ruleId, changed); return { data: changed, meta: meta(context.seed, "rule-toggle") };
    },

    testRuleFlow(tenantId: string, payload: Record<string, unknown>, ruleId = `rule_${tenantId}_001`): ApiResult<RuleTestResult> {
      const invalid = guard(); if (invalid) return { error: invalid };
      if (context.role === "viewer") return { error: { code: "FORBIDDEN", message: "观察员不能试运行规则。" } };
      if (context.role !== "platformAdmin" && tenantId !== context.tenantId) return { error: { code: "FORBIDDEN", message: "不能运行其他租户的规则。" } };
      const flow = rules.get(ruleId); if (!flow || flow.tenantId !== tenantId) return { error: { code: "NOT_FOUND", message: "规则不存在。" } }; const graphError = validateRule(flow); if (graphError) return { error: graphError };
      let value: unknown = payload; const steps = []; let failed = false;
      for (const [index, node] of flow.nodes.entries()) {
        const input = value; let output: unknown = input; let matched = true; let failureReason: string | undefined;
        if (node.type === "condition") { const temperature = Number((payload as { temperature?: unknown }).temperature); if (!Number.isFinite(temperature)) { failed = true; matched = false; failureReason = "样例报文缺少数值字段 temperature。"; output = { matched: false }; } else { matched = temperature > Number(node.config.threshold ?? 24); output = { matched }; } }
        else if (node.type === "transform") output = { ...(typeof input === "object" && input ? input : {}), transformed: true };
        else if (["alarm", "storage", "notification"].includes(node.type)) output = { action: node.type, simulated: true, applied: false };
        steps.push({ node: node.id, nodeId: node.id, nodeType: node.type, input, output, durationMs: 2 + index, matched, failureReason }); value = output; if (failed) break;
      }
      return { data: { flowId: flow.id, status: failed ? "failed" : "succeeded", steps, totalDurationMs: steps.reduce((sum, step) => sum + step.durationMs, 0) }, meta: meta(context.seed, "rule-test") };
    },

    consumeRuleEvent(ruleId: string, deviceId: string, payload: Record<string, unknown>): ApiResult<{ created: boolean; log?: RuleExecutionLog }> {
      const invalid = guard(); if (invalid) return { error: invalid }; const flow = rules.get(ruleId); if (!flow) return { error: { code: "NOT_FOUND", message: "规则不存在。" } }; if (!own(flow)) return { error: { code: "FORBIDDEN", message: "不能消费其他租户的规则事件。" } };
      const device = data.devices.find((item) => item.id === deviceId && item.tenantId === flow.tenantId); if (!device) return { error: { code: "FORBIDDEN", message: "设备不属于规则租户。" } };
      if (!flow.enabled) return { data: { created: false }, meta: meta(context.seed, "rule-event-disabled") };
      const run = this.testRuleFlow(flow.tenantId, payload, ruleId); if ("error" in run) return run; const failedStep = run.data.steps.find((step) => step.failureReason); const log: RuleExecutionLog = { id: `rlog_${ruleLogs.length + 1}`, tenantId: flow.tenantId, ruleId, deviceId, status: run.data.status, startedAt: generatedAt, durationMs: run.data.totalDurationMs, failureNodeId: failedStep?.nodeId, failureReason: failedStep?.failureReason }; ruleLogs.unshift(log); return { data: { created: true, log }, meta: meta(context.seed, "rule-event") };
    },

    listRuleLogs(query: RuleLogQuery): ApiResult<RuleExecutionLog[]> {
      const invalid = guard(); if (invalid) return { error: invalid }; if (context.role !== "platformAdmin" && query.tenantId !== context.tenantId) return { error: { code: "FORBIDDEN", message: "不能读取其他租户的规则日志。" } };
      return { data: ruleLogs.filter((item) => item.tenantId === query.tenantId).filter((item) => !query.ruleId || item.ruleId === query.ruleId).filter((item) => !query.deviceId || item.deviceId === query.deviceId).filter((item) => !query.status || item.status === query.status).filter((item) => !query.from || item.startedAt >= query.from).filter((item) => !query.to || item.startedAt <= query.to), meta: meta(context.seed, "rule-logs") };
    },

    listFirmware(tenantId: string): ApiResult<Firmware[]> {
      const invalid = guard();
      if (invalid) return { error: invalid };
      if (context.role !== "platformAdmin" && tenantId !== context.tenantId) return { error: { code: "FORBIDDEN", message: "不能读取其他租户的固件。" } };
      return { data: [...firmwares.values()].filter((item) => item.tenantId === tenantId), meta: meta(context.seed, "firmware") };
    },

    registerFirmware(input: RegisterFirmwareInput): ApiResult<Firmware> {
      const invalid = guard(); if (invalid) return { error: invalid };
      if (!canManageProducts(context.role) || (context.role !== "platformAdmin" && input.tenantId !== context.tenantId)) return { error: { code: "FORBIDDEN", message: "当前角色不能登记固件。" } };
      if (input.simulateReadFailure) return { error: { code: "VALIDATION_ERROR", message: "浏览器读取固件文件失败，请重新选择文件。" } };
      if (!/^\d+\.\d+\.\d+$/.test(input.version)) return { error: { code: "VALIDATION_ERROR", message: "固件版本必须使用 x.y.z 格式。" } };
      if (input.sizeBytes <= 0 || input.sizeBytes > 20 * 1024 * 1024) return { error: { code: "VALIDATION_ERROR", message: "固件大小必须大于 0 且不超过 20 MB。" } };
      if (!["application/octet-stream", "application/zip"].includes(input.fileType)) return { error: { code: "VALIDATION_ERROR", message: "仅支持 BIN 或 ZIP 固件。" } };
      const product = data.products.find((item) => item.id === input.productId && item.tenantId === input.tenantId); if (!product) return { error: { code: "INCOMPATIBLE_PRODUCT", message: "适配产品不属于当前租户。" } };
      if (!input.compatibleProductIds.length || input.compatibleProductIds.some((id) => !data.products.some((item) => item.id === id && item.tenantId === input.tenantId))) return { error: { code: "INCOMPATIBLE_PRODUCT", message: "固件包含不兼容的适配产品。" } };
      const duplicate = [...firmwares.values()].find((item) => item.productId === input.productId && item.version === input.version); if (duplicate) return { error: { code: "CONFLICT", message: `产品已有版本 ${duplicate.version}（${duplicate.id}），正式固件不可覆盖。` } };
      const checksumValid = /^[a-f\d]{64}$/i.test(input.checksum) && !/^0+$/.test(input.checksum); const id = `fw_${input.productId}_${String(firmwares.size + 1).padStart(3, "0")}`;
      const firmware: Firmware = { ...input, id, status: checksumValid ? "verified" : "draft", checksumStatus: checksumValid ? "valid" : "invalid", createdBy: context.actorId, createdAt: generatedAt, history: [{ action: "registered", actorId: context.actorId, occurredAt: generatedAt }, ...(checksumValid ? [{ action: "verified" as const, actorId: context.actorId, occurredAt: generatedAt }] : [])], referencedOtaIds: [] }; firmwares.set(id, firmware); return { data: firmware, meta: meta(context.seed, "firmware-register") };
    },

    setFirmwareStatus(firmwareId: string, status: "released" | "archived"): ApiResult<Firmware> {
      const invalid = guard(); if (invalid) return { error: invalid }; const firmware = firmwares.get(firmwareId); if (!firmware) return { error: { code: "NOT_FOUND", message: "固件不存在。" } };
      if (!canManageProducts(context.role) || !own(firmware)) return { error: { code: "FORBIDDEN", message: "当前角色不能变更固件状态。" } };
      if (firmware.checksumStatus !== "valid") return { error: { code: "CHECKSUM_FAILED", message: "校验失败的固件不能发布或用于 OTA。" } };
      if (status === "archived" && firmware.referencedOtaIds.length) return { error: { code: "FIRMWARE_IN_USE", message: `固件正被 OTA 任务引用：${firmware.referencedOtaIds.join(", ")}。` } };
      const changed = { ...firmware, status, history: [...firmware.history, { action: status, actorId: context.actorId, occurredAt: generatedAt }] }; firmwares.set(firmwareId, changed); return { data: changed, meta: meta(context.seed, "firmware-status") };
    },

    deleteFirmware(firmwareId: string): ApiResult<{ id: string }> {
      const invalid = guard(); if (invalid) return { error: invalid }; const firmware = firmwares.get(firmwareId); if (!firmware) return { error: { code: "NOT_FOUND", message: "固件不存在。" } };
      if (!canManageProducts(context.role) || !own(firmware)) return { error: { code: "FORBIDDEN", message: "当前角色不能删除固件。" } };
      if (firmware.referencedOtaIds.length) return { error: { code: "FIRMWARE_IN_USE", message: `删除被阻止，引用任务：${firmware.referencedOtaIds.join(", ")}。` } }; firmwares.delete(firmwareId); return { data: { id: firmwareId }, meta: meta(context.seed, "firmware-delete") };
    },

    compareFirmwareVersions(productId: string): ApiResult<Firmware[]> {
      const product = data.products.find((item) => item.id === productId); if (!product) return { error: { code: "NOT_FOUND", message: "产品不存在。" } }; if (!own(product)) return { error: { code: "FORBIDDEN", message: "不能比较其他租户的固件。" } };
      return { data: [...firmwares.values()].filter((item) => item.productId === productId).sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true })), meta: meta(context.seed, "firmware-compare") };
    },

    createOtaPlan(input: CreateOtaInput): ApiResult<OtaTask> {
      const invalid = guard();
      if (invalid) return { error: invalid };
      if (context.role !== "platformAdmin" && context.role !== "tenantAdmin") return { error: { code: "FORBIDDEN", message: "当前角色不能创建 OTA 任务。" } };
      if (context.role !== "platformAdmin" && input.tenantId !== context.tenantId) return { error: { code: "FORBIDDEN", message: "不能创建其他租户的 OTA 任务。" } };
      if (!input.firmwareId || input.targetDeviceIds.length === 0) return { error: { code: "VALIDATION_ERROR", message: "必须选择固件和至少一个目标设备。" } };
      if (input.batchPercent < 1 || input.batchPercent > 100 || input.failureThresholdPercent < 0 || input.failureThresholdPercent > 100) return { error: { code: "VALIDATION_ERROR", message: "灰度批次必须为 1–100%，失败阈值必须为 0–100%。" } };
      const firmware = firmwares.get(input.firmwareId); if (!firmware || firmware.tenantId !== input.tenantId) return { error: { code: "NOT_FOUND", message: "固件不存在。" } };
      if (firmware.checksumStatus !== "valid" || firmware.status !== "released") return { error: { code: "CHECKSUM_FAILED", message: "OTA 只能使用校验通过且已发布的固件。" } };
      const ownsAllDevices = input.targetDeviceIds.every((id) => data.devices.some((device) => device.id === id && device.tenantId === input.tenantId));
      if (!ownsAllDevices) return { error: { code: "FORBIDDEN", message: "目标设备不属于当前租户。" } };
      const compatible = input.targetDeviceIds.every((id) => { const target = data.devices.find((device) => device.id === id)!; return firmware.compatibleProductIds.includes(target.productId); }); if (!compatible) return { error: { code: "INCOMPATIBLE_PRODUCT", message: "目标设备产品与固件不兼容。" } };
      const otaId = `ota_${input.tenantId}_${String(otaTasks.size + 1).padStart(3, "0")}`; const batchSize = Math.max(1, Math.ceil(input.targetDeviceIds.length * input.batchPercent / 100)); const batches = Array.from({ length: Math.ceil(input.targetDeviceIds.length / batchSize) }, (_, index) => ({ number: index + 1, deviceIds: input.targetDeviceIds.slice(index * batchSize, (index + 1) * batchSize), status: "pending" as const, succeeded: 0, failed: 0 }));
      const devices = input.targetDeviceIds.map((deviceId, index) => { const device = data.devices.find((item) => item.id === deviceId)!; return { deviceId, batch: Math.floor(index / batchSize) + 1, stage: "queued" as const, stageHistory: ["queued" as const], previousVersion: String(device.shadow.firmware ?? "unknown"), targetVersion: firmware.version, attempts: [] }; });
      const task: OtaTask = { id: otaId, tenantId: input.tenantId, firmwareId: input.firmwareId, status: "queued", total: devices.length, succeeded: 0, failed: 0, batchPercent: input.batchPercent, failureThresholdPercent: input.failureThresholdPercent, createdAt: generatedAt, batches, devices, logs: [{ action: "created", actorId: context.actorId, occurredAt: generatedAt, detail: `影响 ${devices.length} 台设备，共 ${batches.length} 批` }], versionDistribution: devices.reduce<Record<string, number>>((acc, item) => { acc[item.previousVersion] = (acc[item.previousVersion] ?? 0) + 1; return acc; }, {}) }; otaTasks.set(otaId, task); firmware.referencedOtaIds.push(otaId); return { data: task, meta: meta(context.seed, "ota-create") };
    },

    createOtaTask(tenantId: string, firmwareId: string, targetDeviceIds: string[]): ApiResult<OtaTask> {
      return this.createOtaPlan({ tenantId, firmwareId, targetDeviceIds, batchPercent: 10, failureThresholdPercent: 20 });
    },

    listOtaTasks(tenantId: string): ApiResult<OtaTask[]> { const invalid = guard(); if (invalid) return { error: invalid }; if (context.role !== "platformAdmin" && tenantId !== context.tenantId) return { error: { code: "FORBIDDEN", message: "不能读取其他租户的 OTA 任务。" } }; return { data: [...otaTasks.values()].filter((item) => item.tenantId === tenantId), meta: meta(context.seed, "ota-list") }; },

    getOtaTask(taskId: string): ApiResult<OtaTask> { const invalid = guard(); if (invalid) return { error: invalid }; const task = otaTasks.get(taskId); if (!task) return { error: { code: "NOT_FOUND", message: "OTA 任务不存在。" } }; if (context.role !== "platformAdmin" && task.tenantId !== context.tenantId) return { error: { code: "FORBIDDEN", message: "不能读取其他租户的 OTA 任务。" } }; return { data: task, meta: meta(context.seed, "ota-detail") }; },

    startOrContinueOta(taskId: string): ApiResult<OtaTask> { const invalid = guard(); if (invalid) return { error: invalid }; const task = otaTasks.get(taskId); if (!task) return { error: { code: "NOT_FOUND", message: "OTA 任务不存在。" } }; if (!["platformAdmin", "tenantAdmin", "operator"].includes(context.role) || !own(task)) return { error: { code: "FORBIDDEN", message: "当前角色不能开始或继续 OTA。" } }; if (!["queued", "paused"].includes(task.status)) return { error: { code: "CONFLICT", message: `任务状态 ${task.status} 不能开始或继续。` } }; task.status = "running"; task.logs.push({ action: "started", actorId: context.actorId, occurredAt: generatedAt, detail: "开始或继续下一灰度批次" }); return { data: task, meta: meta(context.seed, "ota-start") }; },

    advanceOtaBatch(taskId: string, simulatedFailurePercent = 0): ApiResult<OtaTask> { const invalid = guard(); if (invalid) return { error: invalid }; const task = otaTasks.get(taskId); if (!task) return { error: { code: "NOT_FOUND", message: "OTA 任务不存在。" } }; if (task.status !== "running") return { error: { code: "CONFLICT", message: "只有运行中的任务可以推进批次。" } }; const batch = task.batches.find((item) => item.status === "pending"); if (!batch) { task.status = "succeeded"; return { data: task, meta: meta(context.seed, "ota-advance") }; } batch.status = "running"; const failCount = Math.min(batch.deviceIds.length, Math.ceil(batch.deviceIds.length * simulatedFailurePercent / 100)); batch.deviceIds.forEach((deviceId, index) => { const progress = task.devices.find((item) => item.deviceId === deviceId)!; const failed = index < failCount; progress.stageHistory.push("downloading"); if (failed) progress.stageHistory.push("failed"); else progress.stageHistory.push("verifying", "installing", "restarting", "succeeded"); progress.stage = failed ? "failed" : "succeeded"; progress.attempts.push({ number: progress.attempts.length + 1, stage: progress.stage, status: failed ? "failed" : "succeeded", startedAt: generatedAt, failureReason: failed ? (index % 2 ? "DOWNLOAD_FAILED" : "DEVICE_OFFLINE") : undefined }); }); batch.failed = failCount; batch.succeeded = batch.deviceIds.length - failCount; task.failed += batch.failed; task.succeeded += batch.succeeded; const failureRate = batch.failed / batch.deviceIds.length * 100; if (failureRate > task.failureThresholdPercent) { batch.status = "failed"; task.status = "paused"; task.alertId = `alm_${task.id}_threshold`; task.logs.push({ action: "auto-paused", actorId: "mock-system", occurredAt: generatedAt, detail: `批次 ${batch.number} 失败率 ${failureRate.toFixed(1)}% 超过阈值 ${task.failureThresholdPercent}%` }); } else { batch.status = "succeeded"; task.status = task.batches.every((item) => item.status === "succeeded") ? "succeeded" : "running"; task.logs.push({ action: "batch-completed", actorId: "mock-system", occurredAt: generatedAt, detail: `批次 ${batch.number} 完成` }); } task.versionDistribution = task.devices.reduce<Record<string, number>>((acc, item) => { const version = item.stage === "succeeded" ? item.targetVersion : item.previousVersion; acc[version] = (acc[version] ?? 0) + 1; return acc; }, {}); return { data: task, meta: meta(context.seed, "ota-advance") }; },

    pauseOtaTask(taskId: string): ApiResult<OtaTask> { const task = otaTasks.get(taskId); if (!task) return { error: { code: "NOT_FOUND", message: "OTA 任务不存在。" } }; if (!["platformAdmin", "tenantAdmin", "operator"].includes(context.role) || !own(task)) return { error: { code: "FORBIDDEN", message: "当前角色不能暂停 OTA。" } }; if (task.status !== "running") return { error: { code: "CONFLICT", message: "只有运行中的任务可以暂停。" } }; task.status = "paused"; task.logs.push({ action: "paused", actorId: context.actorId, occurredAt: generatedAt, detail: "人工暂停" }); return { data: task, meta: meta(context.seed, "ota-pause") }; },

    cancelOtaTask(taskId: string, confirmed: boolean): ApiResult<OtaTask> { const task = otaTasks.get(taskId); if (!task) return { error: { code: "NOT_FOUND", message: "OTA 任务不存在。" } }; if (!confirmed) return { error: { code: "IMPACT_CONFIRMATION_REQUIRED", message: "取消 OTA 是高风险操作，请二次确认。" } }; if (!canManageProducts(context.role) || !own(task)) return { error: { code: "FORBIDDEN", message: "当前角色不能取消 OTA。" } }; task.status = "cancelled"; task.devices.filter((item) => !["succeeded", "failed"].includes(item.stage)).forEach((item) => { item.stage = "cancelled"; }); task.logs.push({ action: "cancelled", actorId: context.actorId, occurredAt: generatedAt, detail: "二次确认后取消" }); return { data: task, meta: meta(context.seed, "ota-cancel") }; },

    retryFailedOtaDevices(taskId: string): ApiResult<OtaTask> { const task = otaTasks.get(taskId); if (!task) return { error: { code: "NOT_FOUND", message: "OTA 任务不存在。" } }; if (!["platformAdmin", "tenantAdmin", "operator"].includes(context.role) || !own(task)) return { error: { code: "FORBIDDEN", message: "当前角色不能重试 OTA。" } }; const failed = task.devices.filter((item) => item.stage === "failed"); if (!failed.length) return { error: { code: "CONFLICT", message: "没有可重试的失败设备。" } }; failed.forEach((item) => { item.stageHistory.push("downloading", "verifying", "installing", "restarting", "succeeded"); item.attempts.push({ number: item.attempts.length + 1, stage: "succeeded", status: "succeeded", startedAt: generatedAt }); item.stage = "succeeded"; }); task.succeeded += failed.length; task.failed -= failed.length; task.status = task.succeeded === task.total ? "succeeded" : "paused"; task.logs.push({ action: "retried", actorId: context.actorId, occurredAt: generatedAt, detail: `重试 ${failed.length} 台，保留原失败尝试` }); return { data: task, meta: meta(context.seed, "ota-retry") }; },

    rollbackOtaTask(taskId: string, confirmed: boolean): ApiResult<OtaTask> { const original = otaTasks.get(taskId); if (!original) return { error: { code: "NOT_FOUND", message: "OTA 任务不存在。" } }; if (!confirmed) return { error: { code: "IMPACT_CONFIRMATION_REQUIRED", message: "回滚 OTA 是高风险操作，请二次确认。" } }; if (!canManageProducts(context.role) || !own(original)) return { error: { code: "FORBIDDEN", message: "当前角色不能回滚 OTA。" } }; const id = `ota_${original.tenantId}_rollback_${otaTasks.size + 1}`; const devices = original.devices.map((item) => ({ deviceId: item.deviceId, batch: 1, stage: "rolledBack" as const, stageHistory: ["queued" as const, "downloading" as const, "verifying" as const, "installing" as const, "restarting" as const, "rolledBack" as const], previousVersion: item.targetVersion, targetVersion: item.previousVersion, attempts: [{ number: 1, stage: "rolledBack" as const, status: "succeeded" as const, startedAt: generatedAt }] })); const rollback: OtaTask = { id, tenantId: original.tenantId, firmwareId: original.firmwareId, status: "rolledBack", total: devices.length, succeeded: devices.length, failed: 0, batchPercent: 100, failureThresholdPercent: original.failureThresholdPercent, createdAt: generatedAt, rollbackOfTaskId: original.id, batches: [{ number: 1, deviceIds: devices.map((item) => item.deviceId), status: "succeeded", succeeded: devices.length, failed: 0 }], devices, logs: [{ action: "rollback-created", actorId: context.actorId, occurredAt: generatedAt, detail: `由 ${original.id} 创建，原任务历史保持不变` }], versionDistribution: devices.reduce<Record<string, number>>((acc, item) => { acc[item.targetVersion] = (acc[item.targetVersion] ?? 0) + 1; return acc; }, {}) }; otaTasks.set(id, rollback); return { data: rollback, meta: meta(context.seed, "ota-rollback") }; 
    },

    listTenants(): ApiResult<TenantSummary[]> {
      const invalid = guard();
      if (invalid) return { error: invalid };
      if (context.role !== "platformAdmin") return { error: { code: "FORBIDDEN", message: "只有平台管理员可以管理租户。" } };
      return { data: data.tenants.map(tenantSummary), meta: meta(context.seed, "tenants") };
    },

    getTenantDetail(tenantId: string): ApiResult<TenantDetail> {
      const invalid = guard(); if (invalid) return { error: invalid };
      const tenant = data.tenants.find((item) => item.id === tenantId); if (!tenant) return { error: { code: "NOT_FOUND", message: "租户不存在。" } };
      if (context.role !== "platformAdmin" && context.tenantId !== tenantId) return { error: { code: "FORBIDDEN", message: "不能读取其他租户。" } };
      return { data: { ...tenantSummary(tenant), members: data.users.filter((item) => item.tenantId === tenantId), quotas: quotasFor(tenantId), productIds: data.products.filter((item) => item.tenantId === tenantId).map((item) => item.id), deviceIds: data.devices.filter((item) => item.tenantId === tenantId).map((item) => item.id) }, meta: meta(context.seed, "tenant-detail") };
    },

    previewRole(role: RoleCode): ApiResult<PermissionPreview> {
      const invalid = guard(); if (invalid) return { error: invalid };
      return { data: { role, permissions: permissionMap[role] }, meta: meta(context.seed, "role-preview") };
    },

    inviteTenantMember(tenantId: string, name: string, role: Exclude<RoleCode, "platformAdmin">): ApiResult<User> {
      const invalid = guard(); if (invalid) return { error: invalid };
      if (context.role !== "platformAdmin" && (context.role !== "tenantAdmin" || context.tenantId !== tenantId)) return { error: { code: "FORBIDDEN", message: "当前角色不能邀请成员。" } };
      if (!name.trim()) return { error: { code: "VALIDATION_ERROR", message: "成员名称不能为空。" } };
      const member: User = { id: `usr_${String(data.users.length + 1).padStart(3, "0")}`, tenantId, name: name.trim(), role, status: "active" }; data.users.push(member);
      return { data: member, meta: meta(context.seed, "member-invite") };
    },

    updateTenantMember(memberId: string, patch: { role?: Exclude<RoleCode, "platformAdmin">; status?: User["status"]; remove?: boolean }): ApiResult<User> {
      const invalid = guard(); if (invalid) return { error: invalid };
      const index = data.users.findIndex((item) => item.id === memberId); if (index < 0) return { error: { code: "NOT_FOUND", message: "成员不存在。" } }; const member = data.users[index];
      if (context.role !== "platformAdmin" && (context.role !== "tenantAdmin" || context.tenantId !== member.tenantId)) return { error: { code: "FORBIDDEN", message: "当前角色不能编辑成员。" } };
      if (patch.remove) data.users.splice(index, 1); else data.users[index] = { ...member, role: patch.role ?? member.role, status: patch.status ?? member.status };
      return { data: patch.remove ? member : data.users[index], meta: meta(context.seed, "member-update") };
    },

    simulateCreateDevice(tenantId: string): ApiResult<{ tenantId: string; used: number; limit: number }> {
      const invalid = guard(); if (invalid) return { error: invalid };
      if (!permissionMap[context.role].includes("device.create") || (context.role !== "platformAdmin" && context.tenantId !== tenantId)) return { error: { code: "FORBIDDEN", message: "当前角色不能创建设备。" } };
      const quota = quotasFor(tenantId).find((item) => item.resource === "devices")!;
      if (quota.used >= quota.limit) return { error: { code: "QUOTA_EXCEEDED", message: `设备配额已用 ${quota.used}/${quota.limit}，不能继续创建。` } };
      return { data: { tenantId, used: quota.used + 1, limit: quota.limit }, meta: meta(context.seed, "device-create") };
    },
  };
}
