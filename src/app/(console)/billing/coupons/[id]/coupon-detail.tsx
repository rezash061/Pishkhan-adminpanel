"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { AdminCoupon, AdminCouponDetail } from "@/lib/api/types";
import {
  formatJalaliDateTime,
  formatToman,
  toPersianDigits,
} from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { CouponForm, toFormValues } from "../coupon-form";
import { COUPON_TONE, useCouponValue } from "../coupons-list";

/** One coupon: its terms (Finance edits them) and who used it. */
export function CouponDetailView({ id }: { id: string }) {
  const t = useTranslations("billing.coupons");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const value = useCouponValue();
  const queryClient = useQueryClient();
  const key = ["billing-coupon", id];
  const { data, error, isPending } = useQuery({
    queryKey: key,
    queryFn: () =>
      admin<AdminCouponDetail>(`/billing/coupons/${encodeURIComponent(id)}`),
  });

  const back = (
    <Link
      href="/billing/coupons"
      className="text-sm text-primary hover:underline"
    >
      {t("back")}
    </Link>
  );
  if (isPending && !error)
    return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (error || !data) {
    return (
      <>
        <PageHeader title={t("title")} actions={back} />
        <Alert
          tone={
            error instanceof ApiError && error.status === 404
              ? "warning"
              : "danger"
          }
        >
          {errorMessage(error)}
        </Alert>
      </>
    );
  }

  const c = data.coupon;
  return (
    <>
      <PageHeader title={c.code} description={c.description ?? undefined} actions={back} />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm" data-testid="coupon-summary">
        <Badge tone={COUPON_TONE[c.state] ?? "neutral"}>{t.has(`states.${c.state}`) ? t(`states.${c.state}`) : c.state}</Badge>
        <span>{value(c)}</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {staff.can("coupons.manage") ? (
          <CouponForm
            key={c.id}
            initial={toFormValues(c)}
            creating={false}
            submitLabel={t("form.save")}
            onSubmit={(body) =>
              admin<AdminCoupon>(`/billing/coupons/${encodeURIComponent(id)}`, {
                method: "PUT",
                body,
              })
            }
            onDone={(next) => {
              queryClient.setQueryData<AdminCouponDetail>(key, (old) =>
                old ? { ...old, coupon: next } : old,
              );
              void queryClient.invalidateQueries({
                queryKey: ["billing-coupons"],
              });
            }}
          />
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.redemptions")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("detail.total", { amount: formatToman(c.discountTotal) })}
            </p>
          </CardHeader>
          {data.redemptions.length === 0 ? (
            <CardContent className="text-sm text-muted-foreground">
              {t("detail.noRedemptions")}
            </CardContent>
          ) : (
            <Table data-testid="coupon-redemptions">
              <thead>
                <tr>
                  <Th>{t("detail.columns.time")}</Th>
                  <Th>{t("detail.columns.workspace")}</Th>
                  <Th>{t("detail.columns.invoice")}</Th>
                  <Th>{t("detail.columns.discount")}</Th>
                </tr>
              </thead>
              <tbody>
                {data.redemptions.map((r) => (
                  <tr key={r.checkoutId}>
                    <Td className="whitespace-nowrap">
                      {formatJalaliDateTime(r.createdAt)}
                    </Td>
                    <Td>
                      <Link
                        href={`/workspaces/${r.workspaceId}`}
                        className="text-primary hover:underline"
                      >
                        {r.workspaceName ?? r.workspaceId.slice(-8)}
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={`/billing/payments/${r.checkoutId}`}
                        className="text-primary hover:underline"
                      >
                        {r.invoiceNumber
                          ? toPersianDigits(r.invoiceNumber)
                          : "—"}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatToman(r.discount)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
