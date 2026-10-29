import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, login, PASSWORD, resetMock, TOTP } from "./helpers";

test.beforeEach(async ({ page }) => resetMock(page));

test("SuperAdmin sees every section and a healthy system", async ({ page }) => {
  await login(page, "superadmin");
  const nav = page.getByRole("navigation", { name: "منوی اصلی" });
  for (const name of ["داشبورد", "گزارش ممیزی", "کارکنان", "سلامت سامانه", "تنظیمات حساب"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
  await expect(page.getByTestId("health-summary")).toContainText("سالم");
  await expectNoA11yViolations(page);
});

test("Support cannot see or open staff management", async ({ page }) => {
  await login(page, "support");
  const nav = page.getByRole("navigation", { name: "منوی اصلی" });
  await expect(nav.getByRole("link", { name: "گزارش ممیزی" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "کارکنان" })).toHaveCount(0);
  await page.goto("/security/staff");
  await expect(page.getByTestId("forbidden")).toBeVisible();
});

test("Finance cannot open the audit log", async ({ page }) => {
  await login(page, "finance");
  await page.goto("/security/audit-log");
  await expect(page.getByTestId("forbidden")).toBeVisible();
});

test("creating a staff account requires step-up re-authentication", async ({ page }) => {
  await login(page, "superadmin");
  await page.goto("/security/staff");
  await expect(page.getByRole("cell", { name: "readonly" })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: "افزودن کارمند" }).click();
  const form = page.getByRole("dialog", { name: "افزودن کارمند" });
  await form.getByRole("button", { name: "ایجاد حساب" }).click();
  await expect(form.getByText("رمز عبور باید دست‌کم ۱۴ نویسه باشد.")).toBeVisible();

  await form.getByLabel("نام کاربری").fill("sara.m");
  await form.getByLabel("رمز عبور اولیه").fill("a-long-initial-pass");
  await form.getByLabel("پشتیبانی").check();
  await form.getByRole("button", { name: "ایجاد حساب" }).click();

  const stepUp = page.getByRole("dialog", { name: "تأیید دوباره هویت" });
  await expect(stepUp).toBeVisible();
  await stepUp.getByLabel("رمز عبور").fill(PASSWORD);
  await stepUp.getByLabel("کد دومرحله‌ای").fill("000000");
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();
  await expect(stepUp.getByRole("alert")).toHaveText("رمز عبور یا کد تأیید نادرست است.");
  await stepUp.getByLabel("کد دومرحله‌ای").fill(TOTP);
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();

  await expect(page.getByText("حساب sara.m ایجاد شد.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "sara.m" })).toBeVisible();

  // The step-up token is still valid, so a second dangerous action does not ask again; a taken name is reported.
  await page.getByRole("button", { name: "افزودن کارمند" }).click();
  await form.getByLabel("نام کاربری").fill("sara.m");
  await form.getByLabel("رمز عبور اولیه").fill("a-long-initial-pass");
  await form.getByLabel("مالی").check();
  await form.getByRole("button", { name: "ایجاد حساب" }).click();
  await expect(form.getByRole("alert").first()).toHaveText("این نام کاربری قبلاً ثبت شده است.");
  await expect(stepUp).toBeHidden();
});

test("audit log filters are deep-linkable and entries open in detail", async ({ page }) => {
  await login(page, "superadmin");
  await page.goto("/security/audit-log");
  await page.getByLabel("نوع موجودیت").selectOption("plan");
  await page.getByLabel("از تاریخ").fill("not a date");
  await page.getByRole("button", { name: "اعمال فیلتر" }).click();
  await expect(page.getByText("تاریخ را به شکل ۱۴۰۵/۰۸/۰۷ وارد کنید.")).toBeVisible();

  await page.getByLabel("از تاریخ").fill("۱۴۰۵/۰۸/۰۱");
  await page.getByRole("button", { name: "اعمال فیلتر" }).click();
  await expect(page).toHaveURL(/entityType=plan/);
  await expect(page).toHaveURL(/from=/);
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toContainText("plan.update");
  await expect(page.getByText(/^۹ مورد$/)).toBeVisible();

  await rows.first().click();
  const detail = page.getByRole("dialog", { name: "جزئیات رویداد" });
  await expect(detail).toContainText("افزایش سقف پیام پلن پایه");
  await expect(detail).toContainText('"messagesPerMonth": 1500');
  await expectNoA11yViolations(page);
});

test("command palette jumps to a page", async ({ page }) => {
  await login(page, "superadmin");
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "جستجوی صفحه‌ها" });
  await palette.getByRole("combobox").fill("سلامت");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/platform\/health$/);
  await expect(page.getByRole("cell", { name: "پایگاه داده PostgreSQL" })).toBeVisible();
});
