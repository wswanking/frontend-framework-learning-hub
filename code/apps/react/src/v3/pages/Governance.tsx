import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../context";
import { useActions } from "../actions";
import { Button, Note, PageHeader, Panel, Table, Tag } from "../ui";
export function Tenants() {
  const c = useWorkspace(),
    a = useActions(),
    s = c.store;
  return (
    <>
      <PageHeader page="tenants">
        <Button kind="primary" onClick={a.invite}>
          ＋ 邀请成员
        </Button>
      </PageHeader>
      <div className="grid">
        <Panel title="工作区成员">
          <Table
            columns={["姓名 / 邮箱", "角色", "状态", "操作"]}
            rows={s.members.map((m) => [
              <>
                {m.name}
                <small>{m.email}</small>
              </>,
              m.role,
              <Tag>{m.status}</Tag>,
              m.role === "平台管理员" ? (
                <span className="muted">固定演示身份</span>
              ) : (
                <Button kind="small" onClick={() => a.memberRole(m.id)}>
                  分配角色
                </Button>
              ),
            ])}
          />
        </Panel>
        <Panel title="租户配额">
          <div className="panel-body">
            <h3>澄海智联 / CHENGHAI-DEMO</h3>
            <p className="muted">设备额度</p>
            <strong>
              {s.devices.length} / {s.quota}
            </strong>
            <div className="progress">
              <span
                style={{
                  width: Math.max(3, (s.devices.length / s.quota) * 100) + "%",
                }}
              />
            </div>
            <p>实际使用量不能超过已配置配额。</p>
            <Button onClick={a.quota}>调整设备配额</Button>
            <Note>
              示例邀请只保存本地记录，不发送邮件。权限变更不代表真实 IAM 授权。
            </Note>
          </div>
        </Panel>
      </div>
    </>
  );
}
export function Access() {
  const c = useWorkspace();
  return (
    <>
      <PageHeader page="access" />
      <Panel title="现有领域权限契约">
        <div className="permission-table">
          <Table
            columns={[
              "能力",
              "平台管理员",
              "租户管理员",
              "运维工程师",
              "数据观察员",
            ]}
            rows={[
              ["查看设备 / 数据", "允许", "本租户", "本租户", "本租户"],
              [
                "产品 / 设备元数据 / 规则",
                "允许",
                "允许",
                "只读 / 试运行",
                "只读",
              ],
              ["设备控制 / 告警处置", "允许", "允许", "允许", "禁止"],
              ["固件 / 创建 OTA / 首次推进", "允许", "允许", "禁止", "禁止"],
              ["重试 OTA / 重试推进", "允许", "允许", "允许", "禁止"],
              ["成员 / 配额修改", "允许", "禁止", "禁止", "禁止"],
            ]}
          />
        </div>
        <div className="panel-body">
          <Note>
            切换右上角“模拟身份”验证权限拒绝。前端权限演示不能替代后端鉴权。自定义角色编辑未实现。
          </Note>
          <Button kind="primary" onClick={() => c.setRole("viewer")}>
            以观察员体验
          </Button>
        </div>
      </Panel>
    </>
  );
}
export function Audit() {
  const c = useWorkspace(),
    [query, setQuery] = useSearchParams(),
    [draft, setDraft] = useState(query.get("q") ?? "");
  useEffect(() => setDraft(query.get("q") ?? ""), [query]);
  const q = query.get("q") ?? "";
  return (
    <>
      <PageHeader page="audit" />
      <Panel title="操作日志">
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(draft ? { q: draft } : {});
          }}
        >
          <label>
            搜索操作或对象
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="例如：注册、升级、配额"
            />
          </label>
          <button className="primary">筛选</button>
          <Button
            onClick={() => {
              setQuery({});
              setDraft("");
            }}
          >
            清除
          </Button>
        </form>
        <Table
          columns={["时间", "身份", "操作", "对象"]}
          rows={c.store.audit
            .filter((a) => `${a.action} ${a.object}`.includes(q))
            .map((a) => [a.time, a.actor, a.action, a.object])}
        />
      </Panel>
      <Note>
        可重置的本地操作日志，不是不可篡改审计。生产留存、导出权限、敏感字段脱敏与后端完整性待另行设计。
      </Note>
    </>
  );
}
export function Settings() {
  const c = useWorkspace(),
    [prefs, setPrefs] = useState(c.store.prefs),
    [error, setError] = useState("");
  useEffect(() => setPrefs(c.store.prefs), [c.store.prefs]);
  return (
    <>
      <PageHeader page="settings" />
      <div className="grid equal">
        <Panel title="通知偏好">
          <form
            className="panel-body"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                c.apply({ type: "prefs", ...prefs });
                c.setDirty(false);
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            <label className="field">
              <span>
                <input
                  type="checkbox"
                  checked={prefs.inapp}
                  onChange={(e) => {
                    setPrefs((p) => ({ ...p, inapp: e.target.checked }));
                    c.setDirty(true);
                  }}
                />{" "}
                工作区内显示通知条目
              </span>
            </label>
            <label className="field">
              <span>
                <input
                  type="checkbox"
                  checked={prefs.email}
                  onChange={(e) => {
                    setPrefs((p) => ({ ...p, email: e.target.checked }));
                    c.setDirty(true);
                  }}
                />{" "}
                邮件摘要偏好（仅保存意向）
              </span>
            </label>
            <p className="muted">不发送邮件；通知中心遵循站内通知开关。</p>
            <button className="primary">保存偏好</button>
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
          </form>
        </Panel>
        <Panel title="集成能力边界">
          <div className="panel-body">
            <dl className="kv">
              <dt>Webhook / 邮件</dt>
              <dd>
                <Tag tone="pending">待设计</Tag>
              </dd>
              <dt>身份 SSO</dt>
              <dd>
                <Tag>本轮范围外</Tag>
              </dd>
              <dt>真实设备</dt>
              <dd>未连接</dd>
              <dt>存储位置</dt>
              <dd>当前浏览器 localStorage</dd>
            </dl>
            <Note>无需密钥、账户或真实设备；仅用于本地模拟与教学。</Note>
          </div>
        </Panel>
      </div>
    </>
  );
}
