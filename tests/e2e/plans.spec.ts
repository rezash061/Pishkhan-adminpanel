import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, login, PASSWORD, resetMock, TOTP } from "./helpers";

test.beforeEach(async ({ page }) => resetMock(page));

async function confirmStepUp(page: Page) {
  const stepUp = page.getByRole("dialog", { name: "تأیید دوباره هویت" });
  await stepUp.getByLabel("رمز عبور").fill(PASSWORD);
  await stepUp.getByLabel("کد دومرحله‌ای").fill(TOTP);
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();
}

test("plans: edit the open draft and publish it", async ({ page }) => {
  await login(page, "finance");
  await page.getByRole("navigation", { name: "منوی اصلی" }).getByRole("link", { name: "طرح‌ها و قیمت‌ها" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expectNoA11yViolations(page);

  await page.getByRole("link", { name: "حرفه‌ای" }).click();
  await expect(page.getByText("این طرح یک پیش‌نویس باز دارد:")).toBeVisible();
  await expect(page.getByLabel("ماهانه")).toBeDisabled();
  await page.getByRole("main").getByRole("link", { name: "پیش‌نویس نسخهٔ ۲" }).click();

  await expect(page.getByLabel("ماهانه")).toHaveValue("749000");
  await page.getByLabel("ماهانه").fill("۷۹۰٬۰۰۰");
  await expect(page.getByRole("button", { name: "انتشار" })).toBeDisabled();
  await page.getByRole("button", { name: "ذخیرهٔ پیش‌نویس" }).click();
  await expect(page.getByText("پیش‌نویس ذخیره شد.")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: "انتشار" }).click();
  await page.getByRole("dialog", { name: /انتشار حرفه‌ای/ }).getByRole("button", { name: "انتشار" }).click();
  await confirmStepUp(page);
  await expect(page.getByText(/نسخه منتشر شد/)).toBeVisible();
  const versions = page.getByRole("table").last();
  await expect(versions.locator("tbody tr").first()).toContainText("در حال فروش");
  await expect(versions.locator("tbody tr").first()).toContainText("۷۹۰٬۰۰۰ تومان");
  await expect(versions.locator("tbody tr").last()).toContainText("بایگانی");
});

test("plans: create a draft, with field errors from the server", async ({ page }) => {
  await login(page, "finance");
  await page.goto("/billing/plans/new");
  await page.getByLabel("کد طرح").fill("basic");
  await page.getByLabel("نام", { exact: true }).fill("آغاز");
  await page.getByLabel("ماهانه").fill("۱۹۹٬۰۰۰");
  await page.getByRole("button", { name: "ساخت پیش‌نویس" }).click();
  await expect(page.getByText("طرحی با این کد وجود دارد.").first()).toBeVisible();

  await page.getByLabel("کد طرح").fill("starter");
  await page.getByLabel("طرح رایگان (بدون اشتراک)").check();
  await page.getByRole("button", { name: "ساخت پیش‌نویس" }).click();
  await expect(page.getByText("طرح رایگان نمی‌تواند قیمت ماهانه داشته باشد.").first()).toBeVisible();

  await page.getByLabel("طرح رایگان (بدون اشتراک)").uncheck();
  await page.getByLabel("اعضای تیم").fill("۲");
  await page.getByRole("button", { name: "افزودن سطر" }).click();
  await page.getByLabel("کلید").fill("ai");
  await page.getByLabel("متن", { exact: true }).fill("پاسخ خودکار");
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "ساخت پیش‌نویس" }).click();
  await expect(page.getByText("پیش‌نویس ساخته شد. پس از بررسی، آن را منتشر کنید.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "آغاز" })).toBeVisible();
  await expect(page.getByLabel("اعضای تیم")).toHaveValue("2");
});

test("plans: a new version from the published one; Support can only look", async ({ page }) => {
  await login(page, "finance");
  await page.goto("/billing/plans");
  await page.getByRole("link", { name: "پایه" }).click();
  await page.getByRole("button", { name: "ساخت نسخهٔ تازه" }).click();
  await expect(page.getByText("کد basic، نسخهٔ ۳")).toBeVisible();
  await expect(page.getByLabel("ماهانه")).toBeEnabled();

  await page.getByRole("button", { name: "کنار گذاشتن پیش‌نویس" }).click();
  const dialog = page.getByRole("dialog", { name: /بایگانی پایه/ });
  await dialog.getByRole("button", { name: "بایگانی" }).click();
  await expect(dialog.getByText("این فیلد الزامی است.")).toBeVisible();
});

test("plans: Support sees plans read-only", async ({ page }) => {
  await login(page, "support");
  await page.goto("/billing/plans");
  await expect(page.getByRole("link", { name: "طرح تازه" })).toHaveCount(0);
  await page.getByRole("link", { name: "حرفه‌ای" }).click();
  await expect(page.getByRole("button", { name: "ساخت نسخهٔ تازه" })).toHaveCount(0);
  await expect(page.getByLabel("ماهانه")).toBeDisabled();
});
