import { ref, computed, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { state, command, dirty, mayLeave, notify, reset } from "./store";
import { cold, can, capability, type Action, type Input } from "./domain";
export type Operation =
  | Action
  | "reset"
  | "product-detail"
  | "alarm-detail"
  | "batch-detail"
  | "node"
  | "connection-result";
export interface Field {
  name: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  pattern?: string;
}
/** Drafts belong to the current page, not a cache of visited route components. */
export function useOperations() {
  const route = useRoute(),
    router = useRouter();
  const kind = ref<Operation | "">(""),
    object = ref(""),
    title = ref(""),
    submit = ref("保存"),
    form = ref<Input>({}),
    fields = ref<Field[]>([]),
    targets = ref<string[]>([]),
    error = ref("");
  const product = computed(() =>
      state.products.find((p) => p.id === object.value),
    ),
    alarm = computed(() => state.alarms.find((a) => a.id === object.value)),
    batch = computed(() => state.batches.find((b) => b.id === object.value));
  const isForm = computed(
    () =>
      fields.value.length > 0 ||
      ["batch", "reset", "reboot"].includes(kind.value),
  );
  function clear() {
    kind.value = "";
    fields.value = [];
    form.value = {};
    error.value = "";
    dirty.value = false;
  }
  watch(() => [route.fullPath, state.role], clear);
  function close() {
    if (mayLeave()) clear();
  }
  // A native input may emit change while its dialog restores focus. Never revive a discarded draft.
  function markDirty() {
    if (kind.value && isForm.value) dirty.value = true;
  }
  function view(name: Operation, id = "") {
    kind.value = name;
    object.value = id;
    fields.value = [];
    error.value = "";
    dirty.value = false;
    title.value =
      name === "product-detail"
        ? product.value?.name + " · 物模型"
        : name === "alarm-detail"
          ? alarm.value?.name || "告警"
          : name === "batch-detail"
            ? batch.value?.name || "升级批次"
            : name === "node"
              ? id
              : "连接测试 · 模拟结果";
  }
  function act(a: Action, id: string) {
    try {
      command(a, { id });
      if (a === "advance") view("batch-detail", id);
      else if (a === "connector") view("connection-result", id);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function open(a: Operation, id = "") {
    if (
      [
        "product-detail",
        "alarm-detail",
        "batch-detail",
        "node",
        "connection-result",
      ].includes(a)
    ) {
      view(a, id);
      return;
    }
    if (a !== "reset" && !can(state.role, capability(a as Action))) {
      notify("无操作权限：当前身份不能执行此操作。");
      return;
    }
    if (["ingest", "sync", "toggle", "advance", "connector"].includes(a)) {
      act(a as Action, id);
      return;
    }
    kind.value = a;
    object.value = id;
    form.value = { id };
    fields.value = [];
    error.value = "";
    dirty.value = false;
    submit.value = "保存";
    const text = (
      name: string,
      label: string,
      value = "",
      extra: Partial<Field> = {},
    ) => {
      form.value[name] = value;
      fields.value.push({ name, label, required: true, ...extra });
    };
    const select = (
      name: string,
      label: string,
      items: string[] | { value: string; label: string }[],
      value = "",
    ) => {
      const opts = items.map((x) =>
        typeof x === "string" ? { value: x, label: x } : x,
      );
      form.value[name] = value || opts[0]?.value || "";
      fields.value.push({
        name,
        label,
        type: "select",
        options: opts,
        required: true,
      });
    };
    const d = state.devices.find((d) => d.id === id);
    switch (a) {
      case "register":
        title.value = "注册新设备";
        submit.value = "保存并进入接入";
        text("name", "设备名称 *", "", { max: 48 });
        select(
          "product",
          "所属产品 *",
          state.products.map((p) => p.name),
        );
        text("serial", "设备序列号 *", "", {
          pattern: "[A-Za-z0-9_-]{4,40}",
          max: 40,
        });
        select("group", "所属分组", ["华东冷链", "华南仓储", "华东园区"]);
        break;
      case "edit":
        title.value = "编辑设备资料";
        text("name", "设备名称 *", d?.name, { max: 48 });
        select(
          "group",
          "所属分组",
          ["华东冷链", "华南仓储", "华东园区"],
          d?.group,
        );
        text("tags", "标签（逗号分隔）", d?.tags, { max: 80, required: false });
        break;
      case "delete":
        title.value = "确认删除设备";
        form.value.ids = id;
        text("confirmation", "输入 DELETE 确认 *", "", { pattern: "DELETE" });
        submit.value = "删除 " + id.split(",").length + " 台设备";
        break;
      case "shadow":
        title.value = "编辑目标温度";
        text("temp", "targetTemp °C *", String(d?.desired ?? 22), {
          type: "number",
          min: -20,
          max: 50,
          step: 0.5,
        });
        break;
      case "reboot":
        title.value = "确认重启设备";
        submit.value = "确认模拟重启";
        break;
      case "field":
        title.value = "新增物模型属性";
        submit.value = "添加属性";
        text("name", "属性标识符 *", "", {
          pattern: "[a-zA-Z][a-zA-Z0-9_]{1,30}",
        });
        select("type", "类型", ["float", "integer", "boolean", "string"]);
        text("unit", "单位", "", { required: false, max: 12 });
        break;
      case "rule":
        title.value = "创建温度阈值规则";
        submit.value = "创建并启用";
        text("name", "规则名称 *", "", { max: 50 });
        text("threshold", "触发阈值 °C *", "30", {
          type: "number",
          min: -40,
          max: 120,
          step: 0.1,
        });
        break;
      case "test":
        title.value = "模拟规则输入";
        submit.value = "运行一次";
        select(
          "device",
          "设备",
          state.devices
            .filter((d) => d.product === cold)
            .map((d) => ({ value: d.id, label: d.name })),
        );
        text(
          "temp",
          "模拟温度 °C *",
          String((state.rules.find((r) => r.id === id)?.threshold ?? 30) + 2),
          { type: "number", min: -40, max: 120, step: 0.1 },
        );
        break;
      case "ack":
        title.value = "确认并分派告警";
        submit.value = "确认告警";
        select(
          "owner",
          "负责人 *",
          state.members.filter((m) => m.status === "已加入").map((m) => m.name),
        );
        text("note", "初步处理说明 *", "", {
          type: "textarea",
          min: 3,
          max: 200,
        });
        break;
      case "resolve":
        title.value = "解决告警";
        submit.value = "确认解决";
        text("note", "解决原因 *", "", { type: "textarea", min: 5, max: 300 });
        break;
      case "batch":
        title.value = "创建升级批次";
        submit.value = "确认范围并创建";
        text("name", "批次名称 *", "冷链稳定性更新", { max: 50 });
        targets.value = state.devices
          .filter((d) => d.product === cold && d.status === "在线")
          .map((d) => d.id);
        break;
      case "retry":
        title.value = "仅重试失败设备";
        submit.value = "确认重试";
        text("reason", "重试原因 *", "", {
          type: "textarea",
          min: 5,
          max: 200,
        });
        break;
      case "invite":
        title.value = "邀请工作区成员";
        submit.value = "创建模拟邀请";
        text("name", "姓名 *", "", { max: 30 });
        text("email", "演示邮箱 *", "", { type: "email", max: 100 });
        select("role", "角色", ["运维工程师", "数据观察员", "租户管理员"]);
        break;
      case "member":
        title.value = "分配成员角色";
        submit.value = "确认角色变更";
        select(
          "role",
          "新角色",
          ["租户管理员", "运维工程师", "数据观察员"],
          state.members.find((m) => m.id === id)?.role,
        );
        break;
      case "quota":
        title.value = "调整设备配额";
        submit.value = "保存配额";
        text("quota", "设备配额 *", String(state.quota), {
          type: "number",
          min: 1,
          max: 100000,
          step: 1,
        });
        break;
      case "reset":
        title.value = "重置本地演示";
        submit.value = "确认重置";
        break;
    }
  }
  async function save() {
    try {
      const a = kind.value;
      if (a === "reset") {
        reset();
        clear();
        await router.push("/v3/workspace");
        return;
      }
      const objectId = object.value;
      const result = command(a as Action, {
        ...Object.fromEntries(
          Object.entries(form.value).map(([k, v]) => [k, String(v)]),
        ),
        targets: targets.value.join(","),
      });
      clear();
      if (a === "register") {
        await router.push("/v3/devices/" + result);
        notify("步骤 2 / 2：点击“模拟上报”完成接入。");
      } else if (a === "test") await router.push("/v3/alarms");
      else if (a === "batch") view("batch-detail", result);
      else if (a === "retry") view("batch-detail", objectId);
      else if (a === "ack" || a === "resolve") view("alarm-detail", objectId);
      else if (a === "field") view("product-detail", objectId);
    } catch (e) {
      error.value = (e as Error).message;
      await nextTick();
      document.querySelector<HTMLElement>(".v3 .error")?.focus();
    }
  }
  return {
    kind,
    object,
    title,
    submit,
    form,
    fields,
    targets,
    error,
    product,
    alarm,
    batch,
    isForm,
    open,
    close,
    markDirty,
    save,
    clear,
  };
}
