import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, login, PASSWORD, resetMock, TOTP } from "./helpers";

test.beforeEach(async ({ page }) => resetMock(page));

async function confirmStepUp(page: Page) {
  const stepUp = page.getByRole("dialog", { name: "تأیید دوباره هویت" });
  await stepUp.getByLabel("رمز عبور").fill(PASSWORD);
  await stepUp.getByLabel("کد دومرحله‌ای").fill(TOTP);
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();
}

test("outage: Support declares Instagram down, the home page shows it, then back to auto", async ({ page }) => {
  await login(page, "support");
  await expect(page.getByTestId("outage-home-alert")).toHaveCount(0);
  await page.getByRole("navigation", { name: "منوی اصلی" }).getByRole("link", { name: "قطعی اینستاگرام" }).click();
  await expect(page.getByTestId("outage-status")).toContainText("اینستاگرام کار می‌کند");
  await expect(page.getByTestId("outage-counts")).toContainText("۱٬۲۸۴");
  await expectNoA11yViolations(page);

  await page.getByRole("radio", { name: /اعلام قطعی دستی/ }).check();
  await page.getByLabel("دلیل").fill("فیلترینگ گسترده در ایران");
  await page.getByRole("button", { name: "اعمال حالت" }).click();
  await confirmStepUp(page);
  await expect(page.getByText("حالت «اعلام قطعی دستی» اعمال شد. وضعیت: اینستاگرام قطع است.")).toBeVisible();
  await expect(page.getByTestId("outage-status")).toContainText("اینستاگرام قطع است");
  await expect(page.getByText("فیلترینگ گسترده در ایران")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto("/");
  await expect(page.getByTestId("outage-home-alert")).toContainText("قطع اعلام شده است");

  await page.getByRole("link", { name: "جزئیات قطعی" }).click();
  await page.getByRole("radio", { name: /تشخیص خودکار/ }).check();
  await page.getByLabel("دلیل").fill("فیلترینگ برداشته شد");
  await page.getByRole("button", { name: "اعمال حالت" }).click();
  await expect(page.getByTestId("outage-status")).toContainText("اینستاگرام کار می‌کند");
});

test("outage: Finance sees the status but cannot change the mode", async ({ page }) => {
  await login(page, "finance");
  await page.goto("/platform/outage");
  await expect(page.getByTestId("outage-status")).toContainText("اینستاگرام کار می‌کند");
  await expect(page.getByRole("button", { name: "اعمال حالت" })).toHaveCount(0);
  await expect(page.getByText("فقط پشتیبانی و مدیر کل می‌توانند حالت را تغییر دهند.")).toBeVisible();
});
