import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, login, PASSWORD, resetMock, TOTP } from "./helpers";

test.beforeEach(async ({ page }) => resetMock(page));

async function confirmStepUp(page: Page) {
  const stepUp = page.getByRole("dialog", { name: "تأیید دوباره هویت" });
  await stepUp.getByLabel("رمز عبور").fill(PASSWORD);
  await stepUp.getByLabel("کد دومرحله‌ای").fill(TOTP);
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();
}

test("users: search by phone, detail, block and unblock with reason and step-up", async ({ page }) => {
  await login(page, "support");
  await page.getByRole("navigation", { name: "منوی اصلی" }).getByRole("link", { name: "کاربران" }).click();
  await expect(page.getByRole("heading", { name: "کاربران" })).toBeVisible();
  await expect(page.getByText(/^۶۰ مورد$/)).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("searchbox", { name: "جستجو", exact: true }).fill("۰۹۳۵۰۰۰۰۰۰۱");
  await page.getByRole("button", { name: "جستجو", exact: true }).click();
  await expect(page).toHaveURL(/q=09350000001/);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: "همکار 1" }).click();

  await expect(page.getByRole("heading", { name: "همکار 1" })).toBeVisible();
  await expect(page.getByRole("link", { name: "بوتیک نیلوفر 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "دستگاه‌های واردشده (۱)" })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: "مسدود کردن" }).click();
  const dialog = page.getByRole("dialog", { name: "مسدود کردن کاربر" });
  await dialog.getByLabel("دلیل").fill("بد");
  await dialog.getByRole("button", { name: "مسدود کن" }).click();
  await expect(dialog.getByText("این مقدار کوتاه است.")).toBeVisible();
  await dialog.getByLabel("دلیل").fill("تیکت ۷۷: سوءاستفاده از پیام‌ها");
  await dialog.getByRole("button", { name: "مسدود کن" }).click();
  await confirmStepUp(page);
  await expect(page.getByText("کاربر مسدود شد و از همهٔ دستگاه‌ها خارج شد.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "دستگاه‌های واردشده (۰)" })).toBeVisible();

  await page.getByRole("button", { name: "رفع مسدودی" }).click();
  const unblock = page.getByRole("dialog", { name: "رفع مسدودی کاربر" });
  await unblock.getByLabel("دلیل").fill("تیکت ۷۷: بررسی شد");
  await unblock.getByRole("button", { name: "رفع مسدودی" }).click();
  await expect(page.getByText("مسدودی کاربر برداشته شد.")).toBeVisible();
  await expect(page.getByRole("button", { name: "مسدود کردن" })).toBeVisible();
});

test("users: Finance can look but not act; workspace members link to users", async ({ page }) => {
  await login(page, "finance");
  await page.goto("/workspaces/01938f61-0000-7000-8000-00000000b001");
  await page.getByRole("link", { name: "مالک 1" }).click();
  await expect(page.getByRole("heading", { name: "مالک 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "دستگاه‌های واردشده (۲)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "مسدود کردن" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "خروج از همهٔ دستگاه‌ها" })).toHaveCount(0);
});
