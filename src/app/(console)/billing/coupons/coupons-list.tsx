"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Pager } from "@/components/ui/pager";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import {
  COUPON_STATES,
  type AdminCoupon,
  type PagedResult,
} from "@/lib/api/types";
import { formatJalaliDate, formatNumber, formatToman } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

const PAGE_SIZE = 25;
export const COUPON_TONE: Record<
  string,
  "success" | "warning" | "neutral" | "info"
> = {
  active: "success",
  scheduled: "info",
  expired: "neutral",
  used_up: "warning",
  disabled: "neutral",
};

/** "۲۰٪" or "۱۰۰٬۰۰۰ تومان". */
export function useCouponValue() {
  const t = useTranslations("billing.coupons");
  return (c: Pick<AdminCoupon, "kind" | "value">) =>
    c.kind === "percent"
      ? t("percentOff", { value: formatNumber(c.value) })
      : formatToman(c.value);
}

/** Coupons (admin plan 4.4): search and state in the URL; Finance makes new ones. */
export function CouponsList() {
  const t = useTranslations("billing.coupons");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const value = useCouponValue();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const state = COUPON_STATES.find((s) => s === params.get("state")) ?? "";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [search, setSearch] = useState(q);

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (state) query.set("state", state);
  if (q) query.set("q", q);
  const list = useQuery({
    queryKey: ["billing-coupons", query.toString()],
    queryFn: () => admin<PagedResult<AdminCoupon>>(`/billing/coupons?${query}`),
    placeholderData: keepPreviousData,
  });

  const navigate = (next: { state?: string; q?: string; page?: number }) => {
    const m = { state, q, page: 1, ...next };
    const out = new URLSearchParams();
    if (m.state) out.set("state", m.state);
    if (m.q) out.set("q", m.q);
    if (m.page > 1) out.set("page", String(m.page));
    router.replace(out.size ? `${pathname}?${out}` : pathname, {
      scroll: false,
    });
  };

  if (list.error instanceof ApiError && list.error.status === 404)
    return <Alert tone="warning">{t("notAvailable")}</Alert>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ q: search.trim() });
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("filters.q")}
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("filters.state")}
            <select
              value={state}
              onChange={(e) => navigate({ state: e.target.value })}
              className="h-10 min-w-36 rounded-md border border-border bg-surface px-2 text-sm font-normal"
            >
              <option value="">{t("allStates")}</option>
              {COUPON_STATES.map((s) => (
                <option key={s} value={s}>
                  {t(`states.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="secondary">
            {tc("apply")}
          </Button>
        </form>
        {staff.can("coupons.manage") ? (
          <Link
            href="/billing/coupons/new"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("create")}
          </Link>
        ) : null}
      </div>

      {list.error ? (
        <Alert tone="danger">{errorMessage(list.error)}</Alert>
      ) : null}
      {list.isPending && !list.error ? (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      ) : null}

      {list.data ? (
        <Card className={list.isFetching ? "opacity-70" : undefined}>
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.code")}</Th>
                <Th>{t("columns.discount")}</Th>
                <Th>{t("columns.limits")}</Th>
                <Th>{t("columns.validity")}</Th>
                <Th>{t("columns.used")}</Th>
                <Th>{t("columns.state")}</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.length === 0 ? (
                <tr>
                  <Td
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {t("empty")}
                  </Td>
                </tr>
              ) : null}
              {list.data.items.map((c) => (
                <tr key={c.id} data-testid={`coupon-${c.code}`}>
                  <Td>
                    <Link
                      href={`/billing/coupons/${c.id}`}
                      className="font-mono text-primary hover:underline"
                      dir="ltr"
                    >
                      {c.code}
                    </Link>
                    {c.description ? (
                      <div className="text-xs text-muted-foreground">
                        {c.description}
                      </div>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap">{value(c)}</Td>
                  <Td className="text-xs">
                    <div>
                      {c.planCodes.length ? (
                        <span dir="ltr">{c.planCodes.join(", ")}</span>
                      ) : (
                        t("allPlans")
                      )}
                    </div>
                    {c.firstPurchaseOnly ? (
                      <div className="text-muted-foreground">
                        {t("firstPurchase")}
                      </div>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {c.validFrom ? (
                      <div>
                        {t("from", { date: formatJalaliDate(c.validFrom) })}
                      </div>
                    ) : null}
                    {c.validUntil ? (
                      <div>
                        {t("until", { date: formatJalaliDate(c.validUntil) })}
                      </div>
                    ) : null}
                    {!c.validFrom && !c.validUntil ? t("always") : null}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {c.maxRedemptions === null
                      ? formatNumber(c.redemptions)
                      : t("usedOf", {
                          used: formatNumber(c.redemptions),
                          max: formatNumber(c.maxRedemptions),
                        })}
                  </Td>
                  <Td>
                    <Badge tone={COUPON_TONE[c.state] ?? "neutral"}>
                      {t.has(`states.${c.state}`)
                        ? t(`states.${c.state}`)
                        : c.state}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={list.data.totalCount}
            onPage={(p) => navigate({ page: p })}
          />
        </Card>
      ) : null}
    </div>
  );
}
