import { useWorkspace } from "../context";
import { useActions } from "../actions";
import {
  Button,
  Metrics,
  Note,
  PageHeader,
  Panel,
  Table,
  Tag,
  VLink,
} from "../ui";
export function Rules() {
  const c = useWorkspace(),
    a = useActions();
  return (
    <>
      <PageHeader page="rules">
        <Button kind="primary" onClick={a.createRule}>
          ＋ 创建规则
        </Button>
      </PageHeader>
      <Panel title="阈值规则">
        <Table
          columns={["规则 / ID", "触发条件", "状态", "操作"]}
          rows={c.store.rules.map((r) => [
            <>
              {r.name}
              <small className="mono">{r.id}</small>
            </>,
            `温度 > ${r.threshold} °C`,
            <Tag tone={r.enabled ? "ok" : "warn"}>
              {r.enabled ? "已启用" : "已停用"}
            </Tag>,
            <div className="actions">
              <Button kind="small" onClick={() => a.testRule(r.id)}>
                模拟输入
              </Button>
              <Button
                kind="small"
                onClick={() => {
                  try {
                    c.apply({ type: "toggleRule", id: r.id });
                  } catch (e) {
                    c.notify(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                {r.enabled ? "停用" : "启用"}
              </Button>
            </div>,
          ])}
        />
      </Panel>
      <Panel title="场景联动 · 进阶范围">
        <div className="panel-body">
          <div className="pill-line">
            <Tag tone="info">01 · 设备上报</Tag> →{" "}
            <Tag tone="pending">02 · 温度阈值</Tag> →{" "}
            <Tag tone="warn">03 · 创建告警</Tag> →{" "}
            <Tag tone="ok">04 · 人工处置</Tag>
          </div>
          <p className="muted">
            本轮实现固定流程。多条件编排、抑制窗口、定时调度与自动控制尚未实现。
          </p>
        </div>
      </Panel>
    </>
  );
}
export function Alarms() {
  const c = useWorkspace(),
    s = c.store;
  return (
    <>
      <PageHeader page="alarms" />
      <Metrics
        items={[
          [
            "待确认",
            s.alarms.filter((a) => a.status === "待确认").length,
            "需要分派负责人",
          ],
          [
            "处理中",
            s.alarms.filter((a) => a.status === "已确认").length,
            "跟进现场问题",
          ],
          [
            "已解决",
            s.alarms.filter((a) => a.status === "已解决").length,
            "保留完整时间线",
          ],
          ["处置策略", "人工", "自动关闭待后续设计"],
        ]}
      />
      <Panel title="告警事件">
        <Table
          columns={["告警 / 事件", "设备", "状态", "负责人", "操作"]}
          rows={s.alarms.map((a) => [
            <>
              {a.name}
              <small className="mono">{a.id}</small>
            </>,
            <VLink to={"devices/" + a.device}>{a.device}</VLink>,
            <Tag>{a.status}</Tag>,
            a.owner,
            <Button
              kind="small"
              onClick={() => c.show({ kind: "alarm", id: a.id })}
            >
              查看与处理
            </Button>,
          ])}
        />
      </Panel>
      <Note>
        没有新的告警？前往 <VLink to="rules">规则与场景</VLink>
        ，模拟一次超过阈值的温度输入。
      </Note>
    </>
  );
}
export function Ota() {
  const c = useWorkspace(),
    a = useActions();
  return (
    <>
      <PageHeader page="ota">
        <Button kind="primary" onClick={a.createBatch}>
          ＋ 创建升级批次
        </Button>
      </PageHeader>
      <Panel title="升级批次">
        {c.store.batches.length ? (
          <Table
            columns={["批次 / 固件", "状态", "完成 / 目标", "失败", "操作"]}
            rows={c.store.batches.map((b) => [
              <>
                {b.name}
                <small>ColdSense T200 · {b.version}</small>
              </>,
              <Tag>{b.status}</Tag>,
              `${b.targets.filter((t) => t.status === "成功").length} / ${b.targets.length}`,
              b.targets.filter((t) => t.status === "失败").length,
              <Button
                kind="small"
                onClick={() => c.show({ kind: "ota", id: b.id })}
              >
                查看进度
              </Button>,
            ])}
          />
        ) : (
          <div className="empty">
            <span className="empty-icon">↑</span>
            <h2>尚无升级批次</h2>
            <p>选择固件与兼容设备，先建立可追踪的发布范围。</p>
            <Button kind="primary" onClick={a.createBatch}>
              创建首个批次
            </Button>
          </div>
        )}
      </Panel>
      <Panel title="固件版本目录">
        <Table
          columns={["版本", "适用产品", "大小", "说明", "状态"]}
          rows={c.store.firmwares.map((f) => [
            f.version,
            f.product,
            f.size,
            f.note,
            <Tag tone={f.product === "ColdSense T200" ? "ok" : ""}>
              {f.product === "ColdSense T200" ? "可用于模拟" : "只读规格样例"}
            </Tag>,
          ])}
        />
      </Panel>
    </>
  );
}
