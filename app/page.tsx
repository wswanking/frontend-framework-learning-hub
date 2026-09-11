import type { Metadata } from "next";
import { DashboardShell } from "./dashboard-shell";

export const metadata: Metadata = {
  title: "IoT Atlas · 前端框架学习中心",
  description: "使用 React、Vue 与 Angular 实现同一套物联网管理平台。",
};

export default function Home() { return <DashboardShell />; }
