import { describe, expect, it } from "vitest";
import { command, restore, samples, type Action, type State } from "./model";
import { seed } from "./seed";
describe("V3 isolated command transactions", () => {
  it("preserves precise seeds and product-specific fields", () => {
    const s = seed();
    expect(s.devices[0].tags).toBe("冷库,重点");
    expect(s.devices[0].events).toHaveLength(2);
    expect(s.devices[3]).toMatchObject({ energy: 420.8, power: 2600 });
    expect(s.devices[3]).not.toHaveProperty("temp");
  });
  it("provisions and applies telemetry, shadow and command with audit", () => {
    let r = command(seed(), "register", {
      name: "测试冷链",
      serial: "TEST-001",
      product: "ColdSense T200",
      group: "华东冷链",
    });
    const id = r.id;
    expect(r.state.devices.at(-1)?.status).toBe("待接入");
    r = command(r.state, "ingest", {}, id);
    r = command(r.state, "shadow", { temp: "18" }, id);
    r = command(r.state, "sync", {}, id);
    r = command(r.state, "command", {}, id);
    expect(r.state.devices.at(-1)).toMatchObject({
      status: "在线",
      desired: 18,
      reported: 18,
    });
    expect(r.state.devices.at(-1)?.events).toHaveLength(4);
    expect(r.state.audit).toHaveLength(6);
  });
  it("rejects serial duplicates, missing groups, and electric control without mutation", () => {
    const s = seed(),
      before = structuredClone(s);
    for (const [action, fields, target] of [
      [
        "register",
        {
          name: "重复",
          serial: "ch-temp-001",
          product: "ColdSense T200",
          group: "华东冷链",
        },
        "",
      ],
      ["edit", { name: "Changed", group: "", tags: "x" }, "DEV-1001"],
      ["ingest", {}, "DEV-1004"],
    ] as [Action, Record<string, string>, string][]) {
      expect(() => command(s, action, fields, target)).toThrow();
      expect(s).toEqual(before);
    }
  });
  it("moves rule output through assigned and resolved alarm", () => {
    let r = command(seed(), "rule", { name: "测试高温", threshold: "28" });
    r = command(r.state, "trial", { device: "DEV-1001", temp: "32" }, r.id);
    const id = r.id;
    expect(() =>
      command(r.state, "resolve", { note: "尚未确认不能直接解决" }, id),
    ).toThrow();
    r = command(r.state, "ack", { owner: "周远", note: "正在现场检查" }, id);
    r = command(r.state, "resolve", { note: "温控修复后恢复正常" }, id);
    expect(r.state.alarms[0]).toMatchObject({
      status: "已解决",
      owner: "周远",
    });
    expect(r.state.alarms[0].history).toHaveLength(3);
  });
  const partial = () => {
    let r = command(seed(), "batch", {
      name: "升级",
      targets: "DEV-1001,DEV-1002",
    });
    const id = r.id;
    r = command(r.state, "advance", {}, id);
    r = command(r.state, "advance", {}, id);
    return { ...r, id };
  };
  it("only retries failed OTA and preserves successful attempts", () => {
    let r = partial();
    const id = r.id;
    r = command(r.state, "retry", { reason: "确认网络恢复后重试" }, id);
    r = command(r.state, "advance", {}, id);
    expect(r.state.batches[0].status).toBe("完成");
    expect(r.state.batches[0].targets.map((t) => t.attempts)).toEqual([1, 2]);
  });
  it("guards active deletion, duplicate targets and stale/offline OTA transactionally", () => {
    const r = command(seed(), "batch", {
      name: "升级",
      targets: "DEV-1001,DEV-1002",
    });
    expect(() =>
      command(r.state, "delete", { confirm: "DELETE" }, "DEV-1001"),
    ).toThrow("活跃");
    expect(() =>
      command(seed(), "batch", { name: "重复", targets: "DEV-1001,DEV-1001" }),
    ).toThrow("重复");
    const p = partial();
    p.state.devices[1].status = "离线";
    const before = structuredClone(p.state);
    expect(() =>
      command(p.state, "retry", { reason: "恢复连接之后重试" }, p.id),
    ).toThrow("不在线");
    expect(p.state).toEqual(before);
  });
  it("operator may retry/advance retries, not start normal upgrades", () => {
    const initial = command(seed(), "batch", {
      name: "升级",
      targets: "DEV-1001,DEV-1002",
    });
    initial.state.role = "operator";
    expect(() => command(initial.state, "advance", {}, initial.id)).toThrow(
      "权限",
    );
    let r = partial();
    r.state.role = "operator";
    r = command(r.state, "retry", { reason: "恢复后再次尝试" }, r.id);
    r = command(r.state, "advance", {}, r.id);
    expect(r.state.batches[0].status).toBe("完成");
  });
  it("does not re-execute a success removed before retry", () => {
    let r = partial();
    const id = r.id;
    r = command(r.state, "delete", { confirm: "DELETE" }, "DEV-1001");
    r = command(r.state, "retry", { reason: "恢复失败设备后重试" }, id);
    r = command(r.state, "advance", {}, id);
    expect(r.state.batches[0].status).toBe("完成");
  });
  it("governs invitation, role and minimum quota", () => {
    let r = command(seed(), "invite", {
      name: "新成员",
      email: "new@example.invalid",
      role: "数据观察员",
    });
    r = command(r.state, "member", { role: "运维工程师" }, r.id);
    expect(r.state.members.at(-1)).toMatchObject({
      role: "运维工程师",
      status: "已邀请",
    });
    expect(() => command(r.state, "quota", { quota: "4" })).toThrow();
    r = command(r.state, "quota", { quota: "5" });
    expect(r.state.quota).toBe(5);
  });
  it.each([
    "register",
    "edit",
    "ingest",
    "shadow",
    "sync",
    "command",
    "delete",
    "field",
    "rule",
    "toggle",
    "trial",
    "ack",
    "resolve",
    "batch",
    "advance",
    "retry",
    "invite",
    "member",
    "quota",
    "prefs",
    "connect",
  ] as Action[])(
    "viewer rejects %s before inputs and never changes audit",
    (action) => {
      const s: State = { ...seed(), role: "viewer" };
      expect(() => command(s, action)).toThrow("无操作权限");
      expect(s.audit).toHaveLength(1);
      expect(s.next).toBe(20);
    },
  );
  it("validates nonfinite inputs and snapshot structures; fixed query data", () => {
    expect(() =>
      command(seed(), "shadow", { temp: "NaN" }, "DEV-1001"),
    ).toThrow();
    expect(samples(seed().devices[0], true)).toHaveLength(2);
    expect(restore(JSON.stringify(seed()))).toEqual(seed());
    for (const raw of [
      "{",
      "null",
      JSON.stringify({ ...seed(), products: null }),
      JSON.stringify({ ...seed(), devices: [null] }),
      JSON.stringify({ ...seed(), role: "__proto__" }),
    ])
      expect(restore(raw)).toEqual(seed());
  });
});
