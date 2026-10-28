import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceStore } from "./store";
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
it("keeps a successful in-memory command and truthful storage-denied feedback", () => {
  const store = new WorkspaceStore();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("denied");
  });
  store.execute("quota", { quota: "20" });
  expect(store.state().quota).toBe(20);
  expect(store.feedback()).toContain("存储不可用");
  store.role("viewer");
  expect(store.feedback()).toContain("存储不可用");
});
it("recovers incomplete persisted state before templates render", () => {
  localStorage.setItem("iot-atlas-angular-v3", '{"devices":[]}');
  expect(new WorkspaceStore().state().devices).toHaveLength(5);
});
