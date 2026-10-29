import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Pishkhan-admin-1234";
export const TOTP = "123456";

export async function resetMock(page: Page) {
  const response = await page.request.post("/api/mock/reset");
  expect(response.status()).toBe(204);
}

export async function login(page: Page, username: string, next = "/") {
  await page.goto(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("نام کاربری").fill(username);
  await page.getByLabel("رمز عبور").fill(PASSWORD);
  await page.getByLabel("کد تأیید دومرحله‌ای").fill(TOTP);
  await page.getByRole("button", { name: "ورود" }).click();
  await page.waitForURL((url) => url.pathname === new URL(next, "http://x").pathname);
}

export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}
