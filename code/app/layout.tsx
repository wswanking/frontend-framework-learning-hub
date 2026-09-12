import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "https://iot-atlas-learning-hub.eager-ape-3258.chatgpt.site";
  const image = new URL("/og.png", origin).toString();

  return {
    metadataBase: new URL(origin),
    title: { default: "IoT Atlas", template: "%s · IoT Atlas" },
    description: "React、Vue、Angular 多框架物联网前端学习平台",
    icons: { icon: "/favicon.svg" },
    openGraph: {
      title: "IoT Atlas",
      description: "三框架，同一套 IoT 业务契约",
      type: "website",
      url: origin,
      images: [{ url: image, width: 1200, height: 630, alt: "IoT Atlas 三框架物联网学习中心" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "IoT Atlas",
      description: "三框架，同一套 IoT 业务契约",
      images: [image],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
