// Mock state and handlers for billing across workspaces (/admin/v1/billing), as in backend PR #54: subscriptions, Zarinpal payments with
// their invoices, refunds and the summary. Subscriptions are the main mock's own list, so a refund that ends one shows on the workspace page.

import type {
  AdminCoupon,
  AdminCouponDetail,
  AdminPayment,
  AdminPaymentDetail,
  AdminRefund,
  AdminSubscriptionRow,
  BillingSubscription,
  BillingSummary,
  WalletEntry,
  WalletInfo,
} from "@/lib/api/types";
import { planFixtures, workspaceFixtures } from "./fixtures";

type Problem = (
  status: number,
  code: string,
  errors?: Record<string, string[]>,
) => Response;

const READERS = ["SuperAdmin", "Finance", "Support", "ReadOnly"];
const REFUNDERS = ["SuperAdmin", "Finance"];
const DAY = 86_400_000;
/** A pending checkout older than this is expired (backend Checkout.Lifetime). */
const LIFETIME = 30 * 60_000;

/** The main mock's subscription record; billing adds the cycle and the checkout that paid for it. */
export interface BillingMockSubscription {
  id: string;
  workspaceId: string;
  planId: string;
  planCode: string;
  planVersion: number;
  status: "active" | "ended";
  trial: boolean;
  startsAt: string;
  endsAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  cycle?: string | null;
  checkoutId?: string | null;
}

type MockPayment = Omit<AdminPayment, "refunded" | "workspaceName">;

type MockCoupon = Omit<AdminCoupon, "state" | "discountTotal">;

export interface BillingMockState {
  payments: MockPayment[];
  refunds: AdminRefund[];
  coupons: MockCoupon[];
  /** Wallet entries by workspace, oldest first. */
  wallets: Record<string, WalletEntry[]>;
}

const nameOf = (workspaceId: string) =>
  workspaceFixtures.find((w) => w.id === workspaceId)?.name ?? null;

/** Paid checkouts for b001's pro plan and two other shops, one failed, one pending, one expired. Links b001's current pro subscription. */
export function seedBilling(
  subscriptions: BillingMockSubscription[],
): BillingMockState {
  const now = Date.now();
  const iso = (ms: number) => new Date(now - ms).toISOString();
  const pro = planFixtures.find(
    (p) => p.code === "pro" && p.status === "published",
  )!;
  const basic = planFixtures.find(
    (p) => p.code === "basic" && p.status === "published",
  )!;
  const ws = (n: string) => `01938f61-0000-7000-8000-00000000b${n}`;
  const proSub = subscriptions.find(
    (s) => s.workspaceId === ws("001") && s.status === "active" && !s.trial,
  );
  const pay = (n: number, over: Partial<MockPayment>): MockPayment => ({
    id: `01938fb0-0000-7000-8000-0000000000${String(n).padStart(2, "0")}`,
    workspaceId: ws("001"),
    kind: "new",
    planCode: pro.code,
    planName: pro.name,
    planVersion: pro.version,
    cycle: "monthly",
    price: pro.monthly!.amount,
    credit: 0,
    amount: pro.monthly!.amount,
    status: "paid",
    referenceId: `20${n}`,
    cardMask: "502229******5995",
    error: null,
    invoiceNumber: 1000 + n,
    subscriptionId: null,
    createdAt: iso(n * DAY),
    paidAt: iso(n * DAY - 60_000),
    discount: 0,
    couponCode: null,
    walletUsed: 0,
    walletReleased: false,
    ...over,
  });
  const payments = [
    pay(1, {
      subscriptionId: proSub?.id ?? null,
      createdAt: iso(10 * DAY + 120_000),
      paidAt: iso(10 * DAY),
    }),
    pay(2, {
      workspaceId: ws("002"),
      planCode: basic.code,
      planName: basic.name,
      planVersion: basic.version,
      price: basic.monthly!.amount,
      amount: basic.monthly!.amount,
    }),
    pay(3, {
      workspaceId: ws("004"),
      kind: "upgrade",
      credit: 1_200_000,
      discount: 579_000,
      couponCode: "NOWRUZ",
      amount: pro.monthly!.amount - 1_200_000 - 579_000 - 2_000_000,
      walletUsed: 2_000_000,
    }),
    pay(4, {
      workspaceId: ws("005"),
      status: "failed",
      referenceId: null,
      cardMask: null,
      invoiceNumber: null,
      paidAt: null,
      error: "cancelled",
    }),
    pay(5, {
      workspaceId: ws("006"),
      status: "pending",
      referenceId: null,
      cardMask: null,
      invoiceNumber: null,
      paidAt: null,
      createdAt: iso(5 * 60_000),
    }),
    pay(6, {
      workspaceId: ws("007"),
      status: "pending",
      referenceId: null,
      cardMask: null,
      invoiceNumber: null,
      paidAt: null,
      createdAt: iso(3 * 60 * 60_000),
    }),
  ];
  if (proSub) {
    proSub.cycle = "monthly";
    proSub.checkoutId = payments[0]!.id;
  }
  return {
    payments,
    refunds: [
      {
        id: "01938fb1-0000-7000-8000-000000000001",
        checkoutId: payments[2]!.id,
        amount: 1_000_000,
        reason: "اختلال سرویس در هفتهٔ اول",
        referenceId: "R-5521",
        endedSubscription: false,
        createdBy: "finance",
        createdAt: iso(DAY),
        toWallet: false,
        walletReturned: 0,
      },
    ],
    coupons: [
      coupon(1, "NOWRUZ", {
        description: "تخفیف نوروزی",
        value: 10,
        maxRedemptions: 200,
        redemptions: 1,
        validUntil: iso(-40 * DAY),
      }),
      coupon(2, "WELCOME50", {
        description: "خرید اول",
        value: 50,
        firstPurchaseOnly: true,
        planCodes: ["basic"],
      }),
      coupon(3, "OLD-100K", { kind: "fixed", value: 1_000_000, active: false }),
      coupon(4, "SUMMER", { value: 15, validUntil: iso(DAY) }),
    ],
    wallets: {
      [ws("004")]: [
        walletEntry(
          1,
          ws("004"),
          3_000_000,
          3_000_000,
          "adjustment",
          "جبران قطعی اینستاگرام",
          null,
          iso(5 * DAY),
        ),
        walletEntry(
          2,
          ws("004"),
          -2_000_000,
          1_000_000,
          "checkout",
          null,
          payments[2]!.id,
          iso(3 * DAY),
        ),
      ],
    },
  };
  function coupon(
    n: number,
    code: string,
    over: Partial<MockCoupon>,
  ): MockCoupon {
    return {
      id: `01938fb2-0000-7000-8000-0000000000${String(n).padStart(2, "0")}`,
      code,
      description: null,
      kind: "percent",
      value: 10,
      planCodes: [],
      firstPurchaseOnly: false,
      maxRedemptions: null,
      maxPerWorkspace: 1,
      validFrom: null,
      validUntil: null,
      active: true,
      redemptions: 0,
      createdAt: iso((20 - n) * DAY),
      updatedAt: iso((20 - n) * DAY),
      ...over,
    };
  }
}

function walletEntry(
  n: number,
  workspaceId: string,
  amount: number,
  after: number,
  kind: string,
  reason: string | null,
  checkoutId: string | null,
  createdAt: string,
): WalletEntry {
  return {
    id: `01938fb3-0000-7000-8000-${workspaceId.slice(-4)}000000${String(n).padStart(2, "0")}`,
    kind,
    amount: { amount, currency: "IRR" },
    balanceAfter: { amount: after, currency: "IRR" },
    reason,
    checkoutId,
    actorKind: kind === "adjustment" ? "staff" : "user",
    createdAt,
  };
}

export function couponState(c: MockCoupon, now: number): string {
  if (!c.active) return "disabled";
  if (c.validFrom && Date.parse(c.validFrom) > now) return "scheduled";
  if (c.validUntil && Date.parse(c.validUntil) <= now) return "expired";
  if (c.maxRedemptions !== null && c.redemptions >= c.maxRedemptions)
    return "used_up";
  return "active";
}

const CODE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

function couponErrors(
  b: Record<string, unknown>,
  creating: boolean,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (
    creating &&
    (typeof b.code !== "string" || !CODE.test(b.code.trim().toUpperCase()))
  )
    errors.code = ["billing.coupon.code_invalid"];
  if (creating && b.kind !== "percent" && b.kind !== "fixed")
    errors.kind = ["validation.invalid"];
  else if (creating) {
    const v = Number(b.value);
    if (
      !Number.isInteger(v) ||
      (b.kind === "percent"
        ? v < 1 || v > 100
        : v < 10_000 || v > 10_000_000_000)
    )
      errors.value = ["validation.out_of_range"];
  }
  if (typeof b.description === "string" && b.description.length > 200)
    errors.description = ["validation.too_long"];
  if (
    b.maxRedemptions != null &&
    (Number(b.maxRedemptions) < 1 || Number(b.maxRedemptions) > 1_000_000)
  )
    errors.maxRedemptions = ["validation.out_of_range"];
  if (
    b.maxPerWorkspace != null &&
    (Number(b.maxPerWorkspace) < 1 || Number(b.maxPerWorkspace) > 100)
  )
    errors.maxPerWorkspace = ["validation.out_of_range"];
  if (
    typeof b.validFrom === "string" &&
    typeof b.validUntil === "string" &&
    Date.parse(b.validUntil) <= Date.parse(b.validFrom)
  )
    errors.validUntil = ["billing.coupon.ends_before_start"];
  return errors;
}

function statusOf(p: MockPayment, now: number): string {
  return p.status === "pending" && now - Date.parse(p.createdAt) > LIFETIME
    ? "expired"
    : p.status;
}

function subscriptionState(s: BillingMockSubscription, now: number): string {
  if (s.status === "ended") return "ended";
  if (Date.parse(s.startsAt) > now) return "scheduled";
  if (s.endsAt && Date.parse(s.endsAt) <= now) return "expired";
  return s.trial ? "trialing" : "active";
}

function toSubscription(
  s: BillingMockSubscription,
  now: number,
): BillingSubscription {
  return {
    id: s.id,
    planId: s.planId,
    planCode: s.planCode,
    planVersion: s.planVersion,
    state: subscriptionState(s, now),
    trial: s.trial,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    endedAt: s.endedAt,
    endReason: s.endReason,
    cycle: s.cycle ?? null,
    checkoutId: s.checkoutId ?? null,
  };
}

const page = (q: URLSearchParams) => {
  const p = Math.max(1, Number(q.get("page") ?? 1) || 1);
  const size = Math.min(
    100,
    Math.max(1, Number(q.get("pageSize") ?? 25) || 25),
  );
  return { p, size };
};

export async function handleBilling(
  request: Request,
  url: URL,
  s: BillingMockState,
  subscriptions: BillingMockSubscription[],
  user: { username: string; roles: string[] },
  stepUpFresh: boolean,
  problem: Problem,
): Promise<Response | null> {
  const has = (list: string[]) => user.roles.some((r) => list.includes(r));
  const path = url.pathname;
  const q = url.searchParams;
  const now = Date.now();
  const refunded = (id: string) =>
    s.refunds
      .filter((r) => r.checkoutId === id)
      .reduce((sum, r) => sum + r.amount, 0);
  const payment = (p: MockPayment): AdminPayment => ({
    ...p,
    status: statusOf(p, now),
    refunded: refunded(p.id),
    workspaceName: nameOf(p.workspaceId),
  });
  const detail = (p: MockPayment): AdminPaymentDetail => {
    const sub = p.subscriptionId
      ? subscriptions.find((x) => x.id === p.subscriptionId)
      : undefined;
    return {
      payment: payment(p),
      refunds: s.refunds
        .filter((r) => r.checkoutId === p.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      subscription: sub ? toSubscription(sub, now) : null,
    };
  };

  if (request.method === "GET" && path === "/admin/v1/billing/subscriptions") {
    if (!has(READERS)) return problem(403, "auth.forbidden");
    const state = q.get("state") || "current";
    const match: Record<string, (x: BillingSubscription) => boolean> = {
      current: (x) => x.state === "active" || x.state === "trialing",
      trialing: (x) => x.state === "trialing",
      scheduled: (x) => x.state === "scheduled",
      ended: (x) => x.state === "ended" || x.state === "expired",
      all: () => true,
    };
    if (!match[state])
      return problem(400, "validation.failed", {
        state: ["validation.invalid"],
      });
    const rows: AdminSubscriptionRow[] = subscriptions
      .map((x) => ({ raw: x, sub: toSubscription(x, now) }))
      .filter(({ sub }) => match[state]!(sub))
      .filter(
        ({ sub }) => !q.get("planCode") || sub.planCode === q.get("planCode"),
      )
      .filter(
        ({ raw }) =>
          !q.get("workspaceId") || raw.workspaceId === q.get("workspaceId"),
      )
      .sort((a, b) => b.raw.startsAt.localeCompare(a.raw.startsAt))
      .map(({ raw, sub }) => ({
        subscription: sub,
        workspaceId: raw.workspaceId,
        workspaceName: nameOf(raw.workspaceId),
      }));
    const { p, size } = page(q);
    return Response.json({
      items: rows.slice((p - 1) * size, p * size),
      totalCount: rows.length,
      page: p,
      pageSize: size,
    });
  }

  if (request.method === "GET" && path === "/admin/v1/billing/payments") {
    if (!has(READERS)) return problem(403, "auth.forbidden");
    const status = q.get("status") || "paid";
    if (!["paid", "pending", "failed", "expired", "all"].includes(status))
      return problem(400, "validation.failed", {
        status: ["validation.invalid"],
      });
    const rows = s.payments
      .map(payment)
      .filter((x) => status === "all" || x.status === status)
      .filter((x) => !q.get("kind") || x.kind === q.get("kind"))
      .filter(
        (x) => !q.get("workspaceId") || x.workspaceId === q.get("workspaceId"),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const { p, size } = page(q);
    return Response.json({
      items: rows.slice((p - 1) * size, p * size),
      totalCount: rows.length,
      page: p,
      pageSize: size,
    });
  }

  if (request.method === "GET" && path === "/admin/v1/billing/summary") {
    if (!has(READERS)) return problem(403, "auth.forbidden");
    const days = Math.min(366, Math.max(1, Number(q.get("days") ?? 30) || 30));
    const since = now - days * DAY;
    const paid = s.payments.filter(
      (x) => x.status === "paid" && x.paidAt && Date.parse(x.paidAt) >= since,
    );
    const refunds = s.refunds.filter((r) => Date.parse(r.createdAt) >= since);
    const recent = s.payments.filter((x) => Date.parse(x.createdAt) >= since);
    const paidAmount = paid.reduce((sum, x) => sum + x.amount, 0);
    const refundedAmount = refunds.reduce((sum, r) => sum + r.amount, 0);
    const body: BillingSummary = {
      days,
      paidCount: paid.length,
      paidAmount,
      refundCount: refunds.length,
      refundedAmount,
      netAmount: paidAmount - refundedAmount,
      failedCount: recent.filter((x) => x.status === "failed").length,
      pendingCount: recent.filter((x) => statusOf(x, now) === "pending").length,
    };
    return Response.json(body);
  }

  const couponOut = (c: MockCoupon): AdminCoupon => ({
    ...c,
    state: couponState(c, now),
    discountTotal: s.payments
      .filter((p) => p.couponCode === c.code && p.status === "paid")
      .reduce((sum, p) => sum + p.discount, 0),
  });
  const couponDetail = (c: MockCoupon): AdminCouponDetail => ({
    coupon: couponOut(c),
    redemptions: s.payments
      .filter((p) => p.couponCode === c.code && p.status === "paid")
      .map((p) => ({
        checkoutId: p.id,
        workspaceId: p.workspaceId,
        workspaceName: nameOf(p.workspaceId),
        discount: p.discount,
        invoiceNumber: p.invoiceNumber,
        createdAt: p.paidAt ?? p.createdAt,
      })),
  });

  if (path === "/admin/v1/billing/coupons") {
    if (request.method === "GET") {
      if (!has(READERS)) return problem(403, "auth.forbidden");
      const state = q.get("state");
      if (
        state &&
        !["active", "scheduled", "expired", "used_up", "disabled"].includes(
          state,
        )
      )
        return problem(400, "validation.failed", {
          state: ["validation.invalid"],
        });
      const term = q.get("q")?.trim().toLowerCase() ?? "";
      const rows = s.coupons
        .map(couponOut)
        .filter((c) => !state || c.state === state)
        .filter(
          (c) =>
            !term ||
            c.code.toLowerCase().includes(term) ||
            (c.description ?? "").toLowerCase().includes(term),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const { p, size } = page(q);
      return Response.json({
        items: rows.slice((p - 1) * size, p * size),
        totalCount: rows.length,
        page: p,
        pageSize: size,
      });
    }
    if (request.method === "POST") {
      if (!has(REFUNDERS)) return problem(403, "auth.forbidden");
      const b = (await request.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const errors = couponErrors(b, true);
      if (Object.keys(errors).length)
        return problem(400, "validation.failed", errors);
      const code = String(b.code).trim().toUpperCase();
      if (s.coupons.some((c) => c.code === code))
        return problem(409, "billing.coupon.code_taken");
      const at = new Date(now).toISOString();
      const created: MockCoupon = {
        id: crypto.randomUUID(),
        code,
        description: (b.description as string | null)?.trim() || null,
        kind: String(b.kind),
        value: Number(b.value),
        planCodes: (b.planCodes as string[] | undefined) ?? [],
        firstPurchaseOnly: !!b.firstPurchaseOnly,
        maxRedemptions:
          b.maxRedemptions == null ? null : Number(b.maxRedemptions),
        maxPerWorkspace:
          b.maxPerWorkspace == null ? 1 : Number(b.maxPerWorkspace),
        validFrom: (b.validFrom as string | null) ?? null,
        validUntil: (b.validUntil as string | null) ?? null,
        active: b.active !== false,
        redemptions: 0,
        createdAt: at,
        updatedAt: at,
      };
      s.coupons.push(created);
      return Response.json(couponOut(created), { status: 201 });
    }
  }

  const couponMatch = /^\/admin\/v1\/billing\/coupons\/([^/]+)$/.exec(path);
  if (couponMatch) {
    const found = s.coupons.find((c) => c.id === couponMatch[1]);
    if (request.method === "GET") {
      if (!has(READERS)) return problem(403, "auth.forbidden");
      return found
        ? Response.json(couponDetail(found))
        : problem(404, "common.not_found");
    }
    if (request.method === "PUT") {
      if (!has(REFUNDERS)) return problem(403, "auth.forbidden");
      if (!found) return problem(404, "common.not_found");
      const b = (await request.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const errors = couponErrors(b, false);
      if (Object.keys(errors).length)
        return problem(400, "validation.failed", errors);
      Object.assign(found, {
        description: (b.description as string | null)?.trim() || null,
        planCodes: (b.planCodes as string[] | undefined) ?? [],
        firstPurchaseOnly: !!b.firstPurchaseOnly,
        maxRedemptions:
          b.maxRedemptions == null ? null : Number(b.maxRedemptions),
        maxPerWorkspace:
          b.maxPerWorkspace == null ? 1 : Number(b.maxPerWorkspace),
        validFrom: (b.validFrom as string | null) ?? null,
        validUntil: (b.validUntil as string | null) ?? null,
        active: !!b.active,
        updatedAt: new Date(now).toISOString(),
      });
      return Response.json(couponOut(found));
    }
  }

  const walletMatch =
    /^\/admin\/v1\/workspaces\/([0-9a-f-]{36})\/wallet(\/adjustments)?$/i.exec(
      path,
    );
  if (walletMatch) {
    const wsId = walletMatch[1]!.toLowerCase();
    if (!workspaceFixtures.some((w) => w.id === wsId))
      return problem(404, "common.not_found");
    const entries = (s.wallets[wsId] ??= []);
    const balance = () => entries.at(-1)?.balanceAfter.amount ?? 0;
    const wallet = (): WalletInfo => ({
      balance: { amount: balance(), currency: "IRR" },
      entries: [...entries].reverse(),
    });
    if (request.method === "GET" && !walletMatch[2]) {
      if (!has(READERS)) return problem(403, "auth.forbidden");
      return Response.json(wallet());
    }
    if (request.method === "POST" && walletMatch[2]) {
      if (!has(REFUNDERS)) return problem(403, "auth.forbidden");
      if (!stepUpFresh) return problem(403, "auth.step_up.required");
      const b = (await request.json().catch(() => ({}))) as {
        amount?: number;
        reason?: string;
      };
      const n = b.reason?.trim().length ?? 0;
      if (n < 5 || n > 300)
        return problem(400, "validation.failed", {
          reason: [
            n === 0
              ? "validation.required"
              : n < 5
                ? "validation.too_short"
                : "validation.too_long",
          ],
        });
      const amount = Number(b.amount);
      if (
        !Number.isInteger(amount) ||
        amount === 0 ||
        Math.abs(amount) > 1_000_000_000
      )
        return problem(400, "validation.failed", {
          amount: ["validation.out_of_range"],
        });
      if (balance() + amount < 0)
        return problem(409, "billing.wallet.insufficient");
      entries.push(
        walletEntry(
          entries.length + 1,
          wsId,
          amount,
          balance() + amount,
          "adjustment",
          b.reason!.trim(),
          null,
          new Date(now).toISOString(),
        ),
      );
      return Response.json(wallet());
    }
  }

  const match = /^\/admin\/v1\/billing\/payments\/([^/]+)(\/refunds)?$/.exec(
    path,
  );
  if (!match) return null;
  const found = s.payments.find((x) => x.id === match[1]);

  if (request.method === "GET" && !match[2]) {
    if (!has(READERS)) return problem(403, "auth.forbidden");
    return found
      ? Response.json(detail(found))
      : problem(404, "common.not_found");
  }

  if (request.method === "POST" && match[2]) {
    if (!has(REFUNDERS)) return problem(403, "auth.forbidden");
    if (!stepUpFresh) return problem(403, "auth.step_up.required");
    const b = (await request.json().catch(() => ({}))) as {
      amount?: number;
      reason?: string;
      referenceId?: string | null;
      endSubscription?: boolean;
      toWallet?: boolean;
    };
    const n = b.reason?.trim().length ?? 0;
    if (n < 5 || n > 300)
      return problem(400, "validation.failed", {
        reason: [
          n === 0
            ? "validation.required"
            : n < 5
              ? "validation.too_short"
              : "validation.too_long",
        ],
      });
    if ((b.referenceId?.length ?? 0) > 64)
      return problem(400, "validation.failed", {
        referenceId: ["validation.too_long"],
      });
    if (!found) return problem(404, "common.not_found");
    if (found.status !== "paid") return problem(409, "billing.refund.not_paid");
    const amount = Number(b.amount);
    const returnsWallet =
      !!b.endSubscription && found.walletUsed > 0 && !found.walletReleased;
    if (
      !Number.isInteger(amount) ||
      amount < 0 ||
      (amount === 0 && !returnsWallet) ||
      amount > found.amount - refunded(found.id)
    )
      return problem(400, "validation.failed", {
        amount: ["billing.refund.too_much"],
      });
    const entries = (s.wallets[found.workspaceId] ??= []);
    const credit = (value: number, kind: string, reason: string) =>
      entries.push(
        walletEntry(
          entries.length + 1,
          found.workspaceId,
          value,
          (entries.at(-1)?.balanceAfter.amount ?? 0) + value,
          kind,
          reason,
          found.id,
          new Date(now).toISOString(),
        ),
      );
    if (returnsWallet) {
      credit(found.walletUsed, "released", "refund");
      found.walletReleased = true;
    }
    if (b.toWallet && amount > 0) credit(amount, "refund", b.reason!.trim());
    let ended = false;
    if (b.endSubscription && found.subscriptionId) {
      const sub = subscriptions.find(
        (x) => x.id === found.subscriptionId && x.status !== "ended",
      );
      if (sub) {
        sub.status = "ended";
        sub.endedAt = new Date(now).toISOString();
        sub.endReason = "refunded";
        ended = true;
      }
    }
    s.refunds.push({
      id: crypto.randomUUID(),
      checkoutId: found.id,
      amount,
      reason: b.reason!.trim(),
      referenceId: b.referenceId?.trim() || null,
      endedSubscription: ended,
      createdBy: user.username,
      createdAt: new Date(now).toISOString(),
      toWallet: !!b.toWallet,
      walletReturned: returnsWallet ? found.walletUsed : 0,
    });
    return Response.json(detail(found));
  }

  return null;
}
