import { beforeEach, describe, expect, it } from "vitest";
import type { AdminPayment, AdminPaymentDetail, AdminSubscriptionRow, BillingSummary, PagedResult } from "@/lib/api/types";
import { handleMockRequest, resetMockState } from "./admin-api";

const call = (method: string, path: string, body?: unknown, token?: string) =>
  handleMockRequest(
    new Request(`http://mock.invalid${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? null : JSON.stringify(body),
    }),
  );
const login = async (username: string) =>
  (await (await call("POST", "/admin/v1/auth/login", { username, password: "Pishkhan-admin-1234", totpCode: "123456" })).json()).accessToken as string;
const stepUp = async (token: string) =>
  (await (await call("POST", "/admin/v1/auth/step-up", { password: "Pishkhan-admin-1234", totpCode: "123456" }, token)).json()).accessToken as string;

const PRO_PAYMENT = "01938fb0-0000-7000-8000-000000000001";
const B001 = "01938f61-0000-7000-8000-00000000b001";

// Keeps the mock honest about backend PR #54's billing admin endpoints.
describe("mock billing admin", () => {
  beforeEach(() => resetMockState());

  it("lists paid payments by default, other statuses on request, and refuses an unknown status", async () => {
    const token = await login("readonly");
    const paid = (await (await call("GET", "/admin/v1/billing/payments", undefined, token)).json()) as PagedResult<AdminPayment>;
    expect(paid.items.every((p) => p.status === "paid")).toBe(true);
    expect(paid.items.find((p) => p.kind === "upgrade")?.refunded).toBe(1_000_000);
    const expired = (await (await call("GET", "/admin/v1/billing/payments?status=expired", undefined, token)).json()) as PagedResult<AdminPayment>;
    expect(expired.totalCount).toBe(1);
    expect((await call("GET", "/admin/v1/billing/payments?status=weird", undefined, token)).status).toBe(400);
    expect((await call("GET", "/admin/v1/billing/payments", undefined, await login("editor"))).status).toBe(403);
  });

  it("lists current subscriptions with the paying checkout", async () => {
    const token = await login("support");
    const rows = (await (await call("GET", `/admin/v1/billing/subscriptions?workspaceId=${B001}`, undefined, token)).json()) as PagedResult<AdminSubscriptionRow>;
    expect(rows.items).toHaveLength(1);
    expect(rows.items[0]!.subscription.checkoutId).toBe(PRO_PAYMENT);
    const all = (await (await call("GET", `/admin/v1/billing/subscriptions?state=all&workspaceId=${B001}`, undefined, token)).json()) as PagedResult<AdminSubscriptionRow>;
    expect(all.totalCount).toBe(2);
  });

  it("records refunds for Finance with step-up, capped at what is left, and can end the subscription", async () => {
    const finance = await login("finance");
    const url = `/admin/v1/billing/payments/${PRO_PAYMENT}/refunds`;
    expect((await call("POST", url, { amount: 10, reason: "test refund" }, await login("support"))).status).toBe(403);
    expect((await call("POST", url, { amount: 10, reason: "test refund" }, finance)).status).toBe(403);
    const fresh = await stepUp(finance);
    const tooMuch = await call("POST", url, { amount: 6_990_001, reason: "test refund" }, fresh);
    expect(((await tooMuch.json()) as { errors: Record<string, string[]> }).errors.amount).toEqual(["billing.refund.too_much"]);
    const partial = (await (await call("POST", url, { amount: 990_000, reason: "test refund" }, fresh)).json()) as AdminPaymentDetail;
    expect(partial.payment.refunded).toBe(990_000);
    expect(partial.subscription?.state).toBe("active");
    const full = (await (await call("POST", url, { amount: 6_000_000, reason: "the rest", endSubscription: true }, fresh)).json()) as AdminPaymentDetail;
    expect(full.refunds).toHaveLength(2);
    expect(full.subscription?.endReason).toBe("refunded");
    expect((await call("GET", `/admin/v1/workspaces/${B001}/billing`, undefined, fresh)).ok).toBe(true);
    const failed = "01938fb0-0000-7000-8000-000000000004";
    expect(((await (await call("POST", `/admin/v1/billing/payments/${failed}/refunds`, { amount: 1, reason: "test refund" }, fresh)).json()) as { code: string }).code).toBe("billing.refund.not_paid");
    const summary = (await (await call("GET", "/admin/v1/billing/summary?days=30", undefined, fresh)).json()) as BillingSummary;
    expect(summary.netAmount).toBe(summary.paidAmount - summary.refundedAmount);
    expect(summary.refundCount).toBe(3);
  });
});

describe("mock coupons and wallets", () => {
  beforeEach(() => resetMockState());

  it("lets Finance create coupons with unique codes and lists them by state", async () => {
    const finance = await login("finance");
    const created = await call("POST", "/admin/v1/billing/coupons", { code: "yalda-1405", kind: "percent", value: 30, maxPerWorkspace: 1, planCodes: [], firstPurchaseOnly: false, active: true }, finance);
    expect(created.status).toBe(201);
    expect(((await created.json()) as { code: string }).code).toBe("YALDA-1405");
    expect((await call("POST", "/admin/v1/billing/coupons", { code: "YALDA-1405", kind: "percent", value: 30 }, finance)).status).toBe(409);
    expect((await call("POST", "/admin/v1/billing/coupons", { code: "x", kind: "percent", value: 0 }, finance)).status).toBe(400);
    expect((await call("POST", "/admin/v1/billing/coupons", { code: "SUPPORT", kind: "percent", value: 5 }, await login("support"))).status).toBe(403);
    const disabled = (await (await call("GET", "/admin/v1/billing/coupons?state=disabled", undefined, finance)).json()) as { items: { code: string }[] };
    expect(disabled.items.map((c) => c.code)).toEqual(["OLD-100K"]);
  });

  it("adjusts a wallet with step-up and never below zero", async () => {
    const ws = "01938f61-0000-7000-8000-00000000b004";
    const finance = await login("finance");
    expect((await call("POST", `/admin/v1/workspaces/${ws}/wallet/adjustments`, { amount: 10, reason: "compensation" }, finance)).status).toBe(403);
    const fresh = await stepUp(finance);
    expect(((await (await call("POST", `/admin/v1/workspaces/${ws}/wallet/adjustments`, { amount: -2_000_000, reason: "too much off" }, fresh)).json()) as { code: string }).code).toBe("billing.wallet.insufficient");
    const after = (await (await call("POST", `/admin/v1/workspaces/${ws}/wallet/adjustments`, { amount: 500_000, reason: "compensation" }, fresh)).json()) as { balance: { amount: number } };
    expect(after.balance.amount).toBe(1_500_000);
  });

  it("refunds into the wallet and gives back the wallet part", async () => {
    const fresh = await stepUp(await login("finance"));
    const upgrade = "01938fb0-0000-7000-8000-000000000003";
    const detail = (await (await call("POST", `/admin/v1/billing/payments/${upgrade}/refunds`, { amount: 0, reason: "ended by staff", endSubscription: true }, fresh)).json()) as AdminPaymentDetail;
    expect(detail.payment.walletReleased).toBe(true);
    expect(detail.refunds.at(-1)?.walletReturned).toBe(2_000_000);
    await call("POST", `/admin/v1/billing/payments/${upgrade}/refunds`, { amount: 100_000, reason: "to the wallet", toWallet: true }, fresh);
    const wallet = (await (await call("GET", "/admin/v1/workspaces/01938f61-0000-7000-8000-00000000b004/wallet", undefined, fresh)).json()) as { balance: { amount: number } };
    expect(wallet.balance.amount).toBe(3_100_000);
  });
});
