import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, login, PASSWORD, resetMock, TOTP } from "./helpers";

test.beforeEach(async ({ page }) => resetMock(page));

test("tickets: queue tabs, answer a seller, take and close", async ({ page }) => {
  await login(page, "support");
  await page.getByRole("navigation", { name: "منوی اصلی" }).getByRole("link", { name: "تیکت‌های پشتیبانی" }).click();
  await expect(page.getByRole("heading", { name: "تیکت‌های پشتیبانی" })).toBeVisible();
  await expect(page.getByTestId("tab-count-open")).toHaveText("۵");
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: /^بدون مسئول/ }).click();
  await expect(page).toHaveURL(/tab=unassigned/);
  await page.getByLabel("دسته").selectOption("ai");
  await expect(page).toHaveURL(/category=ai/);
  await page.getByRole("link", { name: "هوش مصنوعی قیمت اشتباه می‌گوید" }).click();

  await expect(page.getByTestId("ticket-messages")).toContainText("قیمت مانتو را قدیمی می‌گوید");
  await expect(page.getByTestId("ticket-assignee")).toHaveText("بدون مسئول");
  await expectNoA11yViolations(page);
  await page.getByLabel("پاسخ شما").fill("کاتالوگ دوباره خوانده شد؛ حالا قیمت درست را می‌گوید.");
  await page.getByRole("button", { name: "ارسال پاسخ" }).click();
  await expect(page.getByText("پاسخ فرستاده شد.")).toBeVisible();
  await expect(page.getByTestId("ticket-summary")).toContainText("پاسخ داده شد");
  await expect(page.getByTestId("ticket-assignee")).toHaveText("مسئول: support");
  await expect(page.getByTestId("ticket-messages").locator("li")).toHaveCount(2);

  await page.getByRole("button", { name: "بستن تیکت" }).click();
  await expect(page.getByTestId("ticket-summary")).toContainText("بسته");
  await page.getByRole("button", { name: "باز کردن دوباره" }).click();
  await expect(page.getByTestId("ticket-summary")).toContainText("در انتظار پاسخ");
});

test("ReadOnly reads tickets without a reply box; Finance cannot open them", async ({ page }) => {
  await login(page, "readonly", "/support/tickets?tab=all");
  await page.getByRole("link", { name: "فاکتور رسمی می‌خواهم" }).click();
  await expect(page.getByTestId("ticket-messages")).toBeVisible();
  await expect(page.getByLabel("پاسخ شما")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "بستن تیکت" })).toHaveCount(0);

  await page.context().clearCookies();
  await login(page, "finance");
  await expect(page.getByRole("navigation", { name: "منوی اصلی" }).getByRole("link", { name: "تیکت‌های پشتیبانی" })).toHaveCount(0);
  await page.goto("/support/tickets");
  await expect(page.getByTestId("forbidden")).toBeVisible();
});

test("announcements: publish, validation, end", async ({ page }) => {
  await login(page, "support", "/support/announcements");
  await expect(page.getByTestId("announcement-row")).toHaveCount(3);
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: "اطلاعیه جدید" }).click();
  const dialog = page.getByRole("dialog", { name: "اطلاعیه جدید" });
  await dialog.getByLabel("عنوان").fill("ارتقای سرورها");
  await dialog.getByLabel("پیوند (اختیاری)").fill("javascript:alert(1)");
  await dialog.getByRole("button", { name: "انتشار" }).click();
  await expect(dialog.getByText("این مقدار معتبر نیست.")).toBeVisible();
  await dialog.getByLabel("پیوند (اختیاری)").fill("/billing");
  await dialog.getByLabel("اهمیت").selectOption("critical");
  await dialog.getByRole("button", { name: "انتشار" }).click();
  await expect(page.getByText("اطلاعیه ذخیره شد.")).toBeVisible();

  const row = page.getByTestId("announcement-row").filter({ hasText: "ارتقای سرورها" });
  await expect(row).toContainText("در حال نمایش");
  await expect(row).toContainText("بحرانی");
  await row.getByRole("button", { name: "پایان نمایش" }).click();
  await expect(row).toContainText("پایان‌یافته");
});

test("messaging: provider state, SMS log by phone, test SMS with step-up, Bale bot check", async ({ page }) => {
  await login(page, "superadmin", "/platform/messaging");
  await expect(page.getByTestId("sms-provider")).toContainText("کاوه‌نگار");
  await expect(page.getByTestId("sms-credit")).toHaveText("۱٬۸۴۵٬۰۰۰ تومان");
  await expect(page.getByTestId("bale-settings")).toContainText("https://tapi.bale.ai");
  await expectNoA11yViolations(page);

  await page.getByLabel("شماره موبایل").fill("09121112233");
  await page.getByRole("button", { name: "ارسال آزمایشی" }).click();
  const stepUp = page.getByRole("dialog", { name: "تأیید دوباره هویت" });
  await stepUp.getByLabel("رمز عبور").fill(PASSWORD);
  await stepUp.getByLabel("کد دومرحله‌ای").fill(TOTP);
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();
  await expect(page.getByText("پیامک آزمایشی به +98912***2233 فرستاده شد.")).toBeVisible();

  await page.getByTestId("bale-bot-shop3_bot").getByRole("button", { name: "بررسی توکن" }).click();
  await expect(page.getByTestId("bale-check-result")).toContainText("نپذیرفت");
  await expect(page.getByTestId("bale-bot-shop3_bot")).toContainText("نیاز به اتصال دوباره");

  await page.getByRole("link", { name: "گزارش کامل پیامک‌ها" }).click();
  await expect(page.getByRole("heading", { name: "گزارش پیامک‌ها" })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByLabel("شماره موبایل").fill("09121112233");
  await page.getByRole("button", { name: "اعمال فیلتر" }).click();
  await expect(page).toHaveURL(/phone=09121112233/);
  await expect(page.getByTestId("sms-row")).toHaveCount(1);
  await expect(page.getByTestId("sms-row")).toContainText("آزمایشی");
  await page.getByLabel("نتیجه").selectOption("failed");
  await expect(page.getByTestId("sms-row")).toHaveCount(0);
});

test("meta app: settings without secrets, webhook results and accounts by status", async ({ page }) => {
  await login(page, "readonly", "/platform/meta-app");
  await expect(page.getByRole("heading", { name: "اپ متا (اینستاگرام)" })).toBeVisible();
  await expect(page.getByTestId("meta-settings")).toContainText("v23.0");
  await expect(page.getByTestId("meta-settings")).toContainText("تنظیم شده");
  await expect(page.getByTestId("webhook-accepted")).toContainText("۱۸٬۲۴۰");
  await expect(page.getByTestId("meta-webhooks")).toContainText("۴ وب‌هوک رد شد.");
  await expect(page.getByTestId("meta-accounts")).toContainText("توکن ۲ حساب در ۱۰ روز آینده منقضی می‌شود.");
  await expectNoA11yViolations(page);

  await page.context().clearCookies();
  await login(page, "finance");
  await page.goto("/platform/meta-app");
  await expect(page.getByTestId("forbidden")).toBeVisible();
});
