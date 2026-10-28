import { describe, it, expect, beforeEach, vi } from "vitest";
import { execute, cold } from "./domain";
import { seed } from "./seed";
describe("V3 domain commands", () => {
  it("matches approved meter and temperature specifications", () => {
    const s = seed();
    expect(s.devices[0]).toMatchObject({
      temp: 24.6,
      desired: 22,
      reported: 22,
    });
    expect(s.devices[3]).toMatchObject({ energy: 420.8, power: 2600 });
    expect(s.devices[3]?.temp).toBeUndefined();
  });
  it("provisions then ingests and synchronizes shadow", () => {
    const s = seed(),
      id = execute(s, "register", {
        name: "新冷链",
        serial: "TEST-001",
        product: cold,
        group: "华东冷链",
      });
    expect(s.devices.at(-1)?.status).toBe("待接入");
    execute(s, "ingest", { id });
    execute(s, "shadow", { id, temp: "18" });
    execute(s, "sync", { id });
    expect(s.devices.at(-1)).toMatchObject({
      status: "在线",
      temp: 24.8,
      desired: 18,
      reported: 18,
    });
    expect(() =>
      execute(s, "register", {
        name: "duplicate",
        serial: "test-001",
        product: cold,
        group: "华东冷链",
      }),
    ).toThrow("已存在");
  });
  it("requires acknowledgment before resolving generated alarms", () => {
    const s = seed();
    execute(s, "test", { id: "RUL-001", device: "DEV-1001", temp: "35" });
    const id = s.alarms[0]!.id;
    expect(() =>
      execute(s, "resolve", { id, note: "现场检查完成正常" }),
    ).toThrow("先确认");
    execute(s, "ack", { id, owner: "周远", note: "现场检查中" });
    execute(s, "resolve", { id, note: "现场检查完成正常" });
    expect(s.alarms[0]?.status).toBe("已解决");
    expect(s.alarms[0]?.history).toHaveLength(3);
  });
  it("rejects duplicate OTA targets and protects active targets", () => {
    const s = seed();
    expect(() =>
      execute(s, "batch", { name: "更新", targets: "DEV-1001,DEV-1001" }),
    ).toThrow("重复");
    const id = execute(s, "batch", {
      name: "更新",
      targets: "DEV-1001,DEV-1002",
    });
    expect(() =>
      execute(s, "delete", { ids: "DEV-1001", confirmation: "DELETE" }),
    ).toThrow("活跃");
    s.role = "operator";
    expect(() => execute(s, "advance", { id })).toThrow("权限");
    s.role = "platformAdmin";
    execute(s, "advance", { id });
    execute(s, "advance", { id });
    execute(s, "delete", { ids: "DEV-1001", confirmation: "DELETE" });
    s.role = "operator";
    execute(s, "retry", { id, reason: "网络恢复后重新校验" });
    execute(s, "advance", { id });
    expect(s.batches[0]?.targets.map((t) => t.attempts)).toEqual([1, 2]);
    expect(s.batches[0]?.status).toBe("完成");
  });
  it("rejects missing and offline retry targets", () => {
    const s = seed(),
      id = execute(s, "batch", { name: "更新", targets: "DEV-1001" });
    execute(s, "advance", { id });
    execute(s, "advance", { id });
    s.devices[0]!.status = "离线";
    expect(() =>
      execute(s, "retry", { id, reason: "恢复连接之后重试" }),
    ).toThrow("离线");
    s.devices.shift();
    expect(() =>
      execute(s, "retry", { id, reason: "恢复连接之后重试" }),
    ).toThrow("不存在");
  });
  it("rejects governance escalation, duplicate emails, under-quota and meter controls", () => {
    const s = seed();
    expect(() =>
      execute(s, "invite", {
        name: "duplicate",
        email: "LIN@example.invalid",
        role: "数据观察员",
      }),
    ).toThrow("已存在");
    expect(() => execute(s, "quota", { quota: "4" })).toThrow();
    expect(() => execute(s, "reboot", { id: "DEV-1004" })).toThrow("只读");
    s.role = "tenantAdmin";
    expect(() => execute(s, "quota", { quota: "10" })).toThrow("权限");
    s.role = "viewer";
    expect(() => execute(s, "ingest", { id: "DEV-1001" })).toThrow("权限");
  });
});
describe("V3 transactional persistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.resetModules();
  });
  it("commits nothing after late command validation fails", async () => {
    const store = await import("./store"),
      before = JSON.stringify(store.state);
    expect(() =>
      store.command("edit", { id: "DEV-1001", name: "changed", group: "" }),
    ).toThrow();
    expect(JSON.stringify(store.state)).toBe(before);
    expect(localStorage.length).toBe(0);
  });
  it("recovers malformed nested snapshots", async () => {
    localStorage.setItem(
      "iot-atlas-vue-v3.2",
      JSON.stringify({ ...seed(), devices: [{ id: "broken" }] }),
    );
    const store = await import("./store");
    expect(store.state.devices).toHaveLength(5);
  });
  it("persists a valid change independently", async () => {
    const store = await import("./store");
    store.command("quota", { quota: "12" });
    expect(JSON.parse(localStorage.getItem(store.storageKey)!).quota).toBe(12);
  });
  it("reports denied storage without claiming persistence", async () => {
    const store = await import("./store");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    store.command("quota", { quota: "12" });
    expect(store.notice.value).toContain("仅本次打开有效");
  });
});

it("roundtrips a modified snapshot containing both device kinds", async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  vi.resetModules();
  const store = await import("./store");
  store.command("edit", {
    id: "DEV-1001",
    name: "已保存名称",
    group: "华东冷链",
    tags: "重点",
  });
  expect(store.load().devices[0]?.name).toBe("已保存名称");
  expect(store.load().devices[3]?.energy).toBe(420.8);
});

it("rejects nonexistent connector commands", () => {
  expect(() => execute(seed(), "connector", { id: "FTP" })).toThrow("不存在");
});

it("rejects overlong tags transactionally", async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  vi.resetModules();
  const store = await import("./store");
  const before = JSON.stringify(store.state);
  expect(() =>
    store.command("edit", {
      id: "DEV-1001",
      name: "changed",
      group: "华东冷链",
      tags: "x".repeat(81),
    }),
  ).toThrow();
  expect(JSON.stringify(store.state)).toBe(before);
});
it("rejects overlong property units transactionally", async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  vi.resetModules();
  const store = await import("./store");
  const before = JSON.stringify(store.state);
  expect(() =>
    store.command("field", {
      id: "PRD-001",
      name: "pressure",
      type: "float",
      unit: "x".repeat(13),
    }),
  ).toThrow();
  expect(JSON.stringify(store.state)).toBe(before);
});
it("trims valid tags and property units", () => {
  const s = seed();
  execute(s, "edit", {
    id: "DEV-1001",
    name: "冷链",
    group: "华东冷链",
    tags: "  重点  ",
  });
  execute(s, "field", {
    id: "PRD-001",
    name: "pressure",
    type: "float",
    unit: "  hPa  ",
  });
  expect(s.devices[0]?.tags).toBe("重点");
  expect(s.products[0]?.fields.at(-1)?.unit).toBe("hPa");
});
