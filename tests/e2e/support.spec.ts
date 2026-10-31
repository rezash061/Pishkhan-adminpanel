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
  await expect(page.getByTestId("picked-workspace")).toContainText("بوتیک نیلوفر 1");
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

test("workspaces: search by Instagram username and phone, filters in the URL, detail", async ({ page }) => {
  await login(page, "support");
  await page.getByRole("navigation", { name: "منوی اصلی" }).getByRole("link", { name: "فضاهای کاری" }).click();
  await expect(page.getByRole("heading", { name: "فضاهای کاری" })).toBeVisible();
  await expect(page.getByText(/^۳۰ مورد$/)).toBeVisible();
  await expectNoA11yViolations(page);

  const search = page.getByRole("searchbox", { name: "جستجو", exact: true });
  await search.fill("@shop_5");
  await page.getByRole("button", { name: "جستجو", exact: true }).click();
  await expect(page).toHaveURL(/q=%40shop_5/);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("آموزشگاه هنر نو 5");

  await search.fill("۰۹۱۲۰۰۰۰۰۰۳");
  await page.getByRole("button", { name: "جستجو", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("گالری طلای آفتاب 3");

  await search.fill("");
  await page.getByRole("button", { name: "جستجو", exact: true }).click();
  await page.getByLabel("وضعیت").selectOption("pending_deletion");
  await expect(page).toHaveURL(/status=pending_deletion/);
  await expect(page.getByText(/^۳ مورد$/)).toBeVisible();

  await page.goto("/workspaces/01938f61-0000-7000-8000-00000000b001");
  await expect(page.getByRole("heading", { name: "بوتیک نیلوفر 1" })).toBeVisible();
  await expect(page.getByText("@shop_1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "اعضا (۳)" })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("link", { name: "ورود پشتیبانی به‌جای همکار 1" }).click();
  await expect(page.getByTestId("picked-workspace")).toContainText("بوتیک نیلوفر 1");
  await expect(page.getByLabel("ورود به‌عنوان")).toHaveValue("01938f60-0000-7000-8000-00000000c001");
});

test("workspaces: Finance can look but not start a support session; unknown id", async ({ page }) => {
  await login(page, "finance");
  await page.goto("/workspaces/01938f61-0000-7000-8000-00000000b002");
  await expect(page.getByRole("heading", { name: "آرایشی مهتاب 2" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ورود پشتیبانی" })).toHaveCount(0);
  await page.goto("/workspaces/01938f61-0000-7000-8000-00000000ffff");
  await expect(page.getByText(/این فضای کاری پیدا نشد/)).toBeVisible();
});

test("support session: pick the workspace through the search", async ({ page }) => {
  await login(page, "support");
  await page.goto("/support/sessions");
  await page.getByRole("button", { name: "ساخت لینک ورود" }).click();
  await expect(page.getByText("یک فضای کاری انتخاب کنید.")).toBeVisible();

  await page.getByRole("searchbox", { name: "جستجوی فضای کاری" }).fill("مهتاب");
  await page.getByRole("button", { name: "انتخاب آرایشی مهتاب 2", exact: true }).click();
  await expect(page.getByTestId("picked-workspace")).toContainText("آرایشی مهتاب 2");
  await expectNoA11yViolations(page);

  await page.getByLabel("دلیل").fill("تیکت ۴۳: اتصال اینستاگرام");
  await page.getByRole("button", { name: "ساخت لینک ورود" }).click();
  const stepUp = page.getByRole("dialog", { name: "تأیید دوباره هویت" });
  await stepUp.getByLabel("رمز عبور").fill(PASSWORD);
  await stepUp.getByLabel("کد دومرحله‌ای").fill(TOTP);
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();
  await expect(page.getByTestId("support-link")).toBeVisible();
});
