import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
export const navigation = [
  [
    "运行视图",
    [
      ["workspace", "工作区"],
      ["alarms", "告警中心"],
      ["telemetry", "时序数据"],
      ["nodes", "全球节点"],
    ],
  ],
  [
    "资产与自动化",
    [
      ["devices", "设备中心"],
      ["products", "产品与物模型"],
      ["rules", "规则与场景"],
      ["ota", "固件与 OTA"],
      ["connectors", "连接与转发"],
    ],
  ],
  [
    "组织与治理",
    [
      ["tenants", "租户与成员"],
      ["access", "角色与权限"],
      ["audit", "审计与运维"],
      ["settings", "设置与集成"],
    ],
  ],
  ["工程教学", [["learning", "学习与交付"]]],
] as const;
export const pageNames: Record<string, string> = Object.fromEntries(
  navigation.flatMap(
    ([, items]): readonly (readonly [string, string])[] => items,
  ),
);
export const descriptions: Record<string, string> = {
  workspace: "示例工作区 · 2026 年 10 月 19 日 · 固定演示数据",
  devices: "管理设备全生命周期，从接入到诊断与控制。",
  products: "用一致的数据语言连接设备与应用。",
  telemetry: "按设备查询指标，定位异常发生的时刻。",
  rules: "从数据条件到可追踪的运维行动。",
  alarms: "确认、分派与解决，形成完整处置记录。",
  ota: "有范围、有进度、有恢复路径的版本交付。",
  tenants: "明确成员职责、资源边界和使用配额。",
  access: "将可执行的操作与职责匹配。",
  connectors: "查看协议入口、连接状态与数据去向。",
  audit: "每一次关键操作都有可追踪的上下文。",
  settings: "控制工作区偏好与外部集成边界。",
  nodes: "以地域与节点维度查看接入健康。",
  learning: "同一业务标准，三种框架独立惯用实现。",
};
export function Header({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function PageHeader({
  page,
  children,
}: {
  page: string;
  children?: ReactNode;
}) {
  return (
    <Header title={pageNames[page]} description={descriptions[page]}>
      {children}
    </Header>
  );
}
export function Button({
  children,
  onClick,
  kind = "",
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  kind?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={kind}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
export function Tag({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: string;
}) {
  const colors: Record<string, string> = {
    在线: "ok",
    健康: "ok",
    成功: "ok",
    已解决: "ok",
    完成: "ok",
    待确认: "bad",
    失败: "bad",
    部分失败: "bad",
    离线: "warn",
    待接入: "pending",
    已邀请: "pending",
    已确认: "info",
    运行中: "info",
    重试中: "info",
  };
  return (
    <span className={"tag " + (tone ?? colors[String(children)] ?? "")}>
      {children}
    </span>
  );
}
export function Note({
  children,
  warn = false,
}: {
  children: ReactNode;
  warn?: boolean;
}) {
  return <div className={"note" + (warn ? " warn" : "")}>{children}</div>;
}
export function Table({
  columns,
  rows,
  footer,
}: {
  columns: ReactNode[];
  rows: ReactNode[][];
  footer?: ReactNode;
}) {
  return (
    <>
      <div className="table-hint">左右滑动表格查看更多字段</div>
      <div
        className="table-wrap"
        tabIndex={0}
        role="region"
        aria-label="数据表，可横向滚动"
      >
        <table>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  <div className="empty">
                    <h2>没有匹配的数据</h2>
                    <p>调整筛选条件，或添加第一条记录。</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footer && <div className="table-foot">{footer}</div>}
    </>
  );
}
export function Metrics({ items }: { items: [string, ReactNode, string][] }) {
  return (
    <div className="metric-strip">
      {items.map(([label, value, meta]) => (
        <div className="metric" key={label}>
          <div className="metric-label">{label}</div>
          <div className="metric-value">{value}</div>
          <div className="metric-meta">{meta}</div>
        </div>
      ))}
    </div>
  );
}
export function VLink({
  to,
  children,
  ...props
}: {
  to: string;
  children: ReactNode;
  className?: string;
  "data-device-link"?: string;
}) {
  return (
    <Link to={to.startsWith("/") ? to : "/v3/" + to} {...props}>
      {children}
    </Link>
  );
}
export function Trend({ telemetry = false }: { telemetry?: boolean }) {
  const gradient = useId();
  const line =
    "M0 108L24 103L49 112L75 88L98 93L124 78L148 88L174 67L198 73L224 58L248 67L274 54L298 65L324 48L348 61L374 41L398 49L424 35L448 54L474 29L498 41L524 26L548 39L574 20L598 36L624 23L640 29";
  return (
    <>
      <div
        className="chart"
        role="img"
        aria-label={
          telemetry
            ? "温度趋势视觉示意；精确采样读数见时序数据表"
            : "消息吞吐量固定示意：接收8420条、转发7960条、错误12条"
        }
      >
        <svg
          viewBox="0 0 640 145"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#6ab5a4" stopOpacity=".20" />
              <stop offset="100%" stopColor="#6ab5a4" stopOpacity=".01" />
            </linearGradient>
          </defs>
          <path
            d="M0 20H640 M0 60H640 M0 100H640 M0 140H640"
            fill="none"
            stroke="#e5ecef"
          />
          <path d={line + "V140H0Z"} fill={`url(#${gradient})`} />
          <path d={line} fill="none" stroke="#158576" strokeWidth="2.5" />
          <path
            d="M0 119L60 111L120 115L180 104L240 110L300 95L360 100L420 85L480 91L540 80L600 86L640 75"
            fill="none"
            stroke="#668cbd"
            strokeWidth="1.8"
            strokeDasharray="5 4"
          />
        </svg>
        <div className="chart-axis">
          {["08:00", "08:15", "08:30", "08:45", "09:00"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
      <div className="table-foot">
        <span>
          {telemetry
            ? "趋势仅为视觉示意；采样读数见时序数据"
            : "摘要：接收 8,420 条 · 转发 7,960 条 · 错误 12 条"}
        </span>
        <span>固定演示窗口</span>
      </div>
    </>
  );
}
