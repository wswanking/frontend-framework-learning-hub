export type RoleCode = "platformAdmin" | "tenantAdmin" | "operator" | "viewer";
export type DeviceStatus = "inactive" | "online" | "offline" | "fault" | "maintenance";
export type ApiScenario = "normal" | "slow" | "partialFailure" | "forbidden" | "offline";

export interface RequestContext {
  actorId: string;
  role: RoleCode;
  tenantId: string;
  seed: number;
  scenario?: ApiScenario;
}

export interface Tenant {
  id: string;
  name: string;
  plan: "starter" | "growth" | "enterprise";
  status: "active" | "suspended";
}

export interface User {
  id: string;
  tenantId: string;
  name: string;
  role: RoleCode;
  status: "active" | "disabled";
}

export interface TenantQuotaItem {
  resource: "devices" | "products" | "messages" | "storageGb" | "otaConcurrency";
  used: number;
  limit: number;
  warningAt: number;
  status: "normal" | "warning" | "exceeded";
}

export interface TenantSummary extends Tenant {
  memberCount: number;
  deviceCount: number;
  messageCount: number;
  quotaUsagePercent: number;
}

export interface TenantDetail extends TenantSummary {
  members: User[];
  quotas: TenantQuotaItem[];
  productIds: string[];
  deviceIds: string[];
}

export interface PermissionPreview {
  role: RoleCode;
  permissions: string[];
}

export interface EdgeNode {
  id: string;
  tenantId: string;
  name: string;
  continent: string;
  countryCode: string;
  location: { latitude: number; longitude: number };
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  productKey: string;
  category: string;
  protocol: "MQTT" | "HTTP" | "Modbus";
  status: "draft" | "active" | "archived";
  updatedAt: string;
  deviceCount: number;
}

export interface ThingModelProperty {
  identifier: string;
  name: string;
  dataType: "number" | "boolean" | "string" | "enum";
  unit?: string;
  access: "read" | "write" | "readWrite";
  min?: number;
  max?: number;
  enumValues?: string[];
}

export interface ThingModelEvent { identifier: string; name: string; severity: "info" | "warning" | "critical"; }
export interface ThingModelService { identifier: string; name: string; input: ThingModelProperty[]; output: ThingModelProperty[]; }

export interface ThingModel {
  id: string;
  productId: string;
  properties: ThingModelProperty[];
  events: ThingModelEvent[];
  services: ThingModelService[];
  version: number;
}

export interface DpRule {
  id: string;
  productId: string;
  identifier: string;
  scale: number;
  offset: number;
  precision: number;
  dataType: ThingModelProperty["dataType"];
  enumMap?: Record<string, string>;
  threshold?: { min?: number; max?: number };
  expression?: string;
}

export interface ProductListQuery { tenantId: string; seed: number; keyword?: string; category?: string; status?: Product["status"]; page?: number; pageSize?: number; }
export interface SaveThingModelPropertyInput { productId: string; property: ThingModelProperty; expectedVersion: number; confirmImpact?: boolean; }
export interface SaveThingModelEventInput { productId: string; event: ThingModelEvent; expectedVersion: number; }
export interface SaveThingModelServiceInput { productId: string; service: ThingModelService; expectedVersion: number; }
export interface DpTestStep { stage: "input" | "scale" | "offset" | "precision" | "expression" | "enum" | "range"; value: unknown; }

export interface Device {
  id: string;
  tenantId: string;
  productId: string;
  nodeId: string;
  name: string;
  status: DeviceStatus;
  lastActiveAt: string;
  location?: { latitude: number; longitude: number };
  tags: string[];
  shadow: Record<string, number | string | boolean>;
}

export interface TelemetryPoint {
  deviceId: string;
  metric: "temperature" | "humidity" | "messages";
  timestamp: string;
  value: number;
  unit: string;
  quality: "good" | "stale" | "invalid" | "missing";
}

export interface Alarm {
  id: string;
  tenantId: string;
  deviceId: string;
  severity: "info" | "warning" | "critical";
  status: "active" | "acknowledged" | "resolved";
  occurredAt: string;
}

export interface RuleFlow {
  id: string;
  tenantId: string;
  name: string;
  productId: string;
  enabled: boolean;
  version: number;
  versionNote: string;
  updatedAt: string;
  lastExecutedAt?: string;
  successRate: number;
  nodes: RuleNode[];
  edges: RuleEdge[];
}

export interface RuleNode { id: string; type: "trigger" | "condition" | "transform" | "delay" | "alarm" | "storage" | "notification"; name: string; config: Record<string, unknown> }
export interface RuleEdge { id: string; from: string; to: string }
export interface RuleTestStep { node: string; nodeId: string; nodeType: RuleNode["type"]; input: unknown; output: unknown; durationMs: number; matched: boolean; failureReason?: string }
export interface RuleTestResult { flowId: string; status: "succeeded" | "failed"; steps: RuleTestStep[]; totalDurationMs: number }
export interface RuleExecutionLog { id: string; tenantId: string; ruleId: string; deviceId: string; status: "succeeded" | "failed"; startedAt: string; durationMs: number; failureNodeId?: string; failureReason?: string }
export interface RuleLogQuery { tenantId: string; ruleId?: string; deviceId?: string; status?: RuleExecutionLog["status"]; from?: string; to?: string }

export interface Firmware {
  id: string;
  tenantId: string;
  productId: string;
  version: string;
  status: "draft" | "verified" | "released" | "archived";
  checksum: string;
  checksumStatus: "valid" | "invalid";
  fileName: string;
  fileType: "application/octet-stream" | "application/zip";
  sizeBytes: number;
  description: string;
  compatibleProductIds: string[];
  createdBy: string;
  createdAt: string;
  history: { action: "registered" | "verified" | "released" | "archived"; actorId: string; occurredAt: string }[];
  referencedOtaIds: string[];
}

export interface RegisterFirmwareInput { tenantId: string; productId: string; version: string; fileName: string; fileType: Firmware["fileType"]; sizeBytes: number; checksum: string; description: string; compatibleProductIds: string[]; simulateReadFailure?: boolean }

export interface OtaTask {
  id: string;
  tenantId: string;
  firmwareId: string;
  status: "draft" | "queued" | "running" | "paused" | "succeeded" | "failed" | "cancelled" | "rolledBack";
  total: number;
  succeeded: number;
  failed: number;
  batchPercent: number;
  failureThresholdPercent: number;
  createdAt: string;
  alertId?: string;
  rollbackOfTaskId?: string;
  batches: OtaBatch[];
  devices: OtaDeviceProgress[];
  logs: { action: string; actorId: string; occurredAt: string; detail: string }[];
  versionDistribution: Record<string, number>;
}

export type OtaDeviceStage = "queued" | "downloading" | "verifying" | "installing" | "restarting" | "succeeded" | "failed" | "cancelled" | "rolledBack";
export interface OtaAttempt { number: number; stage: OtaDeviceStage; status: "running" | "succeeded" | "failed"; startedAt: string; failureReason?: "DEVICE_OFFLINE" | "VERSION_INCOMPATIBLE" | "DOWNLOAD_FAILED" | "CHECKSUM_FAILED" | "RESTART_TIMEOUT" }
export interface OtaDeviceProgress { deviceId: string; batch: number; stage: OtaDeviceStage; stageHistory: OtaDeviceStage[]; previousVersion: string; targetVersion: string; attempts: OtaAttempt[] }
export interface OtaBatch { number: number; deviceIds: string[]; status: "pending" | "running" | "paused" | "succeeded" | "failed"; succeeded: number; failed: number }
export interface CreateOtaInput { tenantId: string; firmwareId: string; targetDeviceIds: string[]; batchPercent: number; failureThresholdPercent: number }

export interface DashboardQuery {
  tenantId: string;
  from: string;
  to: string;
  seed: number;
  region?: string;
}

export interface DeviceListQuery {
  tenantId: string;
  seed: number;
  productId?: string;
  status?: DeviceStatus;
  keyword?: string;
  region?: string;
  tags?: string[];
  activeAfter?: string;
  activeBefore?: string;
  sortBy?: "name" | "status" | "lastActiveAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface TelemetryQuery { deviceId: string; metric: TelemetryPoint["metric"]; from: string; to: string; granularity: "minute" | "hour" | "day"; seed: number }
export interface RawDeviceMessage { id: string; deviceId: string; topic: string; payload: Record<string, unknown>; occurredAt: string; direction: "upstream" | "downstream" }
export interface DeviceCommandResult { id: string; deviceId: string; status: "queued" | "succeeded" | "failed"; createdAt: string; reason?: string }

export interface TopologyQuery {
  tenantId: string;
  seed: number;
  continent?: string;
  countryCode?: string;
  nodeId?: string;
  productId?: string;
  status?: DeviceStatus;
}

export interface TopologyNode extends EdgeNode {
  deviceCount: number;
  onlineCount: number;
  messageCount: number;
  alarmCount: number;
  lastActiveAt?: string;
}

export interface TopologyResult {
  nodes: TopologyNode[];
  devices: Device[];
  unlocatedDevices: Device[];
}

export interface ApiMeta {
  requestId: string;
  seed: number;
  generatedAt: string;
}

export interface ApiFailure {
  code:
    | "VALIDATION_ERROR"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "DEVICE_OFFLINE"
    | "SCENARIO_TIMEOUT"
    | "PARTIAL_FAILURE"
    | "CONFLICT"
    | "QUOTA_EXCEEDED"
    | "CHECKSUM_FAILED"
    | "INCOMPATIBLE_PRODUCT"
    | "FIRMWARE_IN_USE"
    | "IMPACT_CONFIRMATION_REQUIRED";
  message: string;
  retryable?: boolean;
}

export type ApiResult<T> =
  | { data: T; meta: ApiMeta; error?: never }
  | { error: ApiFailure; data?: never; meta?: never };

export const canManageProducts = (role: RoleCode) =>
  role === "platformAdmin" || role === "tenantAdmin";

export const canControlDevice = (role: RoleCode) =>
  role === "platformAdmin" || role === "tenantAdmin" || role === "operator";

export function validatePage(page = 1, pageSize = 20): ApiFailure | undefined {
  if (!Number.isInteger(page) || !Number.isInteger(pageSize) || page < 1 || pageSize < 1 || pageSize > 100) {
    return { code: "VALIDATION_ERROR", message: "page 必须从 1 开始，pageSize 必须在 1 到 100 之间。" };
  }
}

export function validateTimeRange(from: string, to: string): ApiFailure | undefined {
  if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(from) >= Date.parse(to)) {
    return { code: "VALIDATION_ERROR", message: "from 必须早于 to，且均为有效 ISO 时间。" };
  }
}

export function validateIsoUtc(value: string): ApiFailure | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
    return { code: "VALIDATION_ERROR", message: "timestamp must be an ISO 8601 UTC value" };
  }
}
