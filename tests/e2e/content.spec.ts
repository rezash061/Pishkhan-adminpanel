import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, login, resetMock } from "./helpers";

test.beforeEach(async ({ page }) => resetMock(page));

test("content: edit a draft post with blocks, then publish and schedule changes", async ({ page }) => {
  await login(page, "editor");
  await page.getByRole("navigation", { name: "منوی اصلی" }).getByRole("link", { name: "صفحه‌ها و نوشته‌ها" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(7);
  await page.getByLabel("نوع").selectOption("post");
  await expect(page).toHaveURL(/kind=post/);
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expectNoA11yViolations(page);

  await page.getByRole("link", { name: "قیمت‌گذاری در دایرکت" }).click();
  await page.getByRole("button", { name: "انتشار", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "انتشار", exact: true }).click();
  await expect(page.getByText("برای انتشار، یک دسته‌بندی انتخاب و ذخیره کنید.")).toBeVisible();
  await page.getByRole("button", { name: "انصراف" }).click();

  await page.getByLabel("دسته‌بندی").selectOption("instagram");
  await page.getByLabel("نوع بلوک").selectOption("h2");
  await page.getByRole("button", { name: "افزودن بلوک" }).click();
  await page.getByLabel("متن بلوک ۲").fill("سه قدم ساده");
  await page.getByLabel("نوع بلوک").selectOption("image");
  await page.getByRole("button", { name: "افزودن بلوک" }).click();
  await page.getByLabel("آدرس تصویر بلوک ۳").fill("http://insecure.example/a.png");
  await page.getByLabel("متن جایگزین بلوک ۳").fill("نمونهٔ دایرکت");
  await expect(page.getByRole("button", { name: "انتشار", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "ذخیرهٔ پیش‌نویس" }).click();
  await expect(page.getByText("آدرس باید مسیر سایت (/...) یا https باشد.")).toBeVisible();
  await page.getByLabel("آدرس تصویر بلوک ۳").fill("/images/dm.webp");
  await page.getByRole("button", { name: "بالا بردن بلوک ۲" }).click();
  await expect(page.getByRole("region", { name: "بلوک ۱: تیتر" })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "ذخیرهٔ پیش‌نویس" }).click();
  await expect(page.getByText("پیش‌نویس ذخیره شد.")).toBeVisible();

  await page.getByRole("button", { name: "انتشار", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "انتشار", exact: true }).click();
  await expect(page.getByText(/منتشر شد. سایت تا یک دقیقهٔ دیگر/)).toBeVisible();
  await expect(page.getByLabel("نامک (آدرس)")).toHaveAttribute("readonly", "");

  await page.getByLabel("عنوان", { exact: true }).fill("قیمت‌گذاری هوشمند در دایرکت");
  await expect(page.getByText("تغییرهای ذخیره‌نشده")).toBeVisible();
  await page.getByRole("button", { name: "ذخیرهٔ پیش‌نویس" }).click();
  await expect(page.getByText(/پیش‌نویس با نسخهٔ روی سایت فرق دارد/)).toBeVisible();
  await page.getByRole("button", { name: "انتشار تغییرها" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("در زمان مشخص").check();
  const later = new Date(Date.now() + 2 * 86_400_000);
  const local = new Date(later.getTime() - later.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await dialog.getByLabel("تاریخ و ساعت").fill(local);
  await dialog.getByRole("button", { name: "زمان‌بندی" }).click();
  await expect(page.getByText(/انتشار برای .* زمان‌بندی شد/)).toBeVisible();
  await expect(page.getByText("زمان‌بندی‌شده", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "لغو زمان‌بندی" }).click();
  await expect(page.getByText("زمان‌بندی لغو شد.")).toBeVisible();
});

test("content: create a post with a Persian slug, then delete the draft", async ({ page }) => {
  await login(page, "editor");
  await page.goto("/content/entries/new");
  await page.getByLabel("عنوان", { exact: true }).fill("راهنمای فروش در دایرکت!");
  await expect(page.getByLabel("نامک (آدرس)")).toHaveValue("راهنمای-فروش-در-دایرکت");
  await page.getByLabel("نامک (آدرس)").fill("پاسخ-خودکار-دایرکت");
  await page.getByRole("button", { name: "محتوای تازه" }).click();
  await expect(page.getByText("این نامک قبلاً به‌کار رفته است.").first()).toBeVisible();
  await page.getByLabel("نامک (آدرس)").fill("راهنمای-فروش");
  await page.getByRole("button", { name: "محتوای تازه" }).click();
  await expect(page.getByText("پیش‌نویس ساخته شد.")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: "حذف" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(page).toHaveURL(/\/content\/entries$/);
  await expect(page.getByRole("link", { name: "راهنمای فروش در دایرکت!" })).toHaveCount(0);
});

test("content: a case study needs the seller's consent before it goes live", async ({ page }) => {
  await login(page, "editor");
  await page.goto("/content/entries?kind=case_study");
  await page.getByRole("link", { name: "بوتیک رز" }).click();
  await page.getByRole("button", { name: "انتشار", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "انتشار", exact: true }).click();
  await expect(page.getByText("برای انتشار نمونه‌کار، موافقت فروشنده لازم است.")).toBeVisible();
  await page.getByRole("button", { name: "انصراف" }).click();
  await page.getByLabel("فروشنده با انتشار این نمونه‌کار موافقت کرده است").check();
  await page.getByLabel("شاخص‌ها (JSON)").fill("[{");
  await page.getByRole("button", { name: "ذخیرهٔ پیش‌نویس" }).click();
  await expect(page.getByText("JSON نادرست است؛ باید یک شیء باشد.")).toBeVisible();
  await page.getByLabel("شاخص‌ها (JSON)").fill('[{"label": "پاسخ خودکار", "value": "۸۰٪"}]');
  await page.getByRole("button", { name: "ذخیرهٔ پیش‌نویس" }).click();
  await expect(page.getByText("پیش‌نویس ذخیره شد.")).toBeVisible();
  await page.getByRole("button", { name: "انتشار", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "انتشار", exact: true }).click();
  await expect(page.getByText(/منتشر شد/)).toBeVisible();
});

test("content: categories and redirects", async ({ page }) => {
  await login(page, "editor");
  await page.goto("/content/categories");
  await page.getByRole("button", { name: "دستهٔ تازهٔ بلاگ" }).click();
  const dialog = page.getByRole("dialog", { name: "دستهٔ تازهٔ بلاگ" });
  await dialog.getByLabel("عنوان").fill("فروش بیشتر");
  await expect(dialog.getByLabel("نامک")).toHaveValue("فروش-بیشتر");
  await dialog.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("cell", { name: "فروش بیشتر", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "حذف اینستاگرام" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(page.getByText("این دسته محتوا دارد و حذف نمی‌شود.")).toBeVisible();
  await page.getByRole("button", { name: "انصراف" }).click();
  await expectNoA11yViolations(page);

  await page.goto("/content/redirects");
  await page.getByLabel("از مسیر").fill("/pricing-old");
  await page.getByLabel("به", { exact: true }).fill("/plans");
  await page.getByRole("button", { name: "افزودن" }).click();
  await expect(page.getByText("برای این مسیر تغییر مسیر هست.")).toBeVisible();
  await page.getByLabel("از مسیر").fill("/blog/old-post");
  await page.getByLabel("به", { exact: true }).fill("http://example.com");
  await page.getByRole("button", { name: "افزودن" }).click();
  await expect(page.getByText(/مسیر باید با \/ شروع شود/).first()).toBeVisible();
  await page.getByLabel("به", { exact: true }).fill("/blog/new-post");
  await page.getByRole("button", { name: "افزودن" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "حذف تغییر مسیر /pricing-old" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expectNoA11yViolations(page);
});

test("content: Support can read but not edit", async ({ page }) => {
  await login(page, "support");
  await page.goto("/content/entries");
  await expect(page.locator("tbody tr")).toHaveCount(7);
  await expect(page.getByRole("link", { name: "محتوای تازه" })).toHaveCount(0);
  await page.getByRole("link", { name: "پاسخ خودکار دایرکت اینستاگرام" }).click();
  await expect(page.getByLabel("عنوان", { exact: true })).toHaveAttribute("readonly", "");
  await expect(page.getByRole("button", { name: "ذخیرهٔ پیش‌نویس" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "پیش‌نمایش" })).toBeVisible();
  await expectNoA11yViolations(page);
});
