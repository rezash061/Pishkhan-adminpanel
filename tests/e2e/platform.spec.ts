import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, login, PASSWORD, resetMock, TOTP } from "./helpers";

test.beforeEach(async ({ page }) => resetMock(page));

async function confirmStepUp(page: Page) {
  const stepUp = page.getByRole("dialog", { name: "تأیید دوباره هویت" });
  await stepUp.getByLabel("رمز عبور").fill(PASSWORD);
  await stepUp.getByLabel("کد دومرحله‌ای").fill(TOTP);
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();
}

test("quarantine: Support re-scans a failed file and deletes a stuck one with step-up", async ({ page }) => {
  await login(page, "support");
  await page.getByRole("navigation", { name: "منوی اصلی" }).getByRole("link", { name: "قرنطینه فایل‌ها" }).click();
  await expect(page.getByText("Win.Test.EICAR_HDB-1")).toBeVisible();
  await expect(page.getByRole("button", { name: "مثبت کاذب" })).toHaveCount(0);
  await expectNoA11yViolations(page);

  const failed = page.getByTestId("file-01938f80-0000-7000-8000-00000000f002");
  await failed.getByRole("button", { name: "اسکن دوباره" }).click();
  const dialog = page.getByRole("dialog", { name: "اسکن دوباره فایل" });
  await dialog.getByLabel("دلیل").fill("ClamAV به‌روز شد");
  await dialog.getByRole("button", { name: "اسکن دوباره" }).click();
  await expect(page.getByText("فایل به صف اسکن برگشت.")).toBeVisible();

  await page.getByRole("tab", { name: /مانده در صف/ }).click();
  await expect(page).toHaveURL(/status=pending/);
  const stuck = page.getByTestId("file-01938f80-0000-7000-8000-00000000f003");
  await stuck.getByRole("button", { name: "حذف" }).click();
  await page.getByRole("dialog", { name: "حذف فایل" }).getByLabel("دلیل").fill("فایل گیر کرده");
  await page.getByRole("button", { name: "حذف برای همیشه" }).click();
  await confirmStepUp(page);
  await expect(page.getByText("فایل حذف شد.")).toBeVisible();
  await expect(stuck).toHaveCount(0);
});

test("dead letters: SuperAdmin inspects a payload and replays it to the failed consumer", async ({ page }) => {
  await login(page, "superadmin");
  await page.goto("/platform/dead-letters");
  await expect(page.getByTestId("dlq-summary")).toContainText("media");
  await page.getByRole("link", { name: "orders.order-created" }).click();
  await expect(page.getByTestId("dead-letter-envelope")).toContainText("Product 42 not found");
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "ارسال دوباره" }).click();
  await page.getByRole("dialog", { name: "ارسال دوباره پیام‌ها" }).getByLabel("دلیل").fill("محصول برگردانده شد");
  await page.getByRole("dialog").getByRole("button", { name: "ارسال دوباره" }).click();
  await confirmStepUp(page);
  await expect(page.getByText("۱ پیام دوباره فرستاده شد")).toBeVisible();
  await expect(page.getByText("دوباره فرستاده‌شده").first()).toBeVisible();
});

test("dead letters: ReadOnly sees the list but not payloads or actions", async ({ page }) => {
  await login(page, "readonly");
  await page.goto("/platform/dead-letters");
  await expect(page.getByRole("link", { name: "orders.order-created" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ارسال دوباره" })).toHaveCount(0);
  await page.getByRole("link", { name: "orders.order-created" }).click();
  await expect(page.getByText("دیدن محتوای پیام فقط برای پشتیبانی و مدیر ارشد مجاز است.")).toBeVisible();
});

test("kafka and workers: lag per group, and SuperAdmin runs a job now", async ({ page }) => {
  await login(page, "superadmin");
  await page.goto("/platform/kafka");
  await page.getByTestId("group-ai").click();
  await expect(page.getByText("conversations.reply-requested.v1").first()).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto("/platform/workers");
  await expect(page.getByText("بی‌پاسخ")).toBeVisible();
  await expect(page.getByTestId("job-content.scheduled-publish").getByRole("button", { name: "اجرای فوری" })).toBeDisabled();
  await page.getByTestId("job-platform.outbox-cleanup").getByRole("button", { name: "اجرای فوری" }).click();
  await page.getByRole("dialog", { name: "اجرای فوری کار" }).getByLabel("دلیل").fill("پاکسازی دستی");
  await page.getByRole("button", { name: "اجرا کن" }).click();
  await confirmStepUp(page);
  await expect(page.getByText("کار «platform.outbox-cleanup» برای اجرا آماده شد.")).toBeVisible();
  await expectNoA11yViolations(page);
});

test("feature flags: SuperAdmin creates a flag and turns it on for one workspace", async ({ page }) => {
  await login(page, "superadmin");
  await page.goto("/platform/feature-flags");
  await page.getByRole("button", { name: "پرچم تازه" }).click();
  const dialog = page.getByRole("dialog", { name: "پرچم تازه" });
  await dialog.getByLabel("کلید").fill("orders.v2");
  await dialog.getByLabel("توضیح").fill("صفحه سفارش جدید");
  await dialog.getByLabel("روشن باشد").check();
  await dialog.getByLabel("درصد فضاهای کاری").fill("۰");
  await dialog.getByLabel("دلیل").fill("آغاز آزمایش");
  await dialog.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByText("پرچم «orders.v2» ساخته شد.")).toBeVisible();
  await expect(page.getByTestId("flag-orders.v2")).toContainText("صفحه سفارش جدید");
  await expectNoA11yViolations(page);

  await page.goto("/workspaces/01938f61-0000-7000-8000-00000000b002");
  const row = page.getByTestId("ws-flag-orders.v2");
  await expect(row).toContainText("بیرون از درصد انتشار");
  await row.getByRole("button", { name: "روشن برای این فضا" }).click();
  await page.getByRole("dialog").getByLabel("دلیل").fill("مشتری آزمایشی");
  await page.getByRole("dialog").getByRole("button", { name: "ثبت" }).click();
  await expect(row).toContainText("استثنای این فضا");
  await expect(row).toContainText("مشتری آزمایشی");
});
