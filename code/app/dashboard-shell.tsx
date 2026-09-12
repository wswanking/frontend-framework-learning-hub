"use client";

const frameworkApps = [
  { name: "React", mark: "R", library: "MUI", accent: "#61dafb", href: "/frameworks/react/index.html#/", description: "进入 React 版 IoT Atlas" },
  { name: "Vue", mark: "V", library: "Element Plus", accent: "#42b883", href: "/frameworks/vue/index.html#/", description: "进入 Vue 版 IoT Atlas" },
  { name: "Angular", mark: "A", library: "Angular Material", accent: "#ff4d67", href: "/frameworks/angular/index.html#/", description: "进入 Angular 版 IoT Atlas" },
] as const;

export function DashboardShell() {
  return <main className="launcher">
    <section className="launcher-copy" aria-labelledby="launcher-title">
      <div className="launcher-brand"><b>IA</b><span>IoT Atlas</span></div>
      <p>FRAMEWORK LEARNING HUB</p>
      <h1 id="launcher-title">选择应用</h1>
      <span>同一套 IoT 业务契约，三种框架独立实现。</span>
    </section>
    <nav className="launcher-grid" aria-label="应用入口">
      {frameworkApps.map((app, index) => <a className="launcher-card" href={app.href} key={app.name} style={{ "--entry-accent": app.accent } as React.CSSProperties}>
        <div className="launcher-index">0{index + 1}</div>
        <div className="launcher-mark" aria-hidden="true">{app.mark}</div>
        <div className="launcher-meta"><h2>{app.name}</h2><p>{app.library}</p><span>{app.description}</span></div>
        <i aria-hidden="true">↗</i>
      </a>)}
    </nav>
  </main>;
}
