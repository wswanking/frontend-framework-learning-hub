import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const modal = (p: Page) => p.getByRole("dialog");
async function go(p: Page, name: string) {
  const menu = p.getByRole("button", { name: "打开导航" });
  if (
    (await menu.isVisible()) &&
    (await menu.getAttribute("aria-expanded")) !== "true"
  )
    await menu.click();
  await p
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name, exact: true })
    .click();
}
const modules = [
  "workspace",
  "alarms",
  "telemetry",
  "nodes",
  "devices",
  "products",
  "rules",
  "ota",
  "connectors",
  "tenants",
  "access",
  "audit",
  "settings",
  "learning",
];
test("V3 provisioning metadata telemetry shadow command and filtered return", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/v3\/workspace/);
  await page.evaluate(() => {
    (window as unknown as { marker: number }).marker = 17;
  });
  await go(page, "设备中心");
  await page.getByRole("button", { name: "注册设备" }).click();
  await modal(page).getByLabel("设备名称").fill("测试冷链");
  await modal(page).getByLabel("设备序列号").fill("CH-TEST-101");
  await modal(page).getByRole("button", { name: "保存并进入接入" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("测试冷链");
  await page.getByRole("button", { name: "模拟上报", exact: true }).click();
  await page.getByRole("link", { name: "设备影子", exact: true }).click();
  await page.getByRole("button", { name: "编辑目标温度" }).click();
  await modal(page).getByLabel("targetTemp").fill("18");
  await modal(page).getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "模拟设备同步" }).click();
  await expect(page.getByRole("main")).toContainText("18 °C");
  await page.getByRole("link", { name: "远程命令", exact: true }).click();
  await page.getByRole("button", { name: "发送重启命令" }).click();
  await modal(page).getByRole("button", { name: "确认模拟重启" }).click();
  await page.getByRole("link", { name: "诊断日志", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("SUCCESS");
  await page.getByRole("button", { name: "返回列表" }).click();
  await page.getByLabel("搜索名称").fill("测试冷链");
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await page.getByRole("link", { name: "测试冷链 CH-TEST-101" }).click();
  await page.getByRole("button", { name: "编辑资料" }).click();
  await modal(page).getByLabel("标签").fill("已验证");
  await modal(page).getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "返回列表" }).click();
  await expect(page.getByLabel("搜索名称")).toHaveValue("测试冷链");
  await expect(
    page.getByRole("link", { name: "测试冷链 CH-TEST-101" }),
  ).toBeFocused();
  expect(
    await page.evaluate(() => (window as unknown as { marker: number }).marker),
  ).toBe(17);
  await page.reload();
  await expect(page.getByRole("table")).toContainText("已验证");
});
test("V3 rule creates alarm with ordered acknowledge and resolve", async ({
  page,
}) => {
  await page.goto("/v3/rules");
  await page.getByRole("button", { name: "创建规则" }).click();
  await modal(page).getByLabel("规则名称").fill("新阈值规则");
  await modal(page).getByLabel("触发阈值").fill("29");
  await modal(page).getByRole("button", { name: "创建并启用" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "新阈值规则" })
    .getByRole("button", { name: "模拟输入" })
    .click();
  await modal(page).getByRole("button", { name: "运行一次" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "新阈值规则" })
    .getByRole("button", { name: "查看与处理" })
    .click();
  await modal(page).getByRole("button", { name: "确认并分派" }).click();
  await modal(page).getByLabel("负责人").selectOption("周远");
  await modal(page).getByLabel("初步处理说明").fill("现场检查中");
  await modal(page)
    .getByRole("button", { name: "确认告警", exact: true })
    .click();
  await modal(page)
    .getByRole("button", { name: "解决告警", exact: true })
    .click();
  await modal(page).getByLabel("解决原因").fill("确认现场温度恢复正常");
  await modal(page).getByRole("button", { name: "确认解决" }).click();
  await expect(modal(page)).toContainText("已解决");
  await expect(modal(page)).toContainText("确认现场温度恢复正常");
});
test("V3 OTA partial failure retries only failed device and survives reload", async ({
  page,
}) => {
  await page.goto("/v3/ota");
  await page.getByRole("button", { name: "创建升级批次" }).click();
  await modal(page).getByRole("button", { name: "确认范围并创建" }).click();
  await modal(page).getByRole("button", { name: "开始模拟升级" }).click();
  await modal(page).getByRole("button", { name: "推进模拟进度" }).click();
  await expect(modal(page)).toContainText("部分失败");
  await modal(page).getByRole("button", { name: "仅重试失败设备" }).click();
  await modal(page).getByLabel("重试原因").fill("已恢复网络连接并检查");
  await modal(page).getByRole("button", { name: "确认重试" }).click();
  await modal(page).getByRole("button", { name: "推进模拟进度" }).click();
  await expect(modal(page)).toContainText("3 / 3 完成");
  expect(
    await modal(page).locator("tbody tr td:last-child").allTextContents(),
  ).toEqual(["1", "1", "2"]);
  await page.reload();
  await page.getByRole("button", { name: "查看进度" }).click();
  await expect(modal(page)).toContainText("3 / 3 完成");
});
test("V3 members roles quota and action permission rejection", async ({
  page,
}) => {
  await page.goto("/v3/tenants");
  await page.getByRole("button", { name: "邀请成员" }).click();
  await modal(page).getByLabel("姓名").fill("测试成员");
  await modal(page).getByLabel("演示邮箱").fill("test@example.invalid");
  await modal(page).getByRole("button", { name: "创建模拟邀请" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "测试成员" })
    .getByRole("button", { name: "分配角色" })
    .click();
  await modal(page).getByLabel("新角色").selectOption("数据观察员");
  await modal(page).getByRole("button", { name: "确认角色变更" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "测试成员" }),
  ).toContainText("数据观察员");
  await page.getByRole("button", { name: "调整设备配额" }).click();
  await modal(page).getByLabel("设备配额").fill("4");
  await modal(page).getByRole("button", { name: "保存配额" }).click();
  await expect(modal(page).getByRole("alert")).toBeVisible();
  await modal(page).getByLabel("设备配额").fill("12");
  await modal(page).getByRole("button", { name: "保存配额" }).click();
  await expect(page.getByRole("main")).toContainText("5 / 12");
  await page.getByLabel("模拟身份").selectOption("viewer");
  await expect(page.getByRole("main")).toContainText("没有治理权限");
  await go(page, "设备中心");
  await page.getByRole("button", { name: "注册设备" }).click();
  await expect(modal(page)).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("无操作权限");
});
test("V3 dirty back forward Escape settings and unknown routes", async ({
  page,
}) => {
  await page.goto("/v3/workspace");
  await go(page, "设备中心");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("早上好");
  await page.getByRole("button", { name: "注册设备" }).click();
  await modal(page).getByLabel("设备名称").fill("前进草稿");
  page.once("dialog", (d) => d.dismiss());
  await page.goForward();
  await expect(page).toHaveURL(/workspace/);
  await expect(modal(page).getByLabel("设备名称")).toHaveValue("前进草稿");
  page.once("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.keyboard.press("Escape");
  await expect(modal(page)).not.toBeVisible();
  await expect(page.getByRole("button", { name: "注册设备" })).toBeFocused();
  await page.getByRole("button", { name: "注册设备" }).click();
  await modal(page).getByLabel("设备名称").fill("放弃草稿");
  page.once("dialog", (d) => d.accept());
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("设备中心");
  await expect(modal(page)).not.toBeVisible();
  await go(page, "设置与集成");
  await page.getByLabel("邮件摘要偏好").check();
  page.once("dialog", (d) => d.dismiss());
  await go(page, "设备中心");
  await expect(page).toHaveURL(/settings/);
  await expect(page.getByLabel("邮件摘要偏好")).toBeChecked();
  page.once("dialog", (d) => d.accept());
  await go(page, "设备中心");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("设备中心");
  await page.getByRole("button", { name: "注册设备" }).click();
  await modal(page).getByLabel("设备名称").fill("后退草稿");
  page.once("dialog", (d) => d.dismiss());
  await page.goBack();
  await expect(page).toHaveURL(/devices/);
  await expect(modal(page).getByLabel("设备名称")).toHaveValue("后退草稿");
  page.once("dialog", (d) => d.accept());
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "设置与集成",
  );
  await page.goto("/v3/products/unknown/nested");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "页面不存在",
  );
  await expect(page.getByTestId("v3-shell")).toBeVisible();
  await expect(
    page.getByRole("navigation").locator("[aria-current=page]"),
  ).toHaveCount(0);
});
test("V3 product attributes applied CSV notification preference and real refresh guard", async ({
  page,
}) => {
  await page.goto("/v3/products");
  await page.getByRole("button", { name: "查看物模型" }).first().click();
  await modal(page).getByRole("button", { name: "新增属性" }).click();
  await modal(page).getByLabel("属性标识符").fill("pressure");
  await modal(page).getByLabel("单位", { exact: true }).fill("kPa");
  await modal(page).getByRole("button", { name: "添加属性" }).click();
  await expect(modal(page)).toContainText("pressure");
  await modal(page).getByRole("button", { name: "关闭对话框" }).click();
  await go(page, "时序数据");
  await page.getByLabel("查询窗口").selectOption("15");
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel("查询窗口").selectOption("45");
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 CSV" }).click();
  const stream = await (await waiting).createReadStream();
  let csv = "";
  if (stream) for await (const chunk of stream) csv += String(chunk);
  expect(csv).toContain("08:30");
  expect(csv).not.toContain("08:00");
  await go(page, "设置与集成");
  await page.getByLabel("工作区内显示通知条目").uncheck();
  await page.getByRole("button", { name: "保存偏好" }).click();
  await page.getByRole("button", { name: "通知中心" }).click();
  await expect(modal(page)).toContainText("工作区通知已关闭");
  await modal(page).getByRole("button", { name: "关闭对话框" }).click();
  await go(page, "设备中心");
  await page.getByRole("button", { name: "注册设备" }).click();
  await modal(page).getByLabel("设备名称").fill("刷新保护");
  const prompt = page.waitForEvent("dialog");
  await page.evaluate(() => {
    setTimeout(() => location.reload(), 0);
  });
  const confirmation = await prompt;
  expect(confirmation.type()).toBe("beforeunload");
  await confirmation.dismiss();
  await expect(modal(page).getByLabel("设备名称")).toHaveValue("刷新保护");
  page.once("dialog", (d) => d.accept());
  await modal(page).getByRole("button", { name: "取消", exact: true }).click();
});
test("V3 all modules exception states meter scope and screenshots", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.goto("/v3/workspace");
  for (const path of modules) {
    await page.goto("/v3/" + path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const state of ["loading", "empty", "error", "forbidden"]) {
      await page.getByLabel("评审页面状态").selectOption(state);
      await expect(page.getByTestId("v3-shell")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.getByLabel("评审页面状态").selectOption("normal");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/v3/devices/DEV-1004");
  await expect(page.getByRole("main")).toContainText("420.8 kWh");
  await expect(
    page.getByRole("button", { name: "模拟上报", exact: true }),
  ).toHaveCount(0);
  for (const module of ["workspace", "devices"]) {
    await page.goto("/v3/" + module);
    await page.screenshot({
      path: `reports/v3-rebuild/${module}-${info.project.name}.png`,
      fullPage: true,
    });
  }
});
test("V3 every module passes axe", async ({ page }) => {
  test.setTimeout(90000);
  for (const path of modules) {
    await page.goto("/v3/" + path);
    expect((await new AxeBuilder({ page }).analyze()).violations, path).toEqual(
      [],
    );
  }
});
test("V3 mobile navigation focus and global search preserve the shell", async ({
  page,
}, info) => {
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/v3/workspace");
  const menu = page.getByRole("button", { name: "打开导航" });
  await menu.click();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await go(page, "设备中心");
  await expect(menu).toBeFocused();
  await page.getByRole("button", { name: "全局搜索" }).click();
  await modal(page).getByLabel("搜索页面").fill("规则与场景");
  await modal(page)
    .getByRole("link", { name: "规则与场景", exact: true })
    .click();
  await expect(page).toHaveURL(/rules/);
});
test("V3 node connector audit and state discard boundaries", async ({
  page,
}) => {
  await page.goto("/v3/nodes");
  await page.getByRole("button", { name: "查看节点" }).first().click();
  await expect(modal(page)).toContainText("共享模拟接入节点");
  await modal(page).getByRole("button", { name: "关闭对话框" }).click();
  await go(page, "连接与转发");
  await page.getByRole("button", { name: "测试连接" }).first().click();
  await expect(modal(page)).toContainText("未发起真实网络请求");
  await modal(page).getByRole("button", { name: "关闭对话框" }).click();
  await go(page, "审计与运维");
  await page.getByLabel("搜索操作或对象").fill("测试连接");
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("MQTT");
  await go(page, "设置与集成");
  await page.getByLabel("邮件摘要偏好").check();
  page.once("dialog", (d) => d.dismiss());
  await page.getByLabel("评审页面状态").selectOption("error");
  await expect(page.getByLabel("评审页面状态")).toHaveValue("normal");
  page.once("dialog", (d) => d.accept());
  await page.getByLabel("评审页面状态").selectOption("error");
  await page.getByLabel("评审页面状态").selectOption("normal");
  await expect(page.getByLabel("邮件摘要偏好")).not.toBeChecked();
  await go(page, "工作区");
  await page.getByLabel("评审页面状态").selectOption("error");
  await page.getByRole("button", { name: "重置演示" }).click();
  await modal(page).getByRole("button", { name: "确认重置" }).click();
  await expect(page.getByLabel("评审页面状态")).toHaveValue("normal");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("早上好");
});

test("V3 deletion clears selection and dialog contains keyboard focus", async ({
  page,
}) => {
  await page.goto("/v3/devices");
  await page
    .getByRole("checkbox", { name: "选择 冷链温控 · 05", exact: true })
    .check();
  await page.getByRole("button", { name: "删除所选" }).click();
  await expect(modal(page).getByLabel("输入 DELETE")).toBeFocused();
  const last = modal(page).getByRole("button", {
      name: "删除 1 台设备",
      exact: true,
    }),
    close = modal(page).getByRole("button", { name: "关闭对话框" });
  await last.focus();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(last).toBeFocused();
  await modal(page).getByLabel("输入 DELETE").fill("DELETE");
  await last.click();
  await expect(modal(page)).not.toBeVisible();
  await expect(page.getByRole("button", { name: "删除所选" })).toHaveCount(0);
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page.getByRole("table")).not.toContainText("CH-TEMP-005");
  await page.reload();
  await expect(page.getByRole("table")).not.toContainText("CH-TEMP-005");
});
