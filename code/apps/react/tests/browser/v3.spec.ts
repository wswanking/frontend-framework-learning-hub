import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
const titles = [
  "工作区",
  "告警中心",
  "时序数据",
  "全球节点",
  "设备中心",
  "产品与物模型",
  "规则与场景",
  "固件与 OTA",
  "连接与转发",
  "租户与成员",
  "角色与权限",
  "审计与运维",
  "设置与集成",
  "学习与交付",
];
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on("pageerror", (e) => messages.push(e.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));
async function clickNav(page: Page, name: string) {
  const toggle = page.getByRole("button", { name: "打开导航" });
  if (
    (await toggle.isVisible()) &&
    (await toggle.getAttribute("aria-expanded")) !== "true"
  )
    await toggle.click();
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name, exact: true })
    .click();
}
async function nav(page: Page, name: string) {
  await clickNav(page, name);
  // The shell select stays mounted while a router transition commits.
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: name === "工作区" ? /^(工作区|早上好，开始今天的运行巡检)$/ : name,
      exact: true,
    }),
  ).toBeVisible();
}
async function prompt(
  page: Page,
  accept: boolean,
  action: () => Promise<unknown>,
) {
  const handled = page
    .waitForEvent("dialog")
    .then((d) => (accept ? d.accept() : d.dismiss()));
  await action();
  await handled;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
}

test("V3 provisioning, metadata, shadow, command and applied-query CSV", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page).toHaveURL(/v3\/workspace/);
  let documents = 0;
  page.on("request", (r) => {
    if (r.resourceType() === "document") documents++;
  });
  const shell = await page.getByTestId("v3-shell").elementHandle();
  await nav(page, "设备中心");
  await page.getByRole("button", { name: "＋ 注册设备", exact: true }).click();
  await page.getByLabel("设备名称").fill("验证温控");
  await page.getByLabel("设备序列号").fill("VERIFY-001");
  await page.getByRole("button", { name: "保存并进入接入" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("验证温控");
  await expect(page.getByText("待接入", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "模拟上报", exact: true }).click();
  await page.getByRole("button", { name: "编辑资料" }).click();
  await page.getByLabel("设备名称").fill("验证温控 · 已编辑");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "验证温控 · 已编辑",
  );
  await page.getByRole("link", { name: "设备影子", exact: true }).click();
  await page.getByRole("button", { name: "编辑目标温度", exact: true }).click();
  await page.getByLabel("targetTemp").fill("25");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("待同步", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "模拟设备同步" }).click();
  await expect(page.getByText("已同步", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `reports/v3-rebuild/screenshots/${info.project.name}-device-shadow.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "远程命令" }).click();
  await page.getByRole("button", { name: "发送重启命令" }).click();
  await page.getByRole("button", { name: "确认模拟重启" }).click();
  await page.getByRole("link", { name: "诊断日志" }).click();
  await expect(page.getByRole("cell", { name: /reboot/ })).toBeVisible();
  await nav(page, "时序数据");
  await page.getByLabel("查询窗口").selectOption("15");
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel("查询窗口").selectOption("45");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 CSV" }).click();
  const file = await download,
    csv = await readFile((await file.path())!, "utf8");
  expect(file.suggestedFilename()).toContain("telemetry.csv");
  expect(csv.trim().split("\n")).toHaveLength(3);
  expect(csv).not.toContain("08:00");
  expect(documents).toBe(0);
  expect(
    await shell!.evaluate(
      (el) => el === document.querySelector('[data-testid="v3-shell"]'),
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(2);
});

test("V3 rule-to-alarm lifecycle preserves owner, reason and audit", async ({
  page,
}) => {
  await page.goto("/v3/rules");
  await page.getByRole("button", { name: "＋ 创建规则" }).click();
  await page.getByLabel("规则名称").fill("验证高温规则");
  await page.getByLabel("触发阈值").fill("28");
  await page.getByRole("button", { name: "创建并启用" }).click();
  const row = page.getByRole("row").filter({ hasText: "验证高温规则" });
  await row.getByRole("button", { name: "模拟输入" }).click();
  await page.getByRole("button", { name: "运行一次" }).click();
  await expect(page).toHaveURL(/alarms/);
  await page
    .getByRole("row")
    .filter({ hasText: "验证高温规则" })
    .getByRole("button", { name: "查看与处理" })
    .click();
  await page.getByRole("button", { name: "确认并分派" }).click();
  await page.getByLabel("负责人").selectOption("周远");
  await page.getByLabel("初步处理说明").fill("检查现场温控设备");
  await page.getByRole("button", { name: "确认告警" }).click();
  await expect(page.getByRole("dialog")).toContainText("周远");
  await page.getByRole("button", { name: "解决告警", exact: true }).click();
  await page.getByLabel("解决原因").fill("现场温度已经恢复正常范围");
  await page.getByRole("button", { name: "确认解决" }).click();
  await expect(page.getByRole("dialog")).toContainText("已解决");
  await expect(page.getByRole("dialog")).toContainText(
    "现场温度已经恢复正常范围",
  );
  await page.keyboard.press("Escape");
  await nav(page, "审计与运维");
  await expect(
    page.getByRole("cell", { name: "解决告警", exact: true }),
  ).toBeVisible();
});

test("V3 OTA failure/retry changes only failed attempts and operator permissions", async ({
  page,
}, info) => {
  await page.goto("/v3/ota");
  await page.getByRole("button", { name: "＋ 创建升级批次" }).click();
  await page.getByRole("button", { name: "确认范围并创建" }).click();
  await page.keyboard.press("Escape");
  await page.getByLabel("模拟身份").selectOption("operator");
  await page.getByRole("button", { name: "查看进度" }).click();
  await page.getByRole("button", { name: "开始模拟升级" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "无操作权限",
  );
  await page.keyboard.press("Escape");
  await page.getByLabel("模拟身份").selectOption("platformAdmin");
  await page.getByRole("button", { name: "查看进度" }).click();
  await page.getByRole("button", { name: "开始模拟升级" }).click();
  await page.getByRole("button", { name: "推进模拟进度" }).click();
  await expect(page.getByRole("dialog")).toContainText("部分失败");
  await page.screenshot({
    path: `reports/v3-rebuild/screenshots/${info.project.name}-ota-failure.png`,
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.getByLabel("模拟身份").selectOption("operator");
  await page.getByRole("button", { name: "查看进度" }).click();
  await page.getByRole("button", { name: "仅重试失败设备" }).click();
  await page.getByLabel("重试原因").fill("网络恢复后重新执行");
  await page.getByRole("button", { name: "确认重试" }).click();
  await page.getByRole("button", { name: "推进模拟进度" }).click();
  await expect(page.getByRole("dialog")).toContainText("完成");
  const targets = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("iot-atlas-react-v3")!).batches[0]
        .targets,
  );
  expect(targets.map((t: { attempts: number }) => t.attempts)).toEqual([
    1, 1, 2,
  ]);
});

test("V3 members, quota validation and viewer write denial", async ({
  page,
}) => {
  await page.goto("/v3/tenants");
  await page.getByRole("button", { name: "＋ 邀请成员" }).click();
  await page.getByLabel("姓名").fill("验证成员");
  await page.getByLabel("演示邮箱").fill("verify@example.invalid");
  await page.getByRole("button", { name: "创建模拟邀请" }).click();
  const row = page
    .getByRole("row")
    .filter({ hasText: "verify@example.invalid" });
  await expect(row).toContainText("已邀请");
  await row.getByRole("button", { name: "分配角色" }).click();
  await page.getByLabel("新角色").selectOption("租户管理员");
  await page.getByRole("button", { name: "确认角色变更" }).click();
  await expect(row).toContainText("租户管理员");
  await page.getByRole("button", { name: "调整设备配额" }).click();
  const quota = page.getByRole("spinbutton", {
    name: "设备配额 *",
    exact: true,
  });
  await quota.fill("4");
  await page.getByRole("button", { name: "保存配额" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "不能低于",
  );
  await expect(quota).toHaveValue("4");
  await quota.fill("5");
  await page.getByRole("button", { name: "保存配额" }).click();
  await page.getByLabel("模拟身份").selectOption("viewer");
  await expect(page.getByText("没有治理权限", { exact: true })).toBeVisible();
  await nav(page, "设备中心");
  await page.getByRole("button", { name: "＋ 注册设备" }).click();
  await expect(page.getByRole("status")).toContainText("无操作权限");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("V3 all 14 modules keep the shell across all 56 exception states", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  await page.goto("/v3/workspace");
  const shell = await page.getByTestId("v3-shell").elementHandle();
  await page.getByLabel("页面状态").selectOption("loading");
  await nav(page, "工作区");
  await expect(
    page.getByRole("heading", { name: "正在加载工作区", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("页面状态")).toHaveValue("loading");
  await page.getByRole("button", { name: "结束模拟加载" }).click();
  const states: { [key: string]: string } = {
    loading: "正在加载工作区",
    empty: "这里还没有数据",
    error: "数据暂时不可用",
    forbidden: "没有查看权限",
  };
  for (const name of titles) {
    await nav(page, name);
    for (const [state, title] of Object.entries(states)) {
      await page.getByLabel("页面状态").selectOption(state);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      expect(
        await shell!.evaluate(
          (el) => el === document.querySelector('[data-testid="v3-shell"]'),
        ),
      ).toBe(true);
      await page
        .getByRole("main")
        .getByRole("button", {
          name:
            state === "loading"
              ? "结束模拟加载"
              : state === "empty"
                ? "返回正常数据"
                : state === "error"
                  ? "重试"
                  : "返回可见页面",
          exact: true,
        })
        .click();
    }
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      name === "工作区" ? "早上好，开始今天的运行巡检" : name,
    );
  }
  await nav(page, "工作区");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page.locator(".v3 .toast")).not.toBeVisible();
  await page.screenshot({
    path: `reports/v3-rebuild/screenshots/${info.project.name}-workspace.png`,
    fullPage: true,
  });
  await nav(page, "设备中心");
  await page.screenshot({
    path: `reports/v3-rebuild/screenshots/${info.project.name}-devices.png`,
    fullPage: true,
  });
});

test("V3 list filter restoration, modal keyboard focus and saved-form guard does not leak", async ({
  page,
}) => {
  await page.goto("/v3/devices");
  await page.getByLabel("搜索名称、ID、分组或标签").fill("DEV-1001");
  await page.getByRole("button", { name: "应用", exact: true }).click();
  const deviceLink = page.locator('[data-device-link="DEV-1001"]');
  await deviceLink.click();
  await page.getByRole("button", { name: "返回列表" }).click();
  await expect(page.getByLabel("搜索名称、ID、分组或标签")).toHaveValue(
    "DEV-1001",
  );
  await expect(deviceLink).toBeFocused();
  await deviceLink.click();
  await page.getByRole("button", { name: "编辑资料" }).click();
  await page.getByLabel("设备名称").fill("已保存温控");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "编辑资料" }).click();
  await page.getByLabel("设备名称").fill("下一份未保存草稿");
  await prompt(page, false, () => page.evaluate(() => history.back()));
  await expect(page.getByLabel("设备名称")).toHaveValue("下一份未保存草稿");
  await prompt(page, false, () => page.keyboard.press("Escape"));
  await expect(page.getByRole("dialog")).toBeVisible();
  const buttons = page.getByRole("dialog").getByRole("button");
  await buttons.last().focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "关闭对话框" })).toBeFocused();
  await prompt(page, true, () => page.keyboard.press("Escape"));
  await expect(page.getByRole("button", { name: "编辑资料" })).toBeFocused();
});

test("V3 dirty back, forward, unknown route and native refresh cancel/accept", async ({
  page,
}) => {
  await page.goto("/v3/unknown");
  const shell = await page.getByTestId("v3-shell").elementHandle();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "页面不存在",
  );
  await nav(page, "设置与集成");
  const draft = page.getByLabel("邮件摘要偏好（仅保存意向）");
  await draft.check();
  await prompt(page, false, () => page.evaluate(() => history.back()));
  await expect(draft).toBeChecked();
  await expect(page).toHaveURL(/settings/);
  await prompt(page, true, () => page.evaluate(() => history.back()));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "页面不存在",
  );
  expect(await shell!.evaluate((el) => el.isConnected)).toBe(true);
  await page.goForward();
  await expect(draft).not.toBeChecked();
  await nav(page, "产品与物模型");
  await page.goBack();
  await draft.check();
  await prompt(page, false, () => page.evaluate(() => history.forward()));
  await expect(draft).toBeChecked();
  await prompt(page, true, () => page.evaluate(() => history.forward()));
  await expect(page).toHaveURL(/products/);
  await nav(page, "设置与集成");
  await draft.check();
  const canceled = page.waitForEvent("dialog");
  await page.evaluate(() => {
    setTimeout(() => location.reload(), 0);
  });
  const cancelDialog = await canceled;
  expect(cancelDialog.type()).toBe("beforeunload");
  await cancelDialog.dismiss();
  await expect(draft).toBeChecked();
  const accepted = page.waitForEvent("dialog");
  await page.evaluate(() => {
    setTimeout(() => location.reload(), 0);
  });
  const acceptDialog = await accepted;
  expect(acceptDialog.type()).toBe("beforeunload");
  await acceptDialog.accept();
  await page.waitForLoadState("domcontentloaded");
  await expect(draft).not.toBeChecked();
});

test("V3 identity/search discard destroys drafts and leaves future guards active", async ({
  page,
}) => {
  await page.goto("/v3/settings");
  const draft = page.getByLabel("邮件摘要偏好（仅保存意向）");
  await draft.check();
  await prompt(page, false, () =>
    page.getByLabel("模拟身份").selectOption("viewer"),
  );
  await expect(draft).toBeChecked();
  await expect(page.getByLabel("模拟身份")).toHaveValue("platformAdmin");
  await prompt(page, true, () =>
    page.getByLabel("模拟身份").selectOption("viewer"),
  );
  await expect(draft).not.toBeChecked();
  await page.getByLabel("模拟身份").selectOption("platformAdmin");
  await draft.check();
  await prompt(page, true, () =>
    page.getByRole("button", { name: "全局搜索" }).click(),
  );
  await page.keyboard.press("Escape");
  await expect(draft).not.toBeChecked();
  await draft.check();
  await prompt(page, false, () => clickNav(page, "设备中心"));
  await expect(page).toHaveURL(/settings/);
  await page.getByRole("button", { name: "保存偏好" }).click();
  await draft.uncheck();
  await prompt(page, false, () => clickNav(page, "设备中心"));
  await expect(page).toHaveURL(/settings/);
  await page.getByRole("button", { name: "保存偏好" }).click();
});

test("V3 model attributes, connectors, nodes, search and notifications are interactive", async ({
  page,
}) => {
  await page.goto("/v3/products");
  await page.getByRole("button", { name: "查看物模型" }).first().click();
  await page.getByRole("button", { name: "新增属性" }).click();
  await page.getByLabel("属性标识符").fill("pressure");
  await page.getByLabel("单位", { exact: true }).fill("Pa");
  await page.getByRole("button", { name: "添加属性" }).click();
  await expect(page.getByRole("dialog")).toContainText("pressure");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await nav(page, "连接与转发");
  await page.getByRole("button", { name: "测试连接" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("未发起真实网络请求");
  await page.keyboard.press("Escape");
  await nav(page, "审计与运维");
  await expect(
    page.getByRole("cell", { name: "模拟连接测试", exact: true }),
  ).toBeVisible();
  await nav(page, "全球节点");
  await page.getByRole("button", { name: "查看节点" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("华东 · 上海");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "全局搜索" }).click();
  await page.getByLabel("搜索页面、设备或规则").fill("NO-SUCH-ITEM");
  await expect(page.getByRole("dialog")).toContainText("没有搜索结果");
  await page.getByLabel("搜索页面、设备或规则").fill("DEV-1004");
  await page.getByRole("dialog").getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "智能电表 · A1",
  );
  await expect(
    page.getByRole("button", { name: "模拟上报", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "设备影子", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "通知中心" }).click();
  await page.getByRole("link", { name: "前往告警中心 →" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("告警中心");
});

test("V3 bulk delete requires confirmation and clears removed selections", async ({
  page,
}) => {
  await page.goto("/v3/devices");
  await page
    .getByRole("checkbox", { name: "选择 冷链温控 · 01", exact: true })
    .check();
  await page.getByRole("button", { name: "删除所选" }).click();
  await expect(page.getByRole("dialog")).toContainText("DEV-1001");
  await page.getByLabel("输入 DELETE 确认").fill("DELETE");
  await page.getByRole("button", { name: "删除 1 台设备" }).click();
  await expect(page.locator('[data-device-link="DEV-1001"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "删除所选" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-device-link="DEV-1001"]')).toHaveCount(0);
});

test("V3 corrupt persistence recovers, denied persistence is reported honestly", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "iot-atlas-react-v3",
      JSON.stringify({
        schema: 1,
        role: "platformAdmin",
        devices: [],
        audit: [],
      }),
    ),
  );
  await page.goto("/v3/workspace");
  await expect(page.getByRole("link", { name: /冷链温控 · 01/ })).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "iot-atlas-react-v3") throw new Error("quota test");
      original.call(this, key, value);
    };
  });
  await nav(page, "规则与场景");
  await page.getByRole("button", { name: "＋ 创建规则" }).click();
  await page.getByLabel("规则名称").fill("仅会话保留");
  await page.getByRole("button", { name: "创建并启用" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "仅会话保留" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("修改仅在本次打开保留");
});
