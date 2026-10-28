import { useWorkspace } from "../context";
import { useActions } from "../actions";
import {
  Button,
  Header,
  Metrics,
  Panel,
  Table,
  Tag,
  Trend,
  VLink,
  descriptions,
} from "../ui";
export function Workspace() {
  const { store: s } = useWorkspace(),
    a = useActions(),
    online = s.devices.filter((d) => d.status === "在线").length,
    open = s.alarms.filter((a) => a.status !== "已解决").length;
  return (
    <>
      <div className="breadcrumb">运行视图 / WORKSPACE</div>
      <Header
        title="早上好，开始今天的运行巡检"
        description={descriptions.workspace}
      >
        <Button kind="primary" onClick={a.register}>
          ＋ 注册设备
        </Button>
      </Header>
      <Metrics
        items={[
          [
            "设备总数",
            s.devices.length,
            `${online} 台在线 · ${s.devices.length - online} 台待处理`,
          ],
          ["待处理告警", open, "需要确认或跟进的异常"],
          ["接收消息", "8,420", "本窗口 · 99.86% 成功率"],
          [
            "进行中升级",
            s.batches.filter((b) => b.status !== "完成").length,
            "按批次追踪 · 可恢复失败",
          ],
        ]}
      />
      <div className="grid">
        <Panel
          title="消息流量"
          aside={
            <div className="legend">
              <span>● 接收消息</span>
              <span>┄ 转发消息</span>
            </div>
          }
        >
          <Trend />
        </Panel>
        <Panel title="待办队列">
          <div className="work-item">
            <span className="work-icon">!</span>
            <div>
              <h3>{open} 条告警等待处置</h3>
              <p>优先检查冷链设备温度与连接状态</p>
            </div>
            <VLink className="end" to="alarms">
              处理 →
            </VLink>
          </div>
          <div className="work-item">
            <span className="work-icon blue">↑</span>
            <div>
              <h3>ColdSense 2.3.1 可发布</h3>
              <p>建议先升级少量设备，观察失败原因</p>
            </div>
            <VLink className="end" to="ota">
              查看 →
            </VLink>
          </div>
          <div className="work-item">
            <span className="work-icon green">◇</span>
            <div>
              <h3>工作区配额健康</h3>
              <p>
                {s.devices.length} / {s.quota} 台设备 ·{" "}
                {s.devices.length >= s.quota ? "已达配额" : "无容量告警"}
              </p>
            </div>
            <VLink className="end" to="tenants">
              管理 →
            </VLink>
          </div>
        </Panel>
      </div>
      <Panel title="重点设备" aside={<VLink to="devices">所有设备 →</VLink>}>
        <Table
          columns={["设备 / 标识", "状态", "产品", "最新读数", "操作"]}
          rows={s.devices.slice(0, 4).map((d) => [
            <VLink to={"devices/" + d.id}>
              <strong>{d.name}</strong>
              <small className="mono">{d.id}</small>
            </VLink>,
            <Tag>{d.status}</Tag>,
            d.product,
            d.product === "EnergyLink M1"
              ? `${d.power?.toLocaleString("en-US")} W`
              : `${d.temp} °C`,
            <VLink to={"devices/" + d.id}>进入详情 →</VLink>,
          ])}
        />
      </Panel>
      <div className="grid equal">
        <Panel
          title="连接健康"
          aside={<VLink to="connectors">连接与转发 →</VLink>}
        >
          <div className="panel-body">
            <dl className="kv">
              <dt>MQTT / TLS</dt>
              <dd>
                <Tag tone="ok">健康</Tag> 华东接入节点
              </dd>
              <dt>数据转发</dt>
              <dd>
                <Tag>运行中</Tag> HTTP 演示目标
              </dd>
              <dt>数据时效</dt>
              <dd>固定样例，不连接真实网络</dd>
            </dl>
          </div>
        </Panel>
        <Panel title="最近操作" aside={<VLink to="audit">完整审计 →</VLink>}>
          <div className="panel-body">
            <ul className="timeline">
              {s.audit.slice(0, 2).map((e) => (
                <li key={e.id}>
                  {e.action}
                  <small>
                    {e.time} · {e.actor} · {e.object}
                  </small>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
    </>
  );
}
