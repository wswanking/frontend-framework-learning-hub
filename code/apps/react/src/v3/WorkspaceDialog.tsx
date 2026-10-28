import { useEffect, useRef, useState } from "react";
import { useWorkspace, type Field, type ModalSpec } from "./context";
import { useActions } from "./actions";
import { Button, Note, Table, Tag, VLink, pageNames } from "./ui";
export function WorkspaceDialog({ spec }: { spec: ModalSpec }) {
  const c = useWorkspace(),
    a = useActions(),
    s = c.store,
    ref = useRef<HTMLDialogElement>(null),
    busy = useRef(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    dialog
      .querySelector<HTMLElement>(
        'input:not([type="checkbox"]),select,textarea',
      )
      ?.focus();
    return () => dialog.close();
  }, []);
  const product =
      spec.kind === "product" ? s.products.find((p) => p.id === spec.id) : null,
    alarm =
      spec.kind === "alarm" ? s.alarms.find((a) => a.id === spec.id) : null,
    batch =
      spec.kind === "ota" ? s.batches.find((b) => b.id === spec.id) : null;
  const title =
    spec.kind === "form" || spec.kind === "info"
      ? spec.title
      : spec.kind === "search"
        ? "搜索工作区"
        : spec.kind === "notifications"
          ? "通知中心"
          : spec.kind === "reset"
            ? "重置本地演示"
            : product
              ? product.name + " · 物模型"
              : alarm
                ? "告警详情"
                : batch
                  ? batch.name
                  : "对象不可用";
  const drawer = ["product", "alarm", "ota", "notifications"].includes(
    spec.kind,
  );
  const command = (fn: () => void) => {
    try {
      fn();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const closeLink = () => c.close(true);
  const results = [
    ...Object.entries(pageNames).map(([path, name]) => ({ path, name })),
    ...s.devices.map((d) => ({
      path: "devices/" + d.id,
      name: d.name + " · " + d.id,
    })),
    ...s.rules.map((r) => ({ path: "rules", name: r.name + " · " + r.id })),
  ].filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <dialog
      ref={ref}
      className={"modal" + (drawer ? " drawer" : "")}
      aria-labelledby="v3-modal-title"
      onCancel={(e) => {
        e.preventDefault();
        c.close();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const nodes = Array.from(
          ref.current!.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
          ),
        ).filter((n) => n.getClientRects().length);
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (spec.kind !== "form" || busy.current) return;
          busy.current = true;
          try {
            const next = c.apply(spec.command(new FormData(e.currentTarget)));
            c.close(true);
            spec.after?.(next);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            busy.current = false;
          }
        }}
        onChange={() => {
          if (spec.kind === "form") c.setDirty(true);
        }}
      >
        <div className="modal-head">
          <h2 id="v3-modal-title">{title}</h2>
          <button
            type="button"
            className="icon"
            aria-label="关闭对话框"
            onClick={() => c.close()}
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          {spec.kind === "form" && (
            <>
              {spec.note}
              {spec.fields.map((f) => (
                <Input field={f} key={f.name} />
              ))}
            </>
          )}
          {spec.kind === "info" && spec.body}
          {product && (
            <>
              <p>{product.protocol} · 属性规格</p>
              <Table
                columns={["标识符", "类型", "单位"]}
                rows={product.fields.map((f) => [
                  <code>{f.name}</code>,
                  f.type,
                  f.unit || "—",
                ])}
              />
              <div className="actions spaced">
                <Button kind="primary" onClick={() => a.attribute(product.id)}>
                  新增属性
                </Button>
              </div>
              <Note>属性新增仅修改当前本地物模型，不执行真实版本发布。</Note>
            </>
          )}
          {alarm && (
            <>
              <div className="pill-line">
                <Tag>{alarm.status}</Tag>
                <span className="mono">{alarm.id}</span>
              </div>
              <p>{alarm.note}</p>
              <dl className="kv">
                <dt>设备</dt>
                <dd>
                  <span onClick={closeLink}>
                    <VLink to={"devices/" + alarm.device}>{alarm.device}</VLink>
                  </span>
                </dd>
                <dt>负责人</dt>
                <dd>{alarm.owner}</dd>
              </dl>
              <h3>处置时间线</h3>
              <ul className="timeline">
                {alarm.history.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              {alarm.status === "待确认" ? (
                <Button kind="primary" onClick={() => a.ack(alarm.id)}>
                  确认并分派
                </Button>
              ) : alarm.status === "已确认" ? (
                <Button kind="primary" onClick={() => a.resolve(alarm.id)}>
                  解决告警
                </Button>
              ) : (
                <p>此事件已解决，记录保留供审计。</p>
              )}
            </>
          )}
          {batch && (
            <>
              <div className="pill-line">
                <Tag>{batch.status}</Tag>
                <span className="mono">{batch.id}</span>
              </div>
              <p>
                固件 {batch.version} · 已确认 {batch.targets.length} 台设备
              </p>
              <strong>
                {batch.targets.filter((t) => t.status === "成功").length} /{" "}
                {batch.targets.length} 完成
              </strong>
              <div className="progress">
                <span
                  style={{
                    width:
                      (batch.targets.filter((t) => t.status === "成功").length /
                        batch.targets.length) *
                        100 +
                      "%",
                  }}
                />
              </div>
              <Table
                columns={["设备", "结果 / 原因", "尝试"]}
                rows={batch.targets.map((t) => [
                  t.device,
                  <>
                    <Tag>{t.status}</Tag>
                    <small>{t.reason}</small>
                  </>,
                  t.attempts,
                ])}
              />
              <div className="actions spaced">
                {["待执行", "运行中", "重试中"].includes(batch.status) ? (
                  <Button
                    kind="primary"
                    onClick={() =>
                      command(() => {
                        c.apply({ type: "advance", id: batch.id });
                      })
                    }
                  >
                    {batch.status === "待执行"
                      ? "开始模拟升级"
                      : "推进模拟进度"}
                  </Button>
                ) : batch.status === "部分失败" ? (
                  <Button kind="primary" onClick={() => a.retry(batch.id)}>
                    仅重试失败设备
                  </Button>
                ) : null}
              </div>
              <h3>执行记录</h3>
              <ul className="timeline">
                {batch.history.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              <Note>
                进度由操作者显式推进，不代表后台任务；成功设备不重复重试。
              </Note>
            </>
          )}
          {spec.kind === "search" && (
            <>
              <label className="field">
                搜索页面、设备或规则
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="名称或 ID"
                />
              </label>
              <div className="search-results">
                {results.length ? (
                  results.map((r, i) => (
                    <div key={r.path + i} onClick={closeLink}>
                      <VLink to={r.path}>{r.name}</VLink>
                    </div>
                  ))
                ) : (
                  <p>没有搜索结果，请调整关键词。</p>
                )}
              </div>
            </>
          )}
          {spec.kind === "notifications" &&
            (s.prefs.inapp ? (
              <>
                <div className="work-item">
                  <div>
                    <h3>现场异常需要处理</h3>
                    <p>
                      {s.alarms.filter((a) => a.status !== "已解决").length}{" "}
                      条未关闭告警
                    </p>
                    <span onClick={closeLink}>
                      <VLink to="alarms">前往告警中心 →</VLink>
                    </span>
                  </div>
                </div>
                <div className="work-item">
                  <div>
                    <h3>新固件已加入演示目录</h3>
                    <p>ColdSense T200 · 2.3.1</p>
                    <span onClick={closeLink}>
                      <VLink to="ota">查看固件与 OTA →</VLink>
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p>
                工作区通知已关闭。
                <span onClick={closeLink}>
                  <VLink to="settings">前往设置</VLink>
                </span>
              </p>
            ))}
          {spec.kind === "reset" && (
            <>
              <Note warn>
                恢复初始设备、规则、告警、成员与配额，删除本端 V3
                的所有本地修改。不会影响旧教学 Mock 或其他框架。
              </Note>
              <div className="actions spaced">
                <Button kind="danger" onClick={c.reset}>
                  确认重置
                </Button>
                <Button onClick={() => c.close()}>取消</Button>
              </div>
            </>
          )}
          {error && (
            <p className="text-error" role="alert">
              {error}
            </p>
          )}
        </div>
        {spec.kind === "form" && (
          <div className="modal-foot">
            <Button onClick={() => c.close()}>取消</Button>
            <button className="primary" type="submit">
              {spec.label ?? "保存"}
            </button>
          </div>
        )}
      </form>
    </dialog>
  );
}
function Input({ field: f }: { field: Field }) {
  if (f.type === "checks")
    return (
      <fieldset>
        <legend>{f.label}</legend>
        {f.options?.map((o) => (
          <label className="field" key={o.value}>
            <span>
              <input
                type="checkbox"
                name={f.name}
                value={o.value}
                disabled={o.disabled}
                defaultChecked={o.checked}
              />{" "}
              {o.label}
            </span>
          </label>
        ))}
      </fieldset>
    );
  const props = { name: f.name, defaultValue: f.value, required: f.required };
  return (
    <label className="field">
      {f.label}
      {f.required ? " *" : ""}
      {f.type === "select" ? (
        <select {...props}>
          {f.options?.map((o) => (
            <option value={o.value} key={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      ) : f.type === "textarea" ? (
        <textarea {...props} rows={3} maxLength={f.maxLength ?? 300} />
      ) : (
        <input
          {...props}
          type={f.type ?? "text"}
          min={f.min}
          max={f.max}
          step={f.step}
          pattern={f.pattern}
          maxLength={f.maxLength}
        />
      )}
    </label>
  );
}
