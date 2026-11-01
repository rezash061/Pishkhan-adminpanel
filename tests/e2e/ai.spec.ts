import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, login, PASSWORD, resetMock, TOTP } from "./helpers";

test.beforeEach(async ({ page }) => resetMock(page));

async function confirmStepUp(page: Page) {
  const stepUp = page.getByRole("dialog", { name: "تأیید دوباره هویت" });
  await stepUp.getByLabel("رمز عبور").fill(PASSWORD);
  await stepUp.getByLabel("کد دومرحله‌ای").fill(TOTP);
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();
}

test("AI providers: SuperAdmin changes a key with step-up and tests providers", async ({ page }) => {
  await login(page, "superadmin");
  await page.getByRole("navigation", { name: "منوی اصلی" }).getByRole("link", { name: "سرویس‌دهنده‌های مدل" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: "ویرایش avalai" }).click();
  const edit = page.getByRole("dialog", { name: "ویرایش avalai" });
  await expect(edit.getByLabel("کلید API")).toHaveValue("");
  await edit.getByLabel("نشانی API").fill("ftp://bad");
  await edit.getByRole("button", { name: "ذخیره" }).click();
  await expect(edit.getByText(/نشانی باید با http/)).toBeVisible();
  await edit.getByLabel("نشانی API").fill("https://api.avalai.ir/v1");
  await edit.getByLabel("کلید API").fill("sk-new-key");
  await edit.getByLabel("دلیل").fill("چرخش دوره‌ای کلید");
  await expectNoA11yViolations(page);
  await edit.getByRole("button", { name: "ذخیره" }).click();
  await confirmStepUp(page);
  await expect(page.getByText(/سرویس‌دهندهٔ avalai ذخیره شد/)).toBeVisible();

  await page.getByRole("button", { name: "آزمایش openai" }).click();
  const test1 = page.getByRole("dialog", { name: "آزمایش openai" });
  await test1.getByLabel("مدل").fill("missing-model");
  await test1.getByRole("button", { name: "آزمایش" }).click();
  await expect(test1.getByText(/model 'missing-model' not found/)).toBeVisible();
  await test1.getByLabel("مدل").fill("gpt-4o-mini");
  await test1.getByRole("button", { name: "آزمایش" }).click();
  await expect(test1.getByText(/پاسخ داد/)).toBeVisible();
});

test("AI providers and routes: ReadOnly can look but not change", async ({ page }) => {
  await login(page, "readonly");
  await page.goto("/ai/providers");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "سرویس‌دهندهٔ تازه" })).toHaveCount(0);
  await page.goto("/ai/routes");
  await expect(page.getByRole("heading", { name: "نوشتن پاسخ" })).toBeVisible();
  await expect(page.getByRole("link", { name: /ویرایش مسیر/ })).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test("AI routes: AIOps edits the classify chain and resets it", async ({ page }) => {
  await login(page, "aiops");
  await page.goto("/ai/routes");
  await page.getByRole("link", { name: "ویرایش مسیر تشخیص نیت پیام" }).click();
  await expect(page.getByRole("heading", { name: "گام ۲" })).toBeVisible();

  await page.getByRole("button", { name: "افزودن گام" }).click();
  const third = page.locator("form > div").filter({ has: page.getByRole("heading", { name: "گام ۳" }) });
  await third.getByLabel("سرویس‌دهنده").selectOption("openai");
  await third.getByLabel("مدل").fill("gpt-4o-mini");
  await third.getByLabel("دما").fill("۳");
  await page.getByLabel("دلیل").fill("افزودن مسیر جایگزین");
  await page.getByRole("button", { name: "ذخیرهٔ مسیر" }).click();
  await expect(third.getByText("عددی بین ۰ و ۲ وارد کنید.")).toBeVisible();
  await third.getByLabel("دما").fill("۰٫۲");
  await page.getByRole("button", { name: "ذخیرهٔ مسیر" }).click();
  await expect(page.getByText("یک سرویس‌دهنده و مدل نباید دو بار در مسیر بیاید.")).toBeVisible();
  await third.getByLabel("سرویس‌دهنده").selectOption("avalai");
  await third.getByLabel("قیمت ورودی").fill("۱۵۰٬۰۰۰");
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "ذخیرهٔ مسیر" }).click();
  await expect(page.getByText("مسیر ذخیره شد.")).toBeVisible();
  await expect(page.getByText("پنل مدیریت", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "برگشت به پیکربندی" }).click();
  await expect(page.getByText("این فیلد الزامی است.")).toBeVisible();
  await page.getByLabel("دلیل").fill("برگشت به مسیر پیش‌فرض");
  await page.getByRole("button", { name: "برگشت به پیکربندی" }).click();
  await expect(page.getByText(/مسیر پنل حذف شد/)).toBeVisible();
  await page.goto("/ai/routes");
  // classify is the first task on the page.
  await expect(page.getByRole("table").first().locator("tbody tr")).toHaveCount(2);
});

test("AI prompts: the eval gate decides which version can go live", async ({ page }) => {
  await login(page, "aiops");
  await page.goto("/ai/prompts");
  await page.getByRole("link", { name: "intent.classify" }).click();
  await expect(page.getByText("نسخهٔ فعال: ۱")).toBeVisible();
  await expectNoA11yViolations(page);

  const versions = page.getByRole("list", { name: "نسخه‌ها" });
  await versions.getByRole("button", { name: /نسخهٔ ۳/ }).click();
  await page.getByRole("button", { name: "فعال‌سازی" }).click();
  const activate3 = page.getByRole("dialog", { name: "فعال‌سازی نسخهٔ ۳" });
  await activate3.getByLabel("دلیل").fill("آزمایش نسخهٔ کوتاه");
  await activate3.getByRole("button", { name: "فعال‌سازی" }).click();
  await expect(activate3.getByText("این نسخه از دروازهٔ ارزیابی نگذشته است.")).toBeVisible();
  await expect(activate3.getByText("شرط «دقت تشخیص نیت» برآورده نشده است.")).toBeVisible();
  await activate3.getByRole("button", { name: "انصراف" }).click();

  await versions.getByRole("button", { name: /نسخهٔ ۲/ }).click();
  await page.getByRole("button", { name: "مقایسه با نسخهٔ پایه" }).click();
  await expect(page.getByRole("region", { name: "تفاوت نسخهٔ ۱ و ۲" })).toContainText("If unsure, answer greeting.");
  await page.getByRole("button", { name: "فعال‌سازی" }).click();
  const activate2 = page.getByRole("dialog", { name: "فعال‌سازی نسخهٔ ۲" });
  await activate2.getByLabel("دلیل").fill("دقت بهتر روی مجموعهٔ پوشاک");
  await activate2.getByRole("button", { name: "فعال‌سازی" }).click();
  await expect(page.getByText("نسخهٔ ۲ فعال شد.")).toBeVisible();
  await expect(page.getByText("نسخهٔ فعال: ۲")).toBeVisible();

  await page.getByRole("button", { name: "نسخهٔ تازه" }).click();
  await page.getByLabel(/متن نسخهٔ تازه/).fill("Return one intent.\nMessage: {{message}}");
  await page.getByRole("button", { name: "ذخیرهٔ نسخه" }).click();
  await expect(page.getByText(/نسخهٔ ۴ ساخته شد/)).toBeVisible();
  await page.getByRole("button", { name: "اجرای ارزیابی" }).click();
  const run = page.getByRole("dialog", { name: "ارزیابی نسخهٔ ۴" });
  await run.getByLabel("مجموعهٔ ارزیابی").selectOption({ label: "fashion-fa (۱۲ نمونه)" });
  await run.getByRole("button", { name: "شروع ارزیابی" }).click();
  await expect(page.getByText(/ارزیابی شروع شد/)).toBeVisible();
  await expect(versions.getByRole("button", { name: /نسخهٔ ۴/ })).toContainText("از دروازه گذشت", { timeout: 15_000 });
});

test("AI evals: import JSON Lines and read a run, failures first", async ({ page }) => {
  await login(page, "aiops");
  await page.goto("/ai/evals");
  await expect(page.getByRole("table").last().locator("tbody tr")).toHaveCount(3);
  await page.getByLabel("نام مجموعه").fill("Bad Name");
  await page.getByLabel("خطوط JSON").fill('{"ref":"a1","input":"قیمت؟","expected":{"intent":"price"}}\nnot json\n{"ref":"a2","messages":[{"role":"customer","text":"سلام"}]}');
  await page.getByRole("button", { name: "وارد کردن" }).click();
  await expect(page.getByText(/نام باید با حرف کوچک انگلیسی/)).toBeVisible();
  await page.getByLabel("نام مجموعه").fill("jewelry-fa");
  await page.getByRole("button", { name: "وارد کردن" }).click();
  await expect(page.getByText("۲ نمونهٔ تازه، ۰ به‌روزشده، ۱ خط نادرست.")).toBeVisible();
  await expect(page.getByRole("table").first().getByText("jewelry-fa")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("table").last().locator("tbody tr").last().getByRole("link").click();
  await expect(page.getByTestId("run-summary")).toContainText("۸۳٫۳٪");
  const rows = page.getByRole("table").locator("tbody tr");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toContainText("نادرست");
  await expect(rows.last()).toContainText("درست");
  await expectNoA11yViolations(page);
});
