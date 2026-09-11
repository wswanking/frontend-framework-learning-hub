"use client";

import { useState } from "react";
import { DeliveryBoard } from "./delivery-board";

const navigation = ["数据大盘", "全球节点", "产品中心", "设备管理", "规则引擎", "固件与 OTA", "租户管理", "交付看板"];

export function DashboardShell() {
  const [dark, setDark] = useState(() => typeof window === "undefined" || localStorage.getItem("iot-atlas-theme") !== "light"); const [active, setActive] = useState("交付看板");
  const toggle = () => setDark(value => { localStorage.setItem("iot-atlas-theme", value ? "light" : "dark"); return !value; });
  return <main className={dark ? "app dark" : "app"}><aside className="sidebar"><div className="brand"><b>IA</b><span>IoT Atlas<small>FRAMEWORK LAB</small></span></div><nav aria-label="主导航">{navigation.map((item, index) => <button className={active === item ? "nav active" : "nav"} onClick={() => setActive(item)} key={item}><i>{String(index + 1).padStart(2, "0")}</i>{item}</button>)}</nav><div className="framework"><label>审计策略</label><strong>AI 可创建草稿与证据</strong><p>审核结论、发布与最终验收始终保留给人工。</p></div></aside><section className="workspace"><header><div><label>GLOBAL OPERATIONS</label><h1>{active}</h1></div><div className="actions"><span className="live">● 固定 seed Mock 数据</span><button onClick={toggle} aria-label="切换明暗主题">{dark ? "☀" : "☾"}</button><b>OP</b></div></header><div className="content">{active === "交付看板" ? <DeliveryBoard /> : <section className="panel placeholder"><h2>{active}</h2><p>该业务模块的实现入口保留在独立三框架应用中。返回“交付看板”可查看其需求、任务、Issue、证据与审核状态。</p></section>}</div></section></main>;
}
