import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "IoT Atlas", template: "%s · IoT Atlas" },
  description: "React、Vue、Angular 多框架物联网前端学习平台",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
