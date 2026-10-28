import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
const names = [
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
async function nav(p: Page, name: string) {
  const button = p.getByRole("button", { name: "导航菜单" });
  if (await button.isVisible()) await button.click();
  await p
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name, exact: true })
    .click();
}
const modal = (p: Page) => p.getByRole("dialog");
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("14 native routes preserve shell, current-route mobile close and rendering", async ({
  page,
}, info) => {
  await expect(page.locator(".toast")).toHaveCount(0);
  const shell = await page.getByTestId("v3-shell").elementHandle();
  const menu = page.getByRole("button", { name: "导航菜单" });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(page.getByRole("button", { name: "关闭导航" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
      page
        .getByRole("navigation", { name: "主导航" })
        .getByRole("link", { name: "学习与交付", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "关闭导航" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
  }
  for (const name of names) {
    await nav(page, name);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await shell?.evaluate((el) => el.isConnected)).toBe(true);
    if (await menu.isVisible())
      await expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await nav(page, "工作区");
  await page.screenshot({
    path: `reports/v3-rebuild/workspace-${info.project.name}.png`,
    fullPage: true,
  });
  await nav(page, "设备中心");
  await page.screenshot({
    path: `reports/v3-rebuild/devices-${info.project.name}.png`,
    fullPage: true,
  });
});
for (const name of names) {
  test(`recoverable exception states and accessibility: ${name}`, async ({
    page,
  }) => {
    await nav(page, name);
    const shell = await page.getByTestId("v3-shell").elementHandle();
    for (const state of ["loading", "empty", "error", "forbidden"]) {
      await page.getByLabel("页面状态").selectOption(state);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await shell?.evaluate((el) => el.isConnected)).toBe(true);
      await page
        .getByRole("button", {
          name: state === "error" ? "重试" : "返回正常数据",
          exact: true,
        })
        .click();
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
}
test("register, ingest, shadow, command, URL restoration and return focus", async ({
  page,
}) => {
  await nav(page, "设备中心");
  await page.getByRole("button", { name: "＋ 注册设备" }).click();
  await modal(page).getByLabel("设备名称").fill("验证冷链");
  await modal(page).getByLabel("设备序列号").fill("E2E-001");
  await modal(page).getByRole("button", { name: "保存并进入接入" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("验证冷链");
  await page.getByRole("button", { name: "模拟上报", exact: true }).click();
  await page.getByRole("link", { name: "设备影子", exact: true }).click();
  await page.getByRole("button", { name: "编辑目标温度" }).click();
  await modal(page).getByLabel("targetTemp").fill("18");
  await modal(page).getByRole("button", { name: "确认保存" }).click();
  await page.getByRole("button", { name: "模拟设备同步" }).click();
  await expect(page.getByText("已同步", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "远程命令" }).click();
  await page.getByRole("button", { name: "发送重启命令" }).click();
  await modal(page).getByRole("button", { name: "确认模拟重启" }).click();
  await page.getByRole("link", { name: "诊断日志" }).click();
  await expect(page.getByText(/命令 reboot/)).toBeVisible();
  await page.getByRole("button", { name: "返回列表" }).click();
  await page.getByLabel("搜索名称").fill("验证冷链");
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await page.getByRole("link", { name: "验证冷链", exact: true }).click();
  await page.getByRole("button", { name: "返回列表" }).click();
  await expect(page.getByLabel("搜索名称")).toHaveValue("验证冷链");
  await expect(
    page.getByRole("link", { name: "验证冷链", exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "验证冷链", exact: true }),
  ).toBeVisible();
});
test("rule input produces assigned and resolved alarm with audit", async ({
  page,
}) => {
  await nav(page, "规则与场景");
  await page.getByRole("button", { name: "＋ 创建规则" }).click();
  await modal(page).getByLabel("规则名称").fill("E2E高温");
  await modal(page).getByRole("button", { name: "创建并启用" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "E2E高温" })
    .getByRole("button", { name: "模拟输入" })
    .click();
  await modal(page).getByRole("button", { name: "运行一次" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "E2E高温" })
    .getByRole("button")
    .click();
  await modal(page).getByRole("button", { name: "确认并分派" }).click();
  await modal(page).getByLabel("初步处理说明").fill("现场检查中");
  await modal(page)
    .getByRole("button", { name: "确认告警", exact: true })
    .click();
  await modal(page).getByRole("button", { name: "解决告警" }).click();
  await modal(page).getByLabel("解决原因").fill("现场温控修复后恢复正常");
  await modal(page).getByRole("button", { name: "确认解决" }).click();
  await expect(modal(page).getByText("已解决", { exact: true })).toBeVisible();
  await modal(page).getByRole("button", { name: "关闭对话框" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "E2E高温" }).getByRole("button"),
  ).toBeFocused();
  await nav(page, "审计与运维");
  await expect(
    page.getByRole("cell", { name: "解决告警", exact: true }),
  ).toBeVisible();
});
test("OTA partial failure and retry preserves successful attempt counts", async ({
  page,
}) => {
  await nav(page, "固件与 OTA");
  await page.getByRole("button", { name: "＋ 创建升级批次" }).click();
  await modal(page).getByRole("button", { name: "确认范围并创建" }).click();
  await modal(page).getByRole("button", { name: "开始模拟升级" }).click();
  await modal(page).getByRole("button", { name: "推进模拟进度" }).click();
  await expect(
    modal(page).getByText("部分失败", { exact: true }),
  ).toBeVisible();
  await modal(page).getByRole("button", { name: "仅重试失败设备" }).click();
  await modal(page).getByLabel("重试原因").fill("网络恢复确认后重新升级");
  await modal(page).getByRole("button", { name: "确认重试" }).click();
  await modal(page).getByRole("button", { name: "推进模拟进度" }).click();
  await expect(modal(page).getByText("完成", { exact: true })).toBeVisible();
  const rows = modal(page)
    .getByRole("region", { name: "升级目标" })
    .getByRole("row");
  await expect(rows.nth(1).getByRole("cell").last()).toHaveText("1");
  await expect(rows.last().getByRole("cell").last()).toHaveText("2");
});
test("governance invitation, role, quota and viewer denial", async ({
  page,
}) => {
  await nav(page, "租户与成员");
  await page.getByRole("button", { name: "＋ 邀请成员" }).click();
  await modal(page).getByLabel("姓名").fill("测试成员");
  await modal(page).getByLabel("演示邮箱").fill("new@example.invalid");
  await modal(page).getByRole("button", { name: "创建模拟邀请" }).click();
  const row = page.getByRole("row").filter({ hasText: "测试成员" });
  await expect(row).toContainText("已邀请");
  await row.getByRole("button", { name: "分配角色" }).click();
  await modal(page).getByLabel("新角色").selectOption("租户管理员");
  await modal(page).getByRole("button", { name: "确认角色变更" }).click();
  await expect(row).toContainText("租户管理员");
  await page.getByRole("button", { name: "调整设备配额" }).click();
  await modal(page).getByLabel("设备配额").fill("4");
  await modal(page).getByRole("button", { name: "保存配额" }).click();
  await expect(modal(page).getByRole("alert")).toContainText("配额");
  await modal(page).getByLabel("设备配额").fill("10");
  await modal(page).getByRole("button", { name: "保存配额" }).click();
  await page.getByLabel("模拟身份").selectOption("viewer");
  await expect(
    page.getByRole("heading", { name: "没有治理权限" }),
  ).toBeVisible();
  await nav(page, "设备中心");
  await page.getByRole("button", { name: "＋ 注册设备" }).click();
  await expect(page.getByRole("status")).toContainText("无操作权限");
  await expect(modal(page)).toHaveCount(0);
});
test("dirty modal back, Escape decisions, focus and clean forward", async ({
  page,
}) => {
  await nav(page, "设备中心");
  await page.getByRole("link", { name: "冷链温控 · 01", exact: true }).click();
  await page.getByRole("button", { name: "编辑资料" }).click();
  await modal(page).getByLabel("设备名称").fill("未保存");
  page.once("dialog", (d) => d.dismiss());
  await page.goBack();
  await expect(modal(page).getByLabel("设备名称")).toHaveValue("未保存");
  page.once("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "编辑资料" })).toBeFocused();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("设备中心");
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "冷链温控 · 01",
  );
});
test("dirty settings link/forward and refresh decisions, unknown route recovery", async ({
  page,
}) => {
  await nav(page, "设置与集成");
  await nav(page, "设备中心");
  await page.goBack();
  await page.getByLabel("工作区内通知").selectOption("false");
  page.once("dialog", (d) => d.dismiss());
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "设置与集成",
  );
  page.once("dialog", (d) => d.accept());
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("设备中心");
  await nav(page, "设置与集成");
  await page.getByLabel("工作区内通知").selectOption("false");
  page.once("dialog", (d) => d.dismiss());
  await nav(page, "设备中心");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "设置与集成",
  );
  const menu = page.getByRole("button", { name: "关闭导航" });
  if (await menu.isVisible()) await menu.click();
  page.once("dialog", (d) => d.dismiss());
  await page.reload({ timeout: 2000 }).catch(() => undefined);
  await expect(page.getByLabel("工作区内通知")).toHaveValue("false");
  page.once("dialog", (d) => d.accept());
  await page.reload();
  await expect(page.getByLabel("工作区内通知")).toHaveValue("true");
  await page.getByLabel("工作区内通知").selectOption("false");
  page.once("dialog", (d) => d.dismiss());
  await page.goto("/v3/missing", { timeout: 2000 }).catch(() => undefined);
  await expect(page.getByLabel("工作区内通知")).toHaveValue("false");
  page.once("dialog", (d) => d.accept());
  await page.goto("/v3/missing");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "页面不存在",
  );
  await expect(page.getByTestId("v3-shell")).toBeVisible();
  await page.getByRole("link", { name: "返回工作区", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("巡检");
});
test("applied CSV ignores draft; global search and read-only electric detail", async ({
  page,
}) => {
  await nav(page, "时序数据");
  await page.getByLabel("查询窗口").selectOption("15");
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "时序数据" }).getByRole("row"),
  ).toHaveCount(3);
  await page.getByLabel("查询窗口").selectOption("45");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 CSV" }).click();
  const path = await (await download).path();
  const csv = await readFile(path!, "utf8");
  expect(csv.trim().split("\n")).toHaveLength(3);
  expect(csv).not.toContain("08:00");
  await page.getByRole("button", { name: "搜索设备、规则、页面" }).click();
  await modal(page).getByLabel("搜索页面、设备或规则").fill("不存在数据");
  await expect(modal(page).getByText(/没有找到/)).toBeVisible();
  await modal(page).getByLabel("搜索页面、设备或规则").fill("DEV-1004");
  await modal(page)
    .getByRole("button", { name: /智能电表/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "电表属性样例" }),
  ).toBeVisible();
  await expect(page.getByText("420.8 kWh")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "模拟上报", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "设备影子" })).toHaveCount(0);
});
test("product attributes, connector and node details, settings notifications and audit filter", async ({
  page,
}) => {
  await nav(page, "产品与物模型");
  await page
    .getByRole("row")
    .filter({ hasText: "ColdSense T200" })
    .getByRole("button")
    .click();
  await modal(page).getByRole("button", { name: "新增属性" }).click();
  await modal(page).getByLabel("属性标识符").fill("batteryLevel");
  await modal(page).getByLabel("单位", { exact: true }).fill("%");
  await modal(page).getByRole("button", { name: "确认保存" }).click();
  await expect(
    modal(page).getByRole("cell", { name: "batteryLevel" }),
  ).toBeVisible();
  await modal(page).getByRole("button", { name: "关闭对话框" }).click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "ColdSense T200" })
      .getByRole("button"),
  ).toBeFocused();
  await nav(page, "连接与转发");
  await page.getByRole("button", { name: "测试连接" }).first().click();
  await expect(modal(page).getByText(/未发起真实网络/)).toBeVisible();
  await modal(page).getByRole("button", { name: "关闭对话框" }).click();
  await nav(page, "全球节点");
  await page.getByRole("button", { name: "查看节点" }).first().click();
  await expect(modal(page).getByRole("heading")).toContainText("华东");
  await modal(page).getByRole("button", { name: "关闭对话框" }).click();
  await nav(page, "设置与集成");
  await page.getByLabel("工作区内通知").selectOption("false");
  await page.getByRole("button", { name: "保存偏好" }).click();
  await page.getByRole("button", { name: "通知中心" }).click();
  await expect(modal(page).getByText("工作区通知已关闭。")).toBeVisible();
  await modal(page).getByRole("button", { name: "关闭对话框" }).click();
  await nav(page, "审计与运维");
  await page.getByLabel("搜索操作或对象").fill("新增物模型");
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "审计记录" }).getByRole("row"),
  ).toHaveCount(2);
});
