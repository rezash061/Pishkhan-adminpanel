import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, login, PASSWORD, resetMock, TOTP } from "./helpers";

test.beforeEach(async ({ page }) => resetMock(page));

async function confirmStepUp(page: Page) {
  const stepUp = page.getByRole("dialog", { name: "تأیید دوباره هویت" });
  await stepUp.getByLabel("رمز عبور").fill(PASSWORD);
  await stepUp.getByLabel("کد دومرحله‌ای").fill(TOTP);
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();
}

test("dashboard: KPI tiles and alerts link to the filtered pages", async ({ page }) => {
  await login(page, "superadmin");
  await expect(page.getByTestId("kpi-aiReplies")).toContainText("۵");
  await expect(page.getByTestId("dashboard-alerts")).toContainText("پیام ناموفق منتظر بررسی است");
  await expectNoA11yViolations(page);
  await page.getByTestId("kpi-handoffRate").click();
  await expect(page).toHaveURL(/\/ai\/traces\?outcome=handed_off$/);
  await expect(page.getByRole("combobox", { name: "نتیجه" })).toHaveValue("handed_off");
});

test("dashboard: a content editor sees the numbers without links to pages they cannot open", async ({ page }) => {
  await login(page, "editor");
  await expect(page.getByTestId("kpi-deadLetters")).toBeVisible();
  await expect(page.getByTestId("kpi-deadLetters")).not.toHaveAttribute("href", /.+/);
  await expect(page.getByTestId("dashboard-alerts").getByRole("link")).toHaveCount(0);
});

test("health: every dependency with its detail", async ({ page }) => {
  await login(page, "aiops");
  await page.goto("/platform/health");
  await expect(page.getByRole("cell", { name: "ضدویروس ClamAV" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "max lag 420" })).toBeVisible();
  await expect(page.getByText("API کامل سلامت سامانه هنوز در دسترس نیست")).toHaveCount(0);
});

test("traces: ReadOnly sees redacted traces; AIOps reveals one with a reason", async ({ page }) => {
  await login(page, "readonly");
  await page.goto("/ai/traces?guard=1");
  await expect(page.getByTestId("trace-stats")).toBeVisible();
  await page.getByTestId("trace-01938fa0-0000-7000-8000-000000000002").getByRole("link").first().click();
  await expect(page.getByTestId("trace-content")).toContainText("پنهان");
  await expect(page.getByRole("button", { name: "نمایش متن" })).toHaveCount(0);
  await expectNoA11yViolations(page);

  await page.context().clearCookies();
  await login(page, "aiops", "/ai/traces/01938fa0-0000-7000-8000-000000000002");
  await page.getByRole("button", { name: "نمایش متن" }).click();
  const dialog = page.getByRole("dialog", { name: "نمایش متن گفتگو" });
  await dialog.getByLabel("دلیل").fill("تیکت ۴۲");
  await dialog.getByRole("button", { name: "نمایش متن" }).click();
  await expect(page.getByTestId("trace-content")).toContainText("اینو ۱۵۰ میدی؟");
  await expect(page.getByText("productId")).toBeVisible();
});

test("staff: SuperAdmin deactivates and reactivates an account, and changes roles, with step-up", async ({ page }) => {
  await login(page, "superadmin");
  await page.goto("/security/staff");
  const row = page.getByTestId("staff-support");
  await expect(page.getByTestId("staff-superadmin").getByRole("button", { name: "غیرفعال کردن" })).toBeDisabled();
  await row.getByRole("button", { name: "غیرفعال کردن" }).click();
  const dialog = page.getByRole("dialog", { name: "غیرفعال کردن support" });
  await dialog.getByLabel("دلیل").fill("پایان همکاری");
  await dialog.getByRole("button", { name: "غیرفعال کردن" }).click();
  await confirmStepUp(page);
  await expect(page.getByText("حساب support غیرفعال شد.")).toBeVisible();
  await expect(row).toContainText("غیرفعال");

  await row.getByRole("button", { name: "فعال کردن" }).click();
  await page.getByRole("dialog", { name: "فعال کردن support" }).getByLabel("دلیل").fill("بازگشت به تیم");
  await page.getByRole("dialog").getByRole("button", { name: "فعال کردن" }).click();
  await expect(page.getByText("حساب support فعال شد.")).toBeVisible();

  await row.getByRole("button", { name: "تغییر نقش‌ها" }).click();
  const roles = page.getByRole("dialog", { name: "نقش‌های support" });
  await roles.getByLabel("مالی").check();
  await roles.getByLabel("دلیل").fill("مسئول صورتحساب‌ها هم شد");
  await roles.getByRole("button", { name: "تغییر نقش‌ها" }).click();
  await expect(page.getByText("نقش‌های support به‌روز شد.")).toBeVisible();
  await expect(row).toContainText("مالی");
  await expectNoA11yViolations(page);
});

test("settings: a staff member ends one of their other sessions", async ({ page }) => {
  await login(page, "superadmin", "/settings");
  await expect(page.getByText("همین دستگاه")).toBeVisible();
  await expect(page.getByText("Safari · macOS")).toBeVisible();
  await page.getByRole("button", { name: "بستن" }).click();
  await expect(page.getByText("نشست بسته شد.")).toBeVisible();
  await expect(page.getByText("Safari · macOS")).toHaveCount(0);
  await expectNoA11yViolations(page);
});
