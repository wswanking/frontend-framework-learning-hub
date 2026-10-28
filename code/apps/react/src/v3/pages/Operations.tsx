import { Link } from "react-router-dom";
import { useWorkspace } from "../context";
import { Button, Note, PageHeader, Panel, Table, Tag } from "../ui";
export function Connectors() {
  const c = useWorkspace();
  const test = (protocol: string) => {
    try {
      c.apply({ type: "connection", protocol });
      c.show({
        kind: "info",
        title: "连接测试 · 模拟结果",
        body: (
          <>
            <Note>
              {protocol} 模拟握手成功 · 固定延迟 42 ms。未发起真实网络请求。
            </Note>
            <dl className="kv">
              <dt>协议解析</dt>
              <dd>通过（样例）</dd>
              <dt>凭据</dt>
              <dd>未配置 / 未验证</dd>
              <dt>转发</dt>
              <dd>静态目的地示意</dd>
            </dl>
          </>
        ),
      });
    } catch (e) {
      c.notify(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <>
      <PageHeader page="connectors" />
      <Panel title="协议连接器">
        <Table
          columns={["连接器", "协议 / 节点", "状态", "转发目标", "操作"]}
          rows={[
            [
              "华东 MQTT 接入",
              "MQTT 3.1.1 / TLS",
              <Tag tone="ok">健康</Tag>,
              "HTTP 样例接收端",
              <Button kind="small" onClick={() => test("MQTT")}>
                测试连接
              </Button>,
            ],
            [
              "设备 HTTP 接入",
              "HTTPS / JSON",
              <Tag tone="ok">健康</Tag>,
              "时序与规则",
              <Button kind="small" onClick={() => test("HTTPS")}>
                测试连接
              </Button>,
            ],
          ]}
        />
      </Panel>
      <Panel title="数据转发路径">
        <div className="panel-body">
          <div className="pill-line">
            <Tag tone="info">接入协议</Tag> →{" "}
            <Tag tone="pending">字段规范化</Tag> →{" "}
            <Tag tone="ok">规则与时序</Tag> → <Tag tone="warn">演示目的地</Tag>
          </div>
          <p>
            目标：<code>https://receiver.example.invalid/events</code>
          </p>
          <Note>
            固定成功结果并写入审计，不发起外部请求。凭据管理、重试退避、死信队列与证书轮换尚未实现。
          </Note>
        </div>
      </Panel>
    </>
  );
}
export function Nodes() {
  const c = useWorkspace();
  return (
    <>
      <PageHeader page="nodes" />
      <div className="map-grid">
        {[
          ["华东 · 上海", "99.98%", "5 个演示连接"],
          ["欧洲 · 法兰克福", "99.95%", "拓展节点示意"],
          ["北美 · 弗吉尼亚", "99.97%", "拓展节点示意"],
        ].map(([name, health, count]) => (
          <section className="panel map-tile" key={name}>
            <h3>{name}</h3>
            <Tag tone="ok">健康</Tag>
            <div className="metric-value">{health}</div>
            <p className="muted">模拟可用率 · {count}</p>
            <Button
              kind="small"
              onClick={() =>
                c.show({
                  kind: "info",
                  title: name,
                  body: (
                    <>
                      <dl className="kv">
                        <dt>节点状态</dt>
                        <dd>健康</dd>
                        <dt>实例类型</dt>
                        <dd>共享模拟接入节点</dd>
                        <dt>可用率窗口</dt>
                        <dd>固定演示指标，非实时监控</dd>
                      </dl>
                      <Note>真实地域调度与地理拓扑不在本轮实现范围内。</Note>
                    </>
                  ),
                })
              }
            >
              查看节点
            </Button>
          </section>
        ))}
      </div>
      <Note>
        地理拓扑以节点列表先行；真实地域筛选、节点下钻与地图交互需独立设计验证。
      </Note>
    </>
  );
}
export function Learning() {
  return (
    <>
      <PageHeader page="learning" />
      <Panel title="三端独立实现映射">
        <Table
          columns={["层次", "React", "Vue", "Angular"]}
          rows={[
            ["持久工作区", "Router / Outlet", "RouterView", "RouterOutlet"],
            [
              "表单草稿",
              "页面 hook + blocker",
              "composable + guard",
              "Reactive Forms + guard",
            ],
            ["页面状态", "Context / hooks", "composable", "signals / service"],
            ["领域与 Mock", "本端 domain.ts", "本端独立模型", "本端独立模型"],
            [
              "独立验证",
              "本端 unit / Playwright",
              "本端 unit / Playwright",
              "本端 unit / Playwright",
            ],
          ]}
        />
      </Panel>
      <Panel title="教学与交付门槛">
        <div className="panel-body">
          <p>
            React
            源码：src/v3/Shell.tsx、pages/、WorkspaceDialog.tsx、domain.ts。完整中文源码导航见仓库
            docs/learning/react.md。
          </p>
          <ol>
            <li>按已批准交互实现，当前仅为本地模拟。</li>
            <li>三端分别独立验证，不共享运行时代码或依赖。</li>
            <li>自动检查不代替人工视觉验收、合并或部署授权。</li>
          </ol>
          <div className="actions">
            <Link to="/diagnostics">旧诊断示例</Link>
            <Link to="/labs">组件实验室</Link>
            <Link to="/delivery">交付治理示例</Link>
          </div>
          <Note>
            旧业务 URL
            是教学兼容区。本页面不执行真实发布，不代表生产能力已完成。
          </Note>
        </div>
      </Panel>
    </>
  );
}
