"use client";

import { useState } from "react";
import { createMockApi } from "../packages/mock-api/index";
import { DeliveryBoard } from "./delivery-board";

const navigation = ["数据大盘", "全球节点", "产品中心", "设备管理", "规则引擎", "固件与 OTA", "租户管理", "框架实验室", "交付看板"];
const api = createMockApi({ actorId: "usr_001", role: "tenantAdmin", tenantId: "ten_cn_001", seed: 20260829 });
const dashboard = api.getDashboard({ tenantId: "ten_cn_001", seed: 20260829, from: "2026-08-28T00:00:00.000Z", to: "2026-08-29T00:00:00.000Z" });

const frameworkApps = [
  { name: "React", library: "MUI", accent: "#61dafb", href: "/frameworks/react/index.html", detail: "Hooks、React Router、按需实验室" },
  { name: "Vue", library: "Element Plus", accent: "#42b883", href: "/frameworks/vue/index.html", detail: "Composition API、Pinia、响应式工作台" },
  { name: "Angular", library: "Angular Material", accent: "#dd0031", href: "/frameworks/angular/index.html", detail: "Standalone、Signals、Material 组件" },
];

const sectionRoutes: Record<string, string> = {
  数据大盘: "#/",
  全球节点: "#/topology",
  产品中心: "#/products",
  设备管理: "#/devices",
  规则引擎: "#/rules",
  "固件与 OTA": "#/firmware",
  租户管理: "#/tenants",
  框架实验室: "#/labs",
};

function Portal({ section }: { section: string }) {
  const data = "data" in dashboard ? dashboard.data : undefined;
  const route = sectionRoutes[section] ?? "#/";
  const metrics = data ? [
    ["接入设备", data.metrics.connectedDevices.toLocaleString("zh-CN")],
    ["在线率", `${data.metrics.onlineRate ?? 0}%`],
    ["24h 消息量", data.metrics.messageCount.toLocaleString("zh-CN")],
    ["OTA 成功率", `${data.metrics.otaSuccessRate ?? 0}%`],
  ] : [];

  return <section className="portal" aria-label={`${section}框架入口`}>
    <div className="portal-hero panel">
      <div>
        <label>ONE CONTRACT · THREE FRAMEWORKS</label>
        <h2>三框架，同一套 IoT 业务契约</h2>
        <p>选择 React、Vue 或 Angular，进入完整的「{section}」实现。三端共享固定 seed、权限和 Mock 结果，但保持各自工程与组件体系独立。</p>
        <div className="feature-tags" aria-label="平台能力"><span>全球拓扑</span><span>物模型与 DP</span><span>设备时序</span><span>规则引擎</span><span>固件与 OTA</span><span>租户隔离</span></div>
      </div>
      <div className="seed-card"><small>DETERMINISTIC DATASET</small><strong>20260829</strong><span>固定 seed · UTC · ten_cn_001</span></div>
    </div>

    {section === "数据大盘" && <div className="metrics portal-metrics" aria-label="共享指标摘要">{metrics.map(([label, value]) => <article className="metric panel" key={label}><div><span>{label}</span><em>LIVE</em></div><strong>{value}</strong><small>三端查询结果一致</small></article>)}</div>}

    <div className="framework-grid">
      {frameworkApps.map(item => <article className="framework-card panel" key={item.name} style={{ "--framework-accent": item.accent } as React.CSSProperties}>
        <div className="framework-card-head"><b>{item.name.slice(0, 2).toUpperCase()}</b><span><strong>{item.name}</strong><small>{item.library}</small></span></div>
        <p>{item.detail}</p>
        <ul><li>完整 IoT 业务导航</li><li>明暗主题与响应式布局</li><li>相同契约、异常与验收语义</li></ul>
        <a href={`${item.href}${route}`} target="_blank" rel="noreferrer">进入 {item.name} 应用 <span aria-hidden="true">↗</span></a>
      </article>)}
    </div>

    <div className="portal-foot panel"><div><strong>当前模块：{section}</strong><span>每个入口均打开可独立运行的生产构建。</span></div><a href="/frameworks/react/index.html#/labs" target="_blank" rel="noreferrer">查看组件与图表对比实验</a></div>
  </section>;
}

export function DashboardShell() {
  const [dark, setDark] = useState(() => typeof window === "undefined" || localStorage.getItem("iot-atlas-theme") !== "light");
  const [active, setActive] = useState("数据大盘");
  const toggle = () => setDark(value => { localStorage.setItem("iot-atlas-theme", value ? "light" : "dark"); return !value; });

  return <main className={dark ? "app dark" : "app"}>
    <aside className="sidebar">
      <div className="brand"><b>IA</b><span>IoT Atlas<small>FRAMEWORK LAB</small></span></div>
      <nav aria-label="主导航">{navigation.map((item, index) => <button className={active === item ? "nav active" : "nav"} onClick={() => setActive(item)} key={item}><i>{String(index + 1).padStart(2, "0")}</i>{item}</button>)}</nav>
      <div className="framework"><label>验收模式</label><strong>自动化准入</strong><p>固定数据、三端构建与业务规则由同一组验收用例持续验证。</p></div>
    </aside>
    <section className="workspace">
      <header><div><label>GLOBAL OPERATIONS</label><h1>{active}</h1></div><div className="actions"><span className="live">● 固定 seed Mock 数据</span><button onClick={toggle} aria-label="切换明暗主题">{dark ? "☀" : "☾"}</button><b>OP</b></div></header>
      <div className="content">{active === "交付看板" ? <DeliveryBoard /> : <Portal section={active} />}</div>
    </section>
  </main>;
}
