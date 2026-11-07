import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, login, PASSWORD, resetMock, TOTP } from "./helpers";

test.beforeEach(async ({ page }) => resetMock(page));

test("protected pages redirect to sign-in and come back afterwards", async ({ page }) => {
  await page.goto("/security/audit-log?action=staff.create");
  await expect(page).toHaveURL(/\/login\?next=%2Fsecurity%2Faudit-log%3Faction%3Dstaff\.create/);
  await expectNoA11yViolations(page);
  await login(page, "superadmin", "/security/audit-log?action=staff.create");
  await expect(page.getByRole("heading", { name: "گزارش ممیزی" })).toBeVisible();
  await expect(page.getByLabel("عملیات")).toHaveValue("staff.create");
});

test("wrong password and missing TOTP show Persian errors", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("نام کاربری").fill("superadmin");
  await page.getByLabel("رمز عبور").fill("wrong-password");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page.getByText("نام کاربری یا رمز عبور نادرست است.")).toBeVisible();

  await page.getByLabel("رمز عبور").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page.getByText("کد تأیید دومرحله‌ای را وارد کنید.")).toBeVisible();
  await expect(page.getByLabel("کد تأیید دومرحله‌ای")).toBeFocused();
});

test("tokens never reach JavaScript", async ({ page, context }) => {
  await login(page, "superadmin");
  const cookies = await context.cookies();
  const session = cookies.filter((c) => /admin_(at|rt)$/.test(c.name));
  expect(session).toHaveLength(2);
  for (const c of session) {
    expect(c.httpOnly).toBe(true);
    expect(c.sameSite).toBe("Strict");
  }
  expect(await page.evaluate(() => document.cookie)).not.toMatch(/admin_(at|rt)=/);
});

test("first sign-in enrolls TOTP before the session starts", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("نام کاربری").fill("newbie");
  await page.getByLabel("رمز عبور").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود" }).click();

  await expect(page.getByRole("heading", { name: "فعال‌سازی ورود دومرحله‌ای" })).toBeVisible();
  await expect(page.getByRole("img", { name: /کد QR/ })).toBeVisible();
  await expect(page.getByTestId("totp-secret")).toHaveText("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP");
  await expectNoA11yViolations(page);

  await page.getByLabel("کد ۶ رقمی برنامه").fill("000000");
  await page.getByRole("button", { name: "تأیید و ورود" }).click();
  await expect(page.getByText("کد تأیید نادرست یا منقضی است.")).toBeVisible();

  await page.getByLabel("کد ۶ رقمی برنامه").fill(TOTP);
  await page.getByRole("button", { name: "تأیید و ورود" }).click();

  // Ten one-time recovery codes, shown once; the session starts after the staff member says they saved them.
  await expect(page.getByRole("heading", { name: "کدهای بازیابی" })).toBeVisible();
  const codes = await page.getByTestId("recovery-codes").locator("li").allTextContents();
  expect(codes).toHaveLength(10);
  codes.forEach((c) => expect(c).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/));
  await expectNoA11yViolations(page);
  const go = page.getByRole("button", { name: "ورود به پنل" });
  await expect(go).toBeDisabled();
  await page.getByLabel("کدها را در جای امنی ذخیره کردم.").check();
  await go.click();
  await expect(page.getByRole("heading", { name: "خوش آمدید، newbie" })).toBeVisible();

  // A recovery code signs in once, in place of the TOTP code.
  for (const [attempt, ok] of [[1, true], [2, false]] as const) {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("نام کاربری").fill("newbie");
    await page.getByLabel("رمز عبور").fill(PASSWORD);
    await page.getByLabel("کد تأیید دومرحله‌ای").fill(codes[0]!.toUpperCase());
    await page.getByRole("button", { name: "ورود" }).click();
    if (ok) await expect(page.getByRole("heading", { name: "خوش آمدید، newbie" }), `attempt ${attempt}`).toBeVisible();
    else await expect(page.getByText("کد تأیید نادرست یا منقضی است.")).toBeVisible();
  }

  // Settings: nine left; new codes after step-up replace them all.
  await page.getByLabel("کد تأیید دومرحله‌ای").fill(TOTP);
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page.getByRole("heading", { name: "خوش آمدید، newbie" })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByTestId("recovery-codes-left")).toHaveText("۹ کد بازیابی باقی مانده است.");
  await page.getByRole("button", { name: "گرفتن کدهای تازه" }).click();
  await page.getByRole("button", { name: "گرفتن کدهای تازه" }).click();
  const stepUp = page.getByRole("dialog", { name: "تأیید دوباره هویت" });
  await stepUp.getByLabel("رمز عبور").fill(PASSWORD);
  await stepUp.getByLabel("کد دومرحله‌ای").fill(TOTP);
  await stepUp.getByRole("button", { name: "تأیید و ادامه" }).click();
  await expect(page.getByText("کدهای تازه ساخته شد.", { exact: false })).toBeVisible();
  await expect(page.getByTestId("recovery-codes").locator("li")).toHaveCount(10);
  await expect(page.getByTestId("recovery-codes-left")).toHaveText("۱۰ کد بازیابی باقی مانده است.");
});

test("an expired access token is refreshed transparently", async ({ page, context }) => {
  await login(page, "superadmin");
  const cookies = await context.cookies();
  await context.clearCookies();
  await context.addCookies(cookies.filter((c) => !c.name.endsWith("admin_at")));
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "تنظیمات حساب" })).toBeVisible();
  expect((await context.cookies()).some((c) => c.name.endsWith("admin_at"))).toBe(true);
});

test("logging out ends the session", async ({ page }) => {
  await login(page, "superadmin");
  await page.getByRole("button", { name: "واردشده با نام superadmin" }).click();
  await page.getByRole("menuitem", { name: "خروج" }).click();
  await expect(page).toHaveURL(/\/login\?reason=loggedOut/);
  await expect(page.getByText("از حساب خارج شدید.")).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("idle timeout warns, then signs out", async ({ page }) => {
  await page.clock.install();
  await login(page, "superadmin");
  // Wait for hydration so the idle tracker is running before time jumps.
  await expect(page.getByTestId("health-summary")).toBeVisible();
  await page.clock.fastForward("13:01");
  const warning = page.getByRole("dialog", { name: "هنوز اینجا هستید؟" });
  await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "ادامهٔ کار" }).click();
  await expect(warning).toBeHidden();

  await page.clock.fastForward("15:05");
  await expect(page).toHaveURL(/\/login\?reason=idle/);
  await expect(page.getByText("به دلیل عدم فعالیت از حساب خارج شدید.")).toBeVisible();
});
