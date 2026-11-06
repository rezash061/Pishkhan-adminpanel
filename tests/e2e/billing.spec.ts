import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, login, PASSWORD, resetMock, TOTP } from "./helpers";

test.beforeEach(async ({ page }) => resetMock(page));

async function confirmStepUp(page: Page) {
  const stepUp = page.getByRole("dialog", { name: "تأیید دوباره هویت" });
  await stepUp.getByLabel("رمز عبور").fill(PASSWORD);
  await stepUp.getByLabel("کد دومرحله‌ای").fill(TOTP);
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();
}

test("billing: Finance extends and cancels a subscription", async ({ page }) => {
  await login(page, "finance");
  await page.goto("/workspaces/01938f61-0000-7000-8000-00000000b001");
  const current = page.getByTestId("current-plan");
  await expect(current).toContainText("حرفه‌ای");
  await expect(current).toContainText("فعال");
  const history = page.getByRole("table").filter({ hasText: "دلیل پایان" });
  await expect(history.locator("tbody tr")).toHaveCount(2);
  await expect(history.locator("tbody tr").last()).toContainText("جایگزین شد");
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: "تمدید", exact: true }).click();
  const extend = page.getByRole("dialog", { name: "تمدید اشتراک" });
  await extend.getByLabel("تمدید (روز)").fill("۴۰۰");
  await extend.getByLabel("دلیل").fill("جبران قطعی سرویس");
  await extend.getByRole("button", { name: "تمدید" }).click();
  await expect(extend.getByText(/عددی صحیح بین ۱ و/)).toBeVisible();
  await expectNoA11yViolations(page);
  await extend.getByLabel("تمدید (روز)").fill("۳۰");
  await extend.getByRole("button", { name: "تمدید" }).click();
  await confirmStepUp(page);
  await expect(page.getByText("اشتراک تمدید شد.")).toBeVisible();

  await page.getByRole("button", { name: "لغو اشتراک" }).click();
  const cancel = page.getByRole("dialog", { name: "لغو اشتراک" });
  await cancel.getByLabel("دلیل").fill("درخواست مالک");
  await cancel.getByRole("button", { name: "لغو اشتراک" }).click();
  await expect(page.getByText("اشتراک لغو شد.")).toBeVisible();
  await expect(current).toContainText("طرح رایگان");
  await expect(history.locator("tbody tr").first()).toContainText("لغو شد");
  await expect(page.getByRole("button", { name: "لغو اشتراک" })).toHaveCount(0);
});

test("billing: Finance grants a trial, which needs a length", async ({ page }) => {
  await login(page, "finance");
  await page.goto("/workspaces/01938f61-0000-7000-8000-00000000b002");
  const current = page.getByTestId("current-plan");
  await expect(current).toContainText("رایگان");
  await expect(page.getByText("این فضای کاری تاکنون اشتراکی نداشته است.")).toBeVisible();

  await page.getByRole("button", { name: "اعطای طرح" }).click();
  const grant = page.getByRole("dialog", { name: "اعطای طرح یا دورهٔ آزمایشی" });
  const pro = grant.locator("option", { hasText: "حرفه‌ای" });
  await expect(pro).toHaveCount(1);
  await grant.getByLabel("طرح", { exact: true }).selectOption((await pro.getAttribute("value"))!);
  await grant.getByLabel("دورهٔ آزمایشی").check();
  await grant.getByLabel("دلیل").fill("آزمایش طرح حرفه‌ای");
  await grant.getByRole("button", { name: "اعطا" }).click();
  await expect(grant.getByText("این فیلد الزامی است.")).toBeVisible();
  await grant.getByLabel("مدت (روز)").fill("۱۴");
  await expectNoA11yViolations(page);
  await grant.getByRole("button", { name: "اعطا" }).click();
  await confirmStepUp(page);
  await expect(page.getByText("طرح اعطا شد.")).toBeVisible();
  await expect(current).toContainText("حرفه‌ای");
  await expect(current).toContainText("آزمایشی");
});

test("billing: Support sees plan and usage but cannot change them", async ({ page }) => {
  await login(page, "support");
  await page.goto("/workspaces/01938f61-0000-7000-8000-00000000b003");
  await expect(page.getByTestId("current-plan")).toContainText("منقضی");
  await expect(page.getByRole("list", { name: "مصرف این دوره" })).toBeVisible();
  await expect(page.getByRole("button", { name: "اعطای طرح" })).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test("payments: summary, filters and a payment's invoice; Support cannot refund", async ({ page }) => {
  await login(page, "support");
  await page.goto("/billing/payments");
  await expect(page.getByTestId("billing-summary")).toContainText("خالص");
  await expect(page.getByTestId("payment-01938fb0-0000-7000-8000-000000000003")).toContainText("بخشی بازپرداخت شد");
  await expectNoA11yViolations(page);
  await page.getByRole("combobox", { name: "وضعیت" }).selectOption("failed");
  await expect(page).toHaveURL(/status=failed/);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("tbody tr").first().getByRole("link").first().click();
  await expect(page.getByTestId("payment-fields")).toContainText("ناموفق");
  await expect(page.getByRole("button", { name: "ثبت بازپرداخت" })).toHaveCount(0);
});

test("payments: Finance records a refund that ends the subscription", async ({ page }) => {
  await login(page, "finance");
  await page.goto("/billing/payments/01938fb0-0000-7000-8000-000000000001");
  await expect(page.getByRole("heading", { name: "فاکتور ۱۰۰۱" })).toBeVisible();
  await page.getByRole("button", { name: "ثبت بازپرداخت" }).click();
  const dialog = page.getByRole("dialog", { name: "ثبت بازپرداخت" });
  await expect(dialog.getByLabel("مبلغ (تومان)")).toHaveValue("699000");
  await dialog.getByLabel("مبلغ (تومان)").fill("800000");
  await dialog.getByLabel("دلیل").fill("مشتری در روز اول انصراف داد");
  await dialog.getByRole("button", { name: "ثبت بازپرداخت" }).click();
  await expect(dialog.getByText(/مبلغی از ۰ تا/)).toBeVisible();
  await expectNoA11yViolations(page);
  await dialog.getByLabel("مبلغ (تومان)").fill("۶۹۹٬۰۰۰");
  await dialog.getByLabel("کد پیگیری بازپرداخت (اختیاری)").fill("R-9001");
  await dialog.getByLabel("اشتراکی که با این پرداخت خریده شده پایان یابد").check();
  await dialog.getByRole("button", { name: "ثبت بازپرداخت" }).click();
  await confirmStepUp(page);
  await expect(page.getByText("بازپرداخت ثبت شد.")).toBeVisible();
  await expect(page.getByTestId("refunds")).toContainText("R-9001");
  await expect(page.getByTestId("payment-fields")).toContainText("بازپرداخت شد");
  await expect(page.getByRole("button", { name: "ثبت بازپرداخت" })).toHaveCount(0);

  await page.goto("/billing/subscriptions?state=ended");
  await expect(page.getByRole("cell", { name: /بازپرداخت شد/ })).toBeVisible();
  await expectNoA11yViolations(page);
});

test("coupons: Finance creates one and edits its limits; ReadOnly only looks", async ({ page }) => {
  await login(page, "finance");
  await page.goto("/billing/coupons");
  await expect(page.getByTestId("coupon-NOWRUZ")).toContainText("۱۰٪");
  await expectNoA11yViolations(page);
  await page.getByRole("link", { name: "کد تازه" }).click();
  await page.getByLabel("کد", { exact: true }).fill("yalda-1405");
  await page.getByLabel("نوع").selectOption("fixed");
  await page.getByLabel("مبلغ (تومان)").fill("۵۰۰۰۰");
  await page.getByLabel("کد طرح‌ها").fill("pro");
  await page.getByLabel("فقط برای اولین خرید فروشگاه").check();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "ساخت کد" }).click();
  await expect(page.getByRole("heading", { name: "YALDA-1405" })).toBeVisible();
  await expect(page.getByTestId("coupon-summary")).toContainText("۵۰٬۰۰۰ تومان");
  await page.getByLabel("حداکثر استفادهٔ کل").fill("100");
  await page.getByLabel("فعال باشد").uncheck();
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByText("ذخیره شد.")).toBeVisible();
  await expect(page.getByTestId("coupon-summary")).toContainText("خاموش");

  await page.goto("/billing/coupons/01938fb2-0000-7000-8000-000000000001");
  await expect(page.getByTestId("coupon-redemptions")).toContainText("۱۰۰۳");

  await page.context().clearCookies();
  await login(page, "readonly");
  await page.goto("/billing/coupons");
  await expect(page.getByRole("link", { name: "کد تازه" })).toHaveCount(0);
  await page.getByRole("link", { name: "NOWRUZ" }).click();
  await expect(page.getByRole("button", { name: "ذخیره" })).toHaveCount(0);
});

test("wallet: Finance adds credit on the workspace page; a refund goes to the wallet", async ({ page }) => {
  await login(page, "finance");
  await page.goto("/workspaces/01938f61-0000-7000-8000-00000000b004");
  const wallet = page.getByTestId("workspace-wallet");
  await expect(wallet.getByTestId("wallet-balance")).toHaveText("۱۰۰٬۰۰۰ تومان");
  await wallet.getByRole("button", { name: "افزایش یا کسر" }).click();
  const dialog = page.getByRole("dialog", { name: "تغییر موجودی کیف پول" });
  await dialog.getByLabel("کسر").check();
  await dialog.getByLabel("مبلغ (تومان)").fill("200000");
  await dialog.getByLabel("دلیل").fill("اصلاح خطای ثبت");
  await dialog.getByRole("button", { name: "افزایش یا کسر" }).click();
  await confirmStepUp(page);
  await expect(dialog.getByText("موجودی کیف پول برای این کسر کافی نیست.")).toBeVisible();
  await expectNoA11yViolations(page);
  await dialog.getByLabel("افزایش").check();
  await dialog.getByRole("button", { name: "افزایش یا کسر" }).click();
  await expect(page.getByText("موجودی کیف پول تغییر کرد.")).toBeVisible();
  await expect(wallet.getByTestId("wallet-balance")).toHaveText("۳۰۰٬۰۰۰ تومان");

  await page.goto("/billing/payments/01938fb0-0000-7000-8000-000000000003");
  await expect(page.getByTestId("payment-fields")).toContainText("NOWRUZ");
  await page.getByRole("button", { name: "ثبت بازپرداخت" }).click();
  const refund = page.getByRole("dialog", { name: "ثبت بازپرداخت" });
  await refund.getByLabel("مبلغ (تومان)").fill("100000");
  await refund.getByLabel("به جای زرین‌پال، به کیف پول فروشنده واریز شود").check();
  await expect(refund.getByLabel("کد پیگیری بازپرداخت (اختیاری)")).toHaveCount(0);
  await refund.getByLabel("دلیل").fill("جبران به کیف پول");
  await refund.getByRole("button", { name: "ثبت بازپرداخت" }).click();
  await expect(page.getByTestId("refunds")).toContainText("به کیف پول");
});
