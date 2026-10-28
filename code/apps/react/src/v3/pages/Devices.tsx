import { useEffect, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useWorkspace } from "../context";
import { useActions } from "../actions";
import { samples } from "../domain";
import {
  Button,
  Header,
  Metrics,
  Note,
  PageHeader,
  Panel,
  Table,
  Tag,
  Trend,
  VLink,
} from "../ui";
export function Devices() {
  const c = useWorkspace(),
    s = c.store,
    a = useActions(),
    [query, setQuery] = useSearchParams(),
    location = useLocation();
  const [draft, setDraft] = useState(query.get("q") ?? ""),
    [status, setStatus] = useState(query.get("status") ?? ""),
    [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    setDraft(query.get("q") ?? "");
    setStatus(query.get("status") ?? "");
    setSelected([]);
  }, [query]);
  useEffect(() => {
    setSelected((ids) =>
      ids.filter((id) => s.devices.some((d) => d.id === id)),
    );
  }, [s.devices]);
  useEffect(() => {
    const id = (location.state as { focusDevice?: string } | null)?.focusDevice;
    if (id) {
      const frame = requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`[data-device-link="${CSS.escape(id)}"]`)
          ?.focus(),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [location.state]);
  const q = (query.get("q") ?? "").toLowerCase(),
    st = query.get("status");
  const rows = s.devices.filter(
    (d) =>
      (!q ||
        [d.name, d.id, d.serial, d.group, d.tags]
          .join(" ")
          .toLowerCase()
          .includes(q)) &&
      (!st || d.status === st),
  );
  const detail = (id: string) =>
    "devices/" +
    id +
    "?back=" +
    encodeURIComponent("/v3/devices" + location.search);
  return (
    <>
      <PageHeader page="devices">
        <Button kind="primary" onClick={a.register}>
          ＋ 注册设备
        </Button>
      </PageHeader>
      <section className="panel">
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            const p = new URLSearchParams();
            if (draft.trim()) p.set("q", draft.trim());
            if (status) p.set("status", status);
            setQuery(p);
          }}
        >
          <label>
            搜索名称、ID、分组或标签
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="例如：冷链、DEV-1001"
            />
          </label>
          <label>
            连接状态
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">全部状态</option>
              {["在线", "离线", "待接入"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button className="primary">应用</button>
          <Button
            onClick={() => {
              setQuery({});
              setDraft("");
              setStatus("");
            }}
          >
            清除
          </Button>
        </form>
        {selected.length > 0 && (
          <div className="bulk show">
            <strong>已选择 {selected.length} 台</strong>
            <Button
              kind="small danger"
              onClick={() => a.deleteDevices(selected)}
            >
              删除所选
            </Button>
            <span className="muted">删除不可撤销，将显示影响范围</span>
          </div>
        )}
        <Table
          columns={[
            <input
              type="checkbox"
              className="checkbox"
              aria-label="选择当前结果全部设备"
              checked={
                rows.length > 0 && rows.every((d) => selected.includes(d.id))
              }
              onChange={(e) =>
                setSelected(e.target.checked ? rows.map((d) => d.id) : [])
              }
            />,
            "设备 / 序列号",
            "状态",
            "产品",
            "分组 / 标签",
            "固件",
            "操作",
          ]}
          rows={rows.map((d) => [
            <input
              type="checkbox"
              className="checkbox"
              aria-label={"选择 " + d.name}
              checked={selected.includes(d.id)}
              onChange={(e) =>
                setSelected((ids) =>
                  e.target.checked
                    ? [...ids, d.id]
                    : ids.filter((id) => id !== d.id),
                )
              }
            />,
            <VLink to={detail(d.id)} data-device-link={d.id}>
              <strong>{d.name}</strong>
              <small className="mono">{d.serial}</small>
            </VLink>,
            <Tag>{d.status}</Tag>,
            d.product,
            <>
              {d.group}
              <small>{d.tags}</small>
            </>,
            <span className="mono">{d.version}</span>,
            <VLink to={detail(d.id)}>查看 →</VLink>,
          ])}
          footer={
            <>
              <span>
                显示 {rows.length} / {s.devices.length} 台设备 ·
                演示数据全部展示
              </span>
              <span>筛选条件保存在地址中</span>
            </>
          }
        />
      </section>
      <Note>
        从设备详情可模拟接入上报、查看影子差异、执行命令与诊断。没有真实设备或密钥。
      </Note>
    </>
  );
}
export function DeviceDetail() {
  const c = useWorkspace(),
    a = useActions(),
    { id } = useParams(),
    [query] = useSearchParams(),
    navigate = useNavigate(),
    d = c.store.devices.find((d) => d.id === id);
  const back = query.get("back")?.startsWith("/v3/devices")
    ? query.get("back")!
    : "/v3/devices";
  if (!d)
    return (
      <>
        <Header
          title="设备不可用"
          description="该对象不存在或已在本地演示中删除。"
        />
        <VLink to="devices">返回设备列表</VLink>
      </>
    );
  const tab = query.get("tab") ?? "overview";
  const run = (command: Parameters<typeof c.apply>[0]) => {
    try {
      c.apply(command);
    } catch (e) {
      c.notify(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <>
      <div className="breadcrumb">
        <VLink to={back}>设备中心</VLink> / {d.id}
      </div>
      <Header
        title={d.name}
        description={
          <>
            <Tag>{d.status}</Tag> <span className="mono">{d.id}</span> ·{" "}
            {d.product}
          </>
        }
      >
        <Button
          onClick={() => navigate(back, { state: { focusDevice: d.id } })}
        >
          返回列表
        </Button>
        <Button onClick={() => a.editDevice(d)}>编辑资料</Button>
        {d.product === "ColdSense T200" && (
          <Button
            kind="primary"
            onClick={() => run({ type: "ingest", id: d.id })}
          >
            模拟上报
          </Button>
        )}
      </Header>
      {d.product === "EnergyLink M1" ? (
        <Panel title="电表属性样例">
          <div className="panel-body">
            <dl className="kv">
              <dt>energy / 累计电量</dt>
              <dd>{d.energy} kWh</dd>
              <dt>power / 当前功率</dt>
              <dd>{d.power} W</dd>
              <dt>固件</dt>
              <dd>{d.version}</dd>
              <dt>分组</dt>
              <dd>{d.group}</dd>
            </dl>
            <Note>
              电表仅展示能耗规格与元数据，不提供温控上报、时序、影子、命令或
              OTA；其独立交互待设计。
            </Note>
          </div>
        </Panel>
      ) : (
        <>
          <div className="tabs">
            {[
              ["overview", "运行概览"],
              ["telemetry", "时序数据"],
              ["shadow", "设备影子"],
              ["commands", "远程命令"],
              ["logs", "诊断日志"],
            ].map(([key, label]) => (
              <VLink
                key={key}
                className={key === tab ? "active" : ""}
                to={
                  "devices/" +
                  d.id +
                  "?" +
                  new URLSearchParams({ tab: key, back })
                }
              >
                {label}
              </VLink>
            ))}
          </div>
          <div className="details-content">
            {tab === "overview" ? (
              <div className="grid">
                <Panel title="运行指标">
                  <Metrics
                    items={[
                      ["温度", d.temp + "°", "最新模拟读数"],
                      ["上报次数", d.events.length, "本地事件"],
                      ["目标温度", d.desired + "°", "设备影子 desired"],
                      ["连接状态", d.status, "模拟接入"],
                    ]}
                  />
                  <Trend telemetry />
                </Panel>
                <Panel title="设备档案">
                  <div className="panel-body">
                    <dl className="kv">
                      <dt>序列号</dt>
                      <dd className="mono">{d.serial}</dd>
                      <dt>所属分组</dt>
                      <dd>{d.group}</dd>
                      <dt>标签</dt>
                      <dd>{d.tags}</dd>
                      <dt>固件版本</dt>
                      <dd>{d.version}</dd>
                      <dt>接入身份</dt>
                      <dd>DEMO-{d.id}（非密钥）</dd>
                    </dl>
                    <Note>
                      {d.status === "待接入"
                        ? "设备已注册，尚未上报。点击“模拟上报”完成接入。"
                        : "上报按钮会追加一个确定性读数和诊断事件。"}
                    </Note>
                  </div>
                </Panel>
              </div>
            ) : tab === "telemetry" ? (
              <Panel title="最新采样">
                <Trend telemetry />
                <Table
                  columns={["采样时间", "温度", "数据质量"]}
                  rows={samples(c.store, d.id, null).map(([t, v]) => [
                    t,
                    v + " °C",
                    <Tag tone="ok">有效</Tag>,
                  ])}
                />
              </Panel>
            ) : tab === "shadow" ? (
              <Panel title="期望与上报状态">
                <div className="panel-body">
                  <dl className="kv">
                    <dt>desired.targetTemp</dt>
                    <dd>{d.desired} °C</dd>
                    <dt>reported.targetTemp</dt>
                    <dd>{d.reported} °C</dd>
                    <dt>差异</dt>
                    <dd>
                      <Tag tone={d.desired === d.reported ? "ok" : "warn"}>
                        {d.desired === d.reported ? "已同步" : "待同步"}
                      </Tag>
                    </dd>
                  </dl>
                  <div className="actions spaced">
                    <Button onClick={() => a.shadow(d)}>编辑目标温度</Button>
                    <Button
                      kind="primary"
                      onClick={() => run({ type: "sync", id: d.id })}
                    >
                      模拟设备同步
                    </Button>
                  </div>
                  <p className="muted">
                    离线设备不可同步；需要先模拟上报恢复在线。
                  </p>
                </div>
              </Panel>
            ) : tab === "commands" ? (
              <Panel title="可执行命令">
                <div className="panel-body">
                  <h3>重启设备 / reboot</h3>
                  <p>
                    会短暂中断连接。需要设备在线与控制权限，确认后记录模拟回执。
                  </p>
                  <Button kind="danger" onClick={() => a.reboot(d)}>
                    发送重启命令
                  </Button>
                  <Note>
                    仅演示确认与成功回执。真实超时、取消与幂等契约待后续细化。
                  </Note>
                </div>
              </Panel>
            ) : tab === "logs" ? (
              <Panel title="诊断事件">
                <Table
                  columns={["序号", "事件", "来源"]}
                  rows={d.events
                    .slice()
                    .reverse()
                    .map((line, i) => [d.events.length - i, line, "本地模拟"])}
                />
              </Panel>
            ) : (
              <div className="panel empty">
                <h2>未知详情页签</h2>
                <VLink to={"devices/" + d.id}>返回运行概览</VLink>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
