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
