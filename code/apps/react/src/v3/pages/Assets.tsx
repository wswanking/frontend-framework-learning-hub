import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../context";
import { samples } from "../domain";
import { Button, Note, PageHeader, Panel, Table, Tag, Trend } from "../ui";
export function Products() {
  const c = useWorkspace();
  return (
    <>
      <PageHeader page="products" />
      <Panel title="产品目录">
        <Table
          columns={["产品 / ID", "接入协议", "物模型属性", "设备数", "操作"]}
          rows={c.store.products.map((p) => [
            <>
              {p.name}
              <small className="mono">{p.id}</small>
            </>,
            p.protocol,
            p.fields.length,
            c.store.devices.filter((d) => d.product === p.name).length,
            <Button
              kind="small"
              onClick={() => c.show({ kind: "product", id: p.id })}
            >
              查看物模型
            </Button>,
          ])}
        />
      </Panel>
      <Note>
        支持属性规格查看与新增。物模型版本发布、DP
        映射校验、导入导出属于进阶范围，未伪装为可执行发布。
      </Note>
    </>
  );
}
export function Telemetry() {
  const c = useWorkspace(),
    [query, setQuery] = useSearchParams(),
    devices = c.store.devices.filter((d) => d.product === "ColdSense T200"),
    firstDevice = devices[0]?.id;
  const [device, setDevice] = useState(
      query.get("device") ?? firstDevice ?? "",
    ),
    [window, setWindow] = useState(query.get("window") ?? "45");
  useEffect(() => {
    setDevice(query.get("device") ?? firstDevice ?? "");
    setWindow(query.get("window") ?? "45");
  }, [query, firstDevice]);
  const rows = samples(c.store, query.get("device"), query.get("window"));
  function download() {
    const csv =
        "\ufeff时间,温度°C,质量\n" +
        rows.map(([t, v]) => `${t},${v},有效`).join("\n"),
      url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
    const a = document.createElement("a");
    a.href = url;
    a.download = "iot-atlas-react-demo-telemetry.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    c.notify("已导出当前已应用查询（本地模拟）。");
  }
  return (
    <>
      <PageHeader page="telemetry">
        <Button onClick={download}>导出 CSV</Button>
      </PageHeader>
      <p className="muted">
        当前查询范围：ColdSense T200 温控设备。电表时序交互待设计。
      </p>
      <section className="panel">
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery({ device, window });
          }}
        >
          <label>
            设备
            <select value={device} onChange={(e) => setDevice(e.target.value)}>
              {devices.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            查询窗口
            <select value={window} onChange={(e) => setWindow(e.target.value)}>
              <option value="45">08:00—08:45</option>
              <option value="15">08:30—08:45</option>
            </select>
          </label>
          <button className="primary">查询</button>
        </form>
        <Trend telemetry />
        <Table
          columns={["采样时间", "温度 °C", "质量"]}
          rows={rows.map(([t, v]) => [t, v, <Tag tone="ok">有效</Tag>])}
        />
      </section>
    </>
  );
}
