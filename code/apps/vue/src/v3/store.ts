import { reactive, ref, toRaw } from "vue";
import {
  execute,
  type State,
  type Role,
  type Input,
  type Action,
} from "./domain";
import { seed } from "./seed";
export const storageKey = "iot-atlas-vue-v3.2";
// Validate every required sample field recursively; OTA has an initially empty seed.
function shape(value: unknown, example: unknown): boolean {
  if (Array.isArray(example))
    return (
      Array.isArray(value) &&
      (!example.length ||
        value.every((x) => example.some((sample) => shape(x, sample))))
    );
  if (example && typeof example === "object")
    return (
      !!value &&
      typeof value === "object" &&
      Object.entries(example).every(([k, v]) =>
        shape((value as Record<string, unknown>)[k], v),
      )
    );
  return (
    typeof value === typeof example &&
    (typeof value !== "number" || Number.isFinite(value))
  );
}
export function load(): State {
  try {
    const value = JSON.parse(
      localStorage.getItem(storageKey) || "null",
    ) as State;
    if (
      shape(value, seed()) &&
      value.revision === 1 &&
      ["platformAdmin", "tenantAdmin", "operator", "viewer"].includes(
        value.role,
      ) &&
      value.batches.every((b) =>
        shape(b, {
          id: "",
          name: "",
          version: "",
          status: "",
          targets: [{ device: "", status: "", attempts: 0, reason: "" }],
          history: [""],
        }),
      )
    )
      return value;
  } catch {
    /* Unsupported or damaged browser storage recovers to the sample. */
  }
  return seed();
}
export const state = reactive(load()),
  dirty = ref(false),
  notice = ref("");
let timer: ReturnType<typeof setTimeout>;
export function notify(text: string) {
  notice.value = text;
  clearTimeout(timer);
  timer = setTimeout(() => (notice.value = ""), 5000);
}
function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export function command(action: Action, input: Input) {
  const next = structuredClone(toRaw(state));
  const result = execute(next, action, input);
  Object.assign(state, next);
  notify(
    result + (persist() ? "（本地模拟）" : "（存储不可用，仅本次打开有效）"),
  );
  return result;
}
export function identity(role: Role) {
  state.role = role;
  if (!persist()) notify("存储不可用，仅本次打开有效");
}
export function reset() {
  Object.assign(state, seed());
  dirty.value = false;
  notify(persist() ? "演示已重置（本地模拟）" : "演示已重置，仅本次打开有效");
}
export function mayLeave() {
  return !dirty.value || window.confirm("有未保存的修改。放弃修改并离开？");
}
