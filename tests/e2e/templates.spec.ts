import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, login, PASSWORD, resetMock, TOTP } from "./helpers";

test.beforeEach(async ({ page }) => resetMock(page));

async function confirmStepUp(page: Page) {
  const stepUp = page.getByRole("dialog", { name: "تأیید دوباره هویت" });
  await stepUp.getByLabel("رمز عبور").fill(PASSWORD);
  await stepUp.getByLabel("کد دومرحله‌ای").fill(TOTP);
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();
}

test("templates: fix the clothing draft's issues and publish it", async ({ page }) => {
  await login(page, "aiops");
  await page.getByRole("navigation", { name: "منوی اصلی" }).getByRole("link", { name: "قالب‌های صنف" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(7);
  await expectNoA11yViolations(page);

  await page.getByLabel("وضعیت").selectOption("draft");
  await expect(page).toHaveURL(/status=draft/);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr").first()).toContainText("۲ ایراد");
  await page.getByRole("link", { name: "پوشاک و کیف و کفش" }).click();

  const checklist = page.getByRole("region", { name: "قانون‌ها" });
  await expect(checklist).toContainText("فلویی را با flowKey نام برده");
  await expect(page.getByRole("region", { name: "پرسش‌های رایج" })).toContainText("این متن خالی است");
  await expect(page.getByRole("button", { name: "انتشار" })).toBeDisabled();
  await expectNoA11yViolations(page);

  // Fill the empty answer and drop the rule that points at a flow the template does not have.
  await page.getByLabel("پاسخ").last().fill("بله، کادوپیچ [رایگان / با هزینه] است.");
  const rules = page.getByLabel("قانون‌ها (JSON)");
  const json = JSON.parse(await rules.inputValue()) as { key: string }[];
  await rules.fill(JSON.stringify(json.filter((r) => r.key !== "fabric-keyword"), null, 2));
  await expect(page.getByText("تغییرات ذخیره‌نشده دارید.", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "ذخیرهٔ پیش‌نویس" }).click();
  await expect(page.getByText("پیش‌نویس ذخیره شد.")).toBeVisible();
  await expect(page.getByText("ایرادی نیست؛ این پیش‌نویس آمادهٔ انتشار است.")).toBeVisible();

  await page.getByRole("button", { name: "انتشار" }).click();
  await page.getByRole("dialog", { name: /انتشار پوشاک و کیف و کفش/ }).getByRole("button", { name: "انتشار" }).click();
  await confirmStepUp(page);
  await expect(page.getByText("نسخه منتشر شد و نسخهٔ قبلی این صنف بایگانی شد.")).toBeVisible();
  const versions = page.getByRole("table").last();
  await expect(versions.locator("tbody tr").first()).toContainText("منتشرشده");
  await expect(versions.locator("tbody tr").last()).toContainText("بایگانی");
});

test("templates: new version, one draft at a time, archive needs a reason", async ({ page }) => {
  await login(page, "aiops");
  await page.goto("/templates/industry?industry=jewelry");
  await page.getByRole("link", { name: "طلا و جواهر" }).click();
  await expect(page.getByLabel("نام قالب")).toBeDisabled();
  await expect(page.getByText("۶ گره")).toBeVisible();
  await page.getByRole("button", { name: "ساخت نسخهٔ تازه" }).click();
  await expect(page.getByText("نسخهٔ تازه به‌صورت پیش‌نویس ساخته شد.")).toBeVisible();
  await expect(page.getByText("صنف زیورآلات، نسخهٔ ۲")).toBeVisible();
  await expect(page.getByLabel("نام قالب")).toBeEnabled();

  await page.getByRole("button", { name: "کنار گذاشتن پیش‌نویس" }).click();
  const dialog = page.getByRole("dialog", { name: /بایگانی طلا و جواهر/ });
  await dialog.getByRole("button", { name: "بایگانی" }).click();
  await expect(dialog.getByText("این فیلد الزامی است.")).toBeVisible();
  await dialog.getByLabel("دلیل").fill("نسخهٔ آزمایشی بود");
  await dialog.getByRole("button", { name: "بایگانی" }).click();
  await confirmStepUp(page);
  await expect(page.getByText("نسخه بایگانی شد.")).toBeVisible();
});

test("templates: create the first draft for an industry without a template", async ({ page }) => {
  await login(page, "superadmin");
  await page.goto("/templates/industry");
  await page.getByRole("link", { name: "قالب برای صنف تازه" }).click();
  await expect(page.getByRole("option", { name: /پوشاک \(قالب دارد\)/ })).toBeDisabled();
  await page.getByLabel("صنف").selectOption("other");
  await page.getByLabel("نام قالب").fill("سایر کسب‌وکارها");
  await page.getByRole("button", { name: "افزودن پرسش" }).click();
  await page.getByLabel("کلید").fill("hours");
  await page.getByLabel("پرسش", { exact: true }).fill("ساعت کاری‌تون چیه؟");
  await page.getByLabel("پاسخ").fill("ما [روزها] از ساعت [شروع] تا [پایان] پاسخ‌گو هستیم.");
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "ساخت پیش‌نویس" }).click();
  await expect(page.getByText("پیش‌نویس ساخته شد.", { exact: false })).toBeVisible();
  await expect(page.getByText("ایرادی نیست؛ این پیش‌نویس آمادهٔ انتشار است.")).toBeVisible();
});

test("templates: Support and ReadOnly only look", async ({ page }) => {
  await login(page, "support");
  await page.goto("/templates/industry");
  await expect(page.getByRole("link", { name: "قالب برای صنف تازه" })).toHaveCount(0);
  await page.getByRole("link", { name: "پوشاک و کیف و کفش" }).first().click();
  await expect(page.getByText("شما فقط می‌توانید قالب‌ها را ببینید.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "انتشار" })).toHaveCount(0);
  await expect(page.getByLabel("نام قالب")).toBeDisabled();
});
