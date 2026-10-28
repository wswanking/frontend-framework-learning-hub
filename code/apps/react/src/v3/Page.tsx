import { useWorkspace } from "./context";
import { permits } from "./domain";
import { Button, Header, PageHeader, VLink, pageNames } from "./ui";
import { Workspace } from "./pages/Workspace";
import { Devices, DeviceDetail } from "./pages/Devices";
import { Products, Telemetry } from "./pages/Assets";
import { Rules, Alarms, Ota } from "./pages/Automation";
import { Tenants, Access, Audit, Settings } from "./pages/Governance";
import { Nodes, Connectors, Learning } from "./pages/Operations";
export function V3Page({
  section,
  detail = false,
}: {
  section: string;
  detail?: boolean;
}) {
  const c = useWorkspace();
  if (!pageNames[section])
    return (
      <>
        <Header title="页面不存在" description="这个地址不属于当前工作区。" />
        <div className="panel empty">
          <VLink to="workspace">返回工作区</VLink>
        </div>
      </>
    );
  if (
    ["tenants", "access"].includes(section) &&
    !permits(c.store.role, "govern")
  )
    return (
      <>
        <PageHeader page={section} />
        <div className="panel empty">
          <h2>没有治理权限</h2>
          <p>
            仅平台管理员管理成员、角色与配额。其他身份的只读治理细化属于后续范围。
          </p>
          <VLink to="workspace">返回工作区</VLink>
        </div>
      </>
    );
  if (c.scenario !== "normal") {
    const states: Record<string, [string, string, string]> = {
      loading: [
        "正在加载工作区",
        "壳层保持可用。模拟加载不会自行完成，请结束加载。",
        "结束模拟加载",
      ],
      empty: [
        "这里还没有数据",
        "当前为空状态示例，不删除已保存的模拟数据。",
        "返回正常数据",
      ],
      error: [
        "数据暂时不可用",
        "模拟请求失败 DEMO_TIMEOUT，已保存内容仍保留。",
        "重试",
      ],
      forbidden: [
        "没有查看权限",
        "权限拒绝示例，不展示受限资源信息。",
        "返回可见页面",
      ],
    };
    const state = states[c.scenario];
    return (
      <>
        <PageHeader page={section} />
        <div className="panel empty">
          <div className="empty-icon" aria-hidden="true">
            {c.scenario === "error"
              ? "⚠"
              : c.scenario === "loading"
                ? "◌"
                : "◇"}
          </div>
          <h2>{state[0]}</h2>
          <p>{state[1]}</p>
          {c.scenario === "loading" && (
            <>
              <div className="skeleton" />
              <div className="skeleton" style={{ width: "40%" }} />
            </>
          )}
          <Button kind="primary" onClick={() => c.setScenario("normal")}>
            {state[2]}
          </Button>
        </div>
      </>
    );
  }
  switch (section) {
    case "workspace":
      return <Workspace />;
    case "devices":
      return detail ? <DeviceDetail /> : <Devices />;
    case "products":
      return <Products />;
    case "telemetry":
      return <Telemetry />;
    case "rules":
      return <Rules />;
    case "alarms":
      return <Alarms />;
    case "ota":
      return <Ota />;
    case "tenants":
      return <Tenants />;
    case "access":
      return <Access />;
    case "audit":
      return <Audit />;
    case "settings":
      return <Settings />;
    case "nodes":
      return <Nodes />;
    case "connectors":
      return <Connectors />;
    case "learning":
      return <Learning />;
  }
}
