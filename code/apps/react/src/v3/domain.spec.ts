import { describe, expect, it } from "vitest";
import { execute, seed, validSnapshot } from "./domain";
import type { Command, Workspace } from "./types";
const run = (s: Workspace, c: Command) => execute(s, c, "12:00");
describe("V3 independent domain transactions", () => {
  it("registers unique devices, activates telemetry and keeps the input snapshot untouched", () => {
    const s = seed(),
      n = run(s, {
        type: "register",
        name: "新冷库",
        serial: "TEST-001",
        product: "ColdSense T200",
        group: "华东冷链",
      }),
      d = n.devices.at(-1)!;
    expect(s.devices).toHaveLength(5);
    expect(d.status).toBe("待接入");
    const online = run(n, { type: "ingest", id: d.id });
    expect(online.devices.at(-1)?.status).toBe("在线");
    expect(online.devices.at(-1)?.events).toHaveLength(2);
    expect(() =>
      run(n, {
        type: "register",
        name: "重复",
        serial: "test-001",
        product: "ColdSense T200",
        group: "华东冷链",
      }),
    ).toThrow("已存在");
  });
  it("checks permission before any write, including direct domain invocation", () => {
    const s = { ...seed(), role: "viewer" as const };
    expect(() => run(s, { type: "ingest", id: "DEV-1001" })).toThrow("权限");
    expect(() =>
      run({ ...s, role: "tenantAdmin" }, { type: "quota", quota: 10 }),
    ).toThrow("权限");
    expect(s.audit).toHaveLength(1);
  });
  it("creates alarms only above threshold and enforces acknowledgement before resolution", () => {
    let s = seed();
    s = run(s, {
      type: "testRule",
      id: "RUL-001",
      device: "DEV-1001",
      temp: 30,
    });
    expect(s.alarms).toHaveLength(1);
    s = run(s, {
      type: "testRule",
      id: "RUL-001",
      device: "DEV-1001",
      temp: 32,
    });
    const id = s.alarms[0].id;
    expect(() => run(s, { type: "resolve", id, note: "恢复正常范围" })).toThrow(
      "先确认",
    );
    s = run(s, { type: "ack", id, owner: "周远", note: "检查现场设备" });
    s = run(s, { type: "resolve", id, note: "现场温度已经恢复正常" });
    expect(s.alarms[0].status).toBe("已解决");
    expect(s.alarms[0].history).toHaveLength(3);
  });
  it("keeps OTA successful attempts unchanged and restricts the first advance to administrators", () => {
    let s = run(seed(), {
      type: "createBatch",
      name: "试点",
      targets: ["DEV-1001", "DEV-1002"],
    });
    const id = s.batches[0].id;
    expect(() =>
      run({ ...s, role: "operator" }, { type: "advance", id }),
    ).toThrow("权限");
    expect(() =>
      run(s, { type: "delete", ids: ["DEV-1001"], confirmation: "DELETE" }),
    ).toThrow("升级");
    s = run(run(s, { type: "advance", id }), { type: "advance", id });
    expect(s.batches[0].targets.map((t) => t.status)).toEqual(["成功", "失败"]);
    s = run(
      { ...s, role: "operator" },
      { type: "retry", id, reason: "网络已恢复重新执行" },
    );
    s = run(s, { type: "advance", id });
    expect(s.batches[0].status).toBe("完成");
    expect(s.batches[0].targets.map((t) => t.attempts)).toEqual([1, 2]);
  });
  it("rolls back offline/missing OTA targets and rejects duplicate targets", () => {
    const base = seed();
    expect(() =>
      run(base, {
        type: "createBatch",
        name: "重复",
        targets: ["DEV-1001", "DEV-1001"],
      }),
    ).toThrow("重复");
    let s = run(base, {
      type: "createBatch",
      name: "批次",
      targets: ["DEV-1001"],
    });
    const id = s.batches[0].id;
    s.devices[0].status = "离线";
    const before = structuredClone(s);
    expect(() => run(s, { type: "advance", id })).toThrow("不在线");
    expect(s).toEqual(before);
    s.devices[0].status = "在线";
    s = run(run(s, { type: "advance", id }), { type: "advance", id });
    s.devices.shift();
    const failed = structuredClone(s);
    expect(() =>
      run(s, { type: "retry", id, reason: "检查缺失目标回滚" }),
    ).toThrow("不存在");
    expect(s).toEqual(failed);
  });
  it("can retry failed devices after a successful historical target is deleted", () => {
    let s = run(seed(), {
      type: "createBatch",
      name: "历史记录",
      targets: ["DEV-1001", "DEV-1002"],
    });
    const id = s.batches[0].id;
    s = run(run(s, { type: "advance", id }), { type: "advance", id });
    s = run(s, { type: "delete", ids: ["DEV-1001"], confirmation: "DELETE" });
    s = run(s, { type: "retry", id, reason: "恢复失败的设备" });
    s = run(s, { type: "advance", id });
    expect(s.batches[0].status).toBe("完成");
    expect(s.batches[0].targets[0].attempts).toBe(1);
  });
  it("keeps EnergyLink free of thermal controls and rejects invalid attributes atomically", () => {
    const s = seed();
    expect(s.devices[3].temp).toBeUndefined();
    expect(() => run(s, { type: "shadow", id: "DEV-1004", temp: 22 })).toThrow(
      "温控",
    );
    expect(() =>
      run(s, {
        type: "attribute",
        id: "PRD-001",
        name: "temperature",
        fieldType: "float",
        unit: "°C",
      }),
    ).toThrow("已存在");
    expect(s.products[0].fields).toHaveLength(3);
  });
  it("governs invitation, role and quota while rejecting duplicates and lower-than-usage limits", () => {
    let s = run(seed(), {
      type: "invite",
      name: "新成员",
      email: "TEST@example.invalid",
      role: "数据观察员",
    });
    expect(s.members.at(-1)?.status).toBe("已邀请");
    expect(() =>
      run(s, {
        type: "invite",
        name: "重复",
        email: "test@example.invalid",
        role: "数据观察员",
      }),
    ).toThrow("已存在");
    s = run(s, {
      type: "memberRole",
      id: s.members.at(-1)!.id,
      role: "运维工程师",
    });
    expect(() => run(s, { type: "quota", quota: 4 })).toThrow("用量");
    s = run(s, { type: "quota", quota: 5 });
    expect(() =>
      run(s, {
        type: "register",
        name: "超额",
        serial: "OVER-001",
        product: "ColdSense T200",
        group: "华东冷链",
      }),
    ).toThrow("用尽");
  });
  it("rejects partial and corrupt persisted structures used by templates", () => {
    expect(validSnapshot(seed())).toBe(true);
    expect(validSnapshot({ schema: 1, devices: [] })).toBe(false);
    const s = seed();
    expect(
      validSnapshot({ ...s, devices: [{ ...s.devices[0], group: null }] }),
    ).toBe(false);
    expect(validSnapshot({ ...s, role: "__proto__" })).toBe(false);
    expect(validSnapshot({ ...s, alarms: [null] })).toBe(false);
  });
});
