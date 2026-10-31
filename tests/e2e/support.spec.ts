import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, login, PASSWORD, resetMock, TOTP } from "./helpers";

test.beforeEach(async ({ page }) => resetMock(page));

test("leads: masked phones, reveal, type filter in the URL and detail", async ({ page }) => {
  await login(page, "support");
  await page.getByRole("navigation", { name: "منوی اصلی" }).getByRole("link", { name: "سرنخ‌های سایت" }).click();
  await expect(page.getByRole("heading", { name: "سرنخ‌های سایت" })).toBeVisible();
  const firstPhone = page.getByTestId("lead-phone").first();
  await expect(firstPhone).toHaveText("0912***1000");
  await page.getByRole("button", { name: "نمایش شماره" }).first().click();
  await expect(firstPhone).toHaveText("09120001000");
  await expectNoA11yViolations(page);

  await page.getByLabel("نوع").selectOption("contact");
  await expect(page).toHaveURL(/type=contact/);
  await expect(page.getByText(/^۱۲ مورد$/)).toBeVisible();
  await page.locator("tbody tr").first().getByRole("button").first().click();
  await expect(page.getByRole("dialog", { name: "جزئیات سرنخ" })).toContainText("دمو می‌خواهیم");
});

test("Finance cannot see leads or support sessions", async ({ page }) => {
  await login(page, "finance");
  const nav = page.getByRole("navigation", { name: "منوی اصلی" });
  await expect(nav.getByRole("link", { name: "سرنخ‌های سایت" })).toHaveCount(0);
  await page.goto("/support/sessions");
  await expect(page.getByTestId("forbidden")).toBeVisible();
});

test("support session: reason and step-up, then a one-time link", async ({ page }) => {
  await login(page, "support");
  await page.goto("/support/sessions?workspaceId=01938f61-0000-7000-8000-00000000b001");
  await expect(page.getByLabel("شناسهٔ فضای کاری")).toHaveValue("01938f61-0000-7000-8000-00000000b001");
  await expectNoA11yViolations(page);

  await page.getByLabel("دلیل").fill("بد");
  await page.getByRole("button", { name: "ساخت لینک ورود" }).click();
  await expect(page.getByText("این مقدار کوتاه است.")).toBeVisible();

  await page.getByLabel("دلیل").fill("تیکت ۴۲: پاسخ خودکار کار نمی‌کند");
  await page.getByRole("button", { name: "ساخت لینک ورود" }).click();
  const stepUp = page.getByRole("dialog", { name: "تأیید دوباره هویت" });
  await stepUp.getByLabel("رمز عبور").fill(PASSWORD);
  await stepUp.getByLabel("کد دومرحله‌ای").fill(TOTP);
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();

  const link = page.getByTestId("support-link").getByRole("link", { name: "باز کردن پنل کاربری" });
  await expect(link).toHaveAttribute("href", /\/api\/auth\/impersonation\?token=mock-/);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
});
