import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from "@angular/core";
import { FormControl, FormRecord } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, Subject } from "rxjs";
import {
  allowed,
  samples,
  type Action,
  type Alarm,
  type Batch,
  type Device,
  type Fields,
  type Product,
} from "./model";
import { WorkspaceStore, WorkspaceDraft, modules } from "./store";
export interface Field {
  name: string;
  label: string;
  value: string;
  type: string;
  required: boolean;
  options?: { value: string; label: string }[];
}
export type ModalKind =
  "form" | "product" | "alarm" | "batch" | "search" | "notifications" | "info";
/** Page-scoped coordinator: URL owns applied queries, forms own drafts, store owns committed data. */
@Injectable()
export class WorkspaceUI {
  readonly store = inject(WorkspaceStore);
  readonly draft = inject(WorkspaceDraft);
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly destroy = inject(DestroyRef);
  readonly state = this.store.state;
  readonly page = signal("workspace");
  readonly id = signal("");
  readonly tab = signal("overview");
  readonly query = signal<Fields>({});
  readonly scenario = signal("normal");
  readonly selected = signal<string[]>([]);
  readonly filters = new FormRecord({
    q: new FormControl("", { nonNullable: true }),
    status: new FormControl("", { nonNullable: true }),
  });
  readonly telemetry = new FormRecord({
    device: new FormControl("DEV-1001", { nonNullable: true }),
    window: new FormControl("45", { nonNullable: true }),
  });
  readonly prefs = new FormRecord({
    inapp: new FormControl("true", { nonNullable: true }),
    email: new FormControl("false", { nonNullable: true }),
  });
  readonly search = new FormControl("", { nonNullable: true });
  readonly term = signal("");
  readonly modal = signal<ModalKind | null>(null);
  readonly title = signal("");
  readonly note = signal("");
  readonly targetId = signal("");
  readonly error = signal("");
  readonly fields = signal<Field[]>([]);
  readonly modalEvents = new Subject<"open" | "close">();
  form = new FormRecord<FormControl<string>>({});
  action: Action | "reset" | null = null;
  opener: HTMLElement | null = null;
  readonly targetOptions = signal<Device[]>([]);
  targetIds: string[] = [];
  readonly current = computed(() =>
    modules.find((m) => m.path === this.page()),
  );
  readonly device = computed(() =>
    this.state().devices.find((d) => d.id === this.id()),
  );
  readonly cold = computed(() =>
    this.state().devices.filter((d) => d.product === "ColdSense T200"),
  );
  readonly devices = computed(() => {
    const q = (this.query()["q"] || "").toLowerCase(),
      status = this.query()["status"];
    return this.state().devices.filter(
      (d) =>
        (!q ||
          [d.id, d.name, d.serial, d.group, d.tags]
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
        (!status || d.status === status),
    );
  });
  readonly telemetryDevice = computed(
    () =>
      this.cold().find((d) => d.id === this.query()["device"]) ||
      this.cold()[0],
  );
  readonly points = computed(() => {
    const d = this.telemetryDevice();
    return d ? samples(d, this.query()["window"] === "15") : [];
  });
  readonly product = computed(() =>
    this.state().products.find((p) => p.id === this.targetId()),
  );
  readonly alarm = computed(() =>
    this.state().alarms.find((a) => a.id === this.targetId()),
  );
  readonly batch = computed(() =>
    this.state().batches.find((b) => b.id === this.targetId()),
  );
  readonly audit = computed(() =>
    this.state().audit.filter((a) =>
      (a.action + " " + a.object).includes(this.query()["q"] || ""),
    ),
  );
  readonly denied = computed(
    () =>
      ["tenants", "access"].includes(this.page()) &&
      !allowed(this.state().role, "govern"),
  );
  readonly online = computed(
    () => this.state().devices.filter((d) => d.status === "在线").length,
  );
  readonly openAlarms = computed(
    () => this.state().alarms.filter((a) => a.status !== "已解决").length,
  );
  readonly activeBatches = computed(
    () => this.state().batches.filter((b) => b.status !== "完成").length,
  );
  readonly results = computed(() =>
    [
      ...modules.map((m) => ({ title: m.title, url: "/v3/" + m.path })),
      ...this.state().devices.map((d) => ({
        title: d.name + " " + d.id,
        url: "/v3/devices/" + d.id,
      })),
      ...this.state().rules.map((r) => ({ title: r.name, url: "/v3/rules" })),
    ]
      .filter((r) => r.title.toLowerCase().includes(this.term().toLowerCase()))
      .slice(0, 8),
  );
  constructor() {
    this.draft.dirty = () => this.form.dirty || this.prefs.dirty;
    this.draft.discard = () => {
      this.form.markAsPristine();
      this.prefs.reset({
        inapp: String(this.state().prefs.inapp),
        email: String(this.state().prefs.email),
      });
      this.close(true);
    };
    combineLatest([
      this.route.data,
      this.route.paramMap,
      this.route.queryParamMap,
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([data, params, query]) => {
        this.page.set(data["page"] || "missing");
        this.id.set(params.get("id") || "");
        this.tab.set(query.get("tab") || "overview");
        const q: Fields = {};
        for (const k of query.keys) q[k] = query.get(k) || "";
        this.query.set(q);
        this.filters.reset({ q: q["q"] || "", status: q["status"] || "" });
        this.telemetry.reset({
          device: q["device"] || this.cold()[0]?.id || "",
          window: q["window"] || "45",
        });
        this.prefs.reset({
          inapp: String(this.state().prefs.inapp),
          email: String(this.state().prefs.email),
        });
        this.selected.set([]);
        this.scenario.set("normal");
        this.close(true);
      });
    this.store.overlay
      .pipe(takeUntilDestroyed())
      .subscribe((kind) =>
        this.open(kind, kind === "search" ? "搜索工作区" : "通知中心"),
      );
    this.search.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => this.term.set(v));
    this.destroy.onDestroy(() => {
      this.draft.dirty = () => false;
      this.draft.discard = () => undefined;
    });
  }
  setScenario(e: Event) {
    const el = e.target as HTMLSelectElement;
    if (this.draft.check()) this.scenario.set(el.value);
    else el.value = this.scenario();
  }
  applyFilters() {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: Object.fromEntries(
        Object.entries(this.filters.getRawValue()).filter(([, v]) => v.trim()),
      ),
    });
  }
  clearFilters() {
    this.filters.reset({ q: "", status: "" });
    this.applyFilters();
  }
  applyTelemetry() {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.telemetry.getRawValue(),
    });
  }
  backParams() {
    return { back: this.router.url };
  }
  back() {
    const q = this.query()["back"];
    const path =
      q?.startsWith("/v3/devices") && !q.includes("//") ? q : "/v3/devices";
    const id = this.id();
    void this.router.navigateByUrl(path).then((ok) => {
      if (ok)
        setTimeout(() =>
          document
            .querySelector<HTMLElement>(`[data-device-id="${id}"]`)
            ?.focus(),
        );
    });
  }
  toggle(id: string, e: Event) {
    this.selected.update((ids) =>
      (e.target as HTMLInputElement).checked
        ? [...new Set([...ids, id])]
        : ids.filter((x) => x !== id),
    );
  }
  all(e: Event) {
    this.selected.set(
      (e.target as HTMLInputElement).checked
        ? this.devices().map((d) => d.id)
        : [],
    );
  }
  count(b: Batch) {
    return b.targets.filter((t) => t.status === "成功").length;
  }
  allow(cap: "write" | "operate" | "govern") {
    if (allowed(this.state().role, cap)) return true;
    this.store.feedback.set("无操作权限：当前身份不能执行此操作。");
    return false;
  }
  open(kind: ModalKind, title: string, id = "", note = "") {
    this.opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    this.modal.set(kind);
    this.title.set(title);
    this.targetId.set(id);
    this.note.set(note);
    this.error.set("");
    this.form.markAsPristine();
    this.modalEvents.next("open");
  }
  close(force = false) {
    if (
      !force &&
      this.form.dirty &&
      !confirm("有未保存的修改。放弃修改并关闭？")
    )
      return;
    this.modal.set(null);
    this.form.markAsPristine();
    this.modalEvents.next("close");
    if (this.opener?.isConnected) this.opener.focus();
  }
  field(
    name: string,
    label: string,
    value = "",
    type = "text",
    required = true,
  ): Field {
    return { name, label, value, type, required };
  }
  options(
    name: string,
    label: string,
    values: string[] | { value: string; label: string }[],
    value = "",
  ): Field {
    const options = values.map((v) =>
      typeof v === "string" ? { value: v, label: v } : v,
    );
    return {
      name,
      label,
      value: value || options[0]?.value || "",
      type: "select",
      required: true,
      options,
    };
  }
  edit(
    action: Action | "reset",
    title: string,
    fields: Field[],
    id = "",
    note = "",
  ) {
    this.action = action;
    this.fields.set(fields);
    this.form = new FormRecord(
      Object.fromEntries(
        fields.map((f) => [
          f.name,
          new FormControl(f.value, { nonNullable: true }),
        ]),
      ),
    );
    this.targetOptions.set([]);
    this.open("form", title, id, note);
  }
  register() {
    if (!this.allow("write")) return;
    this.edit(
      "register",
      "注册新设备",
      [
        this.field("name", "设备名称 *"),
        this.options(
          "product",
          "所属产品",
          this.state().products.map((p) => p.name),
        ),
        this.field("serial", "设备序列号 *"),
        this.options("group", "所属分组", ["华东冷链", "华南仓储", "华东园区"]),
      ],
      "",
      "步骤 1 / 2：保存后进入详情模拟上报；DEMO 身份标识不是真实密钥。",
    );
  }
  editDevice(d: Device) {
    if (!this.allow("write")) return;
    this.edit(
      "edit",
      "编辑设备资料",
      [
        this.field("name", "设备名称 *", d.name),
        this.options(
          "group",
          "所属分组",
          ["华东冷链", "华南仓储", "华东园区"],
          d.group,
        ),
        this.field("tags", "标签（逗号分隔）", d.tags, "text", false),
      ],
      d.id,
    );
  }
  direct(action: Action, id: string) {
    try {
      this.store.execute(action, {}, id);
    } catch (e) {
      this.store.feedback.set(e instanceof Error ? e.message : "操作失败");
    }
  }
  shadow(d: Device) {
    if (!this.allow("operate")) return;
    this.edit(
      "shadow",
      "编辑目标温度",
      [this.field("temp", "targetTemp °C *", String(d.desired), "number")],
      d.id,
    );
  }
  reboot(d: Device) {
    if (!this.allow("operate")) return;
    this.edit(
      "command",
      "确认重启设备",
      [],
      d.id,
      `目标 ${d.name} / ${d.id}；仅模拟回执，不控制真实硬件。`,
    );
  }
  remove() {
    if (!this.allow("write")) return;
    this.edit(
      "delete",
      "确认删除设备",
      [this.field("confirm", "输入 DELETE 确认 *")],
      this.selected().join(","),
      `永久删除 ${this.selected().length} 台本地设备：${this.selected().join("、")}。关联历史保留 ID，不可撤销。`,
    );
  }
  addField(p: Product) {
    if (!this.allow("write")) return;
    this.edit(
      "field",
      "新增物模型属性",
      [
        this.field("name", "属性标识符 *"),
        this.options("type", "类型", ["float", "integer", "boolean", "string"]),
        this.field("unit", "单位", "", "text", false),
      ],
      p.id,
    );
  }
  newRule() {
    if (!this.allow("write")) return;
    this.edit(
      "rule",
      "创建温度阈值规则",
      [
        this.field("name", "规则名称 *"),
        this.field("threshold", "触发阈值 °C *", "30", "number"),
      ],
      "",
      "温度大于阈值时生成待确认告警，仅作用于 ColdSense T200。",
    );
  }
  trial(r: { id: string; threshold: number }) {
    if (!this.allow("operate")) return;
    this.edit(
      "trial",
      "模拟规则输入",
      [
        this.options(
          "device",
          "设备",
          this.cold().map((d) => ({ value: d.id, label: d.name })),
        ),
        this.field("temp", "模拟温度 °C *", String(r.threshold + 2), "number"),
      ],
      r.id,
    );
  }
  ack(a: Alarm) {
    if (!this.allow("operate")) return;
    this.edit(
      "ack",
      "确认并分派告警",
      [
        this.options(
          "owner",
          "负责人 *",
          this.state()
            .members.filter((m) => m.status === "已加入")
            .map((m) => m.name),
        ),
        this.field("note", "初步处理说明 *", "", "textarea"),
      ],
      a.id,
    );
  }
  resolve(a: Alarm) {
    if (!this.allow("operate")) return;
    this.edit(
      "resolve",
      "解决告警",
      [this.field("note", "解决原因 *", "", "textarea")],
      a.id,
      "解决后记录只读保留，请说明根因与恢复措施。",
    );
  }
  newBatch() {
    if (!this.allow("write")) return;
    this.edit(
      "batch",
      "创建升级批次",
      [this.field("name", "批次名称 *", "冷链稳定性更新")],
      "",
      "目标固件 ColdSense T200 · 2.3.1。仅选择在线兼容设备，最后一台首次校验超时。",
    );
    const ds = this.cold().filter((d) => d.status === "在线");
    this.targetOptions.set(ds);
    this.targetIds = ds.map((d) => d.id);
  }
  target(id: string, e: Event) {
    this.targetIds = (e.target as HTMLInputElement).checked
      ? [...new Set([...this.targetIds, id])]
      : this.targetIds.filter((x) => x !== id);
    this.form.markAsDirty();
  }
  retry(b: Batch) {
    if (!this.allow("operate")) return;
    this.edit(
      "retry",
      "仅重试失败设备",
      [this.field("reason", "重试原因 *", "", "textarea")],
      b.id,
      `仅重试 ${b.targets
        .filter((t) => t.status === "失败")
        .map((t) => t.device)
        .join("、")}，成功项不重复执行。`,
    );
  }
  invite() {
    if (!this.allow("govern")) return;
    this.edit(
      "invite",
      "邀请工作区成员",
      [
        this.field("name", "姓名 *"),
        this.field("email", "演示邮箱 *", "", "email"),
        this.options("role", "角色", [
          "运维工程师",
          "数据观察员",
          "租户管理员",
        ]),
      ],
      "",
      "只保存本地邀请记录，不发送邮件。",
    );
  }
  member(id: string, name: string, role: string) {
    if (!this.allow("govern")) return;
    this.edit(
      "member",
      "分配成员角色",
      [
        this.options(
          "role",
          "新角色",
          ["租户管理员", "运维工程师", "数据观察员"],
          role,
        ),
      ],
      id,
      `${name}；不改变右上角当前操作者身份。`,
    );
  }
  quota() {
    if (!this.allow("govern")) return;
    this.edit(
      "quota",
      "调整设备配额",
      [this.field("quota", "设备配额 *", String(this.state().quota), "number")],
      "",
      `当前使用 ${this.state().devices.length} 台，配额不可低于用量。`,
    );
  }
  reset() {
    if (!this.draft.check()) return;
    this.edit(
      "reset",
      "重置本地演示",
      [],
      "",
      "清除本工作区新建记录，恢复固定样例；不影响兼容教学区或其他应用。",
    );
  }
  maxLength(f: Field) {
    if (f.name === "name")
      return this.action === "invite"
        ? 30
        : this.action === "field"
          ? 31
          : ["register", "edit"].includes(this.action || "")
            ? 48
            : 50;
    return f.name === "unit"
      ? 12
      : f.name === "serial"
        ? 40
        : f.type === "textarea"
          ? this.action === "resolve"
            ? 300
            : 200
          : 80;
  }
  submit() {
    this.error.set("");
    try {
      const a = this.action;
      if (!a) return;
      if (a === "reset") {
        this.store.reset();
        this.close(true);
        void this.router.navigateByUrl("/v3/workspace");
        return;
      }
      const id = this.store.execute(
        a,
        { ...this.form.getRawValue(), targets: this.targetIds.join(",") },
        this.targetId(),
      );
      this.close(true);
      this.selected.set([]);
      if (a === "register") void this.router.navigate(["/v3/devices", id]);
      if (a === "trial" && id.startsWith("ALM"))
        void this.router.navigateByUrl("/v3/alarms");
      if (["ack", "resolve"].includes(a)) this.open("alarm", "告警处置", id);
      if (["batch", "retry"].includes(a)) this.open("batch", "升级进度", id);
      if (a === "field") this.open("product", "产品物模型", id);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : "保存失败，草稿已保留。");
    }
  }
  savePrefs() {
    try {
      this.store.execute("prefs", this.prefs.getRawValue());
      this.prefs.markAsPristine();
    } catch (e) {
      this.store.feedback.set(e instanceof Error ? e.message : "保存失败");
    }
  }
  connect(protocol: string) {
    try {
      this.store.execute("connect", {}, protocol);
      this.open(
        "info",
        "连接测试 · 模拟结果",
        "",
        `${protocol} 模拟握手成功 · 固定延迟 42 ms。未发起真实网络请求，凭据未配置 / 未验证。`,
      );
    } catch (e) {
      this.store.feedback.set(e instanceof Error ? e.message : "操作失败");
    }
  }
  download() {
    const csv =
      "\ufeff时间,温度°C,质量\n" +
      this.points()
        .map(([t, v]) => `${t},${v},有效`)
        .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "iot-atlas-demo-telemetry.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.store.feedback.set("当前已应用查询结果已导出（模拟数据）。");
  }
  follow(url: string) {
    this.close(true);
    void this.router.navigateByUrl(url);
  }
}
