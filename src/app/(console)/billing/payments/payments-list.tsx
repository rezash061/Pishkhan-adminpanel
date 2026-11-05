"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Pager } from "@/components/ui/pager";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import { CHECKOUT_KINDS, PAYMENT_STATUSES, type AdminPayment, type BillingSummary, type PagedResult } from "@/lib/api/types";
import { formatJalaliDateTime, formatNumber, formatRelative, formatToman, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

const PAGE_SIZE = 25;
export const SUMMARY_DAYS = 30;
export const PAYMENT_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { paid: "success", pending: "warning", failed: "danger", expired: "neutral" };

/** none, partly or fully refunded. */
export function refundState(p: Pick<AdminPayment, "amount" | "refunded">): "none" | "partly" | "fully" {
  if (p.refunded <= 0) return "none";
  return p.refunded >= p.amount ? "fully" : "partly";
}

/** Payments and invoices across workspaces (admin plan 4.4), with the last 30 days' totals. Filters live in the URL. */
export function PaymentsList() {
  const t = useTranslations("billing");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const status = PAYMENT_STATUSES.find((s) => s === params.get("status")) ?? "paid";
  const kind = CHECKOUT_KINDS.find((k) => k === params.get("kind")) ?? "";
  const workspaceId = params.get("workspaceId") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [workspaceInput, setWorkspaceInput] = useState(workspaceId);

  const query = new URLSearchParams({ status, page: String(page), pageSize: String(PAGE_SIZE) });
  if (kind) query.set("kind", kind);
  if (workspaceId) query.set("workspaceId", workspaceId);

  const list = useQuery({
    queryKey: ["billing-payments", query.toString()],
    queryFn: () => admin<PagedResult<AdminPayment>>(`/billing/payments?${query}`),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({ queryKey: ["billing-summary", SUMMARY_DAYS], queryFn: () => admin<BillingSummary>(`/billing/summary?days=${SUMMARY_DAYS}`) });

  const navigate = (next: { status?: string; kind?: string; workspaceId?: string; page?: number }) => {
    const m = { status, kind, workspaceId, page: 1, ...next };
    const q = new URLSearchParams();
    if (m.status !== "paid") q.set("status", m.status);
    if (m.kind) q.set("kind", m.kind);
    if (m.workspaceId) q.set("workspaceId", m.workspaceId);
    if (m.page > 1) q.set("page", String(m.page));
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  if (list.error instanceof ApiError && list.error.status === 404) return <Alert tone="warning">{t("notAvailable")}</Alert>;

  const s = summary.data;
  return (
    <div className="flex flex-col gap-4">
      {s ? (
        <section aria-labelledby="billing-summary-title" data-testid="billing-summary">
          <h2 id="billing-summary-title" className="mb-2 text-sm font-semibold text-muted-foreground">
            {t("payments.summary.title", { days: s.days })}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              [t("payments.summary.paid", { count: formatNumber(s.paidCount) }), formatToman(s.paidAmount)],
              [t("payments.summary.refunded", { count: formatNumber(s.refundCount) }), formatToman(s.refundedAmount)],
              [t("payments.summary.net"), formatToman(s.netAmount)],
              [t("payments.summary.failed"), formatNumber(s.failedCount)],
              [t("payments.summary.pending"), formatNumber(s.pendingCount)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-border bg-surface p-3">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ workspaceId: workspaceInput.trim() });
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("payments.filters.status")}
          <select value={status} onChange={(e) => navigate({ status: e.target.value })} className="h-10 min-w-36 rounded-md border border-border bg-surface px-2 text-sm font-normal">
            {PAYMENT_STATUSES.map((x) => (
              <option key={x} value={x}>
                {t(`payments.statuses.${x}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("payments.filters.kind")}
          <select value={kind} onChange={(e) => navigate({ kind: e.target.value })} className="h-10 min-w-36 rounded-md border border-border bg-surface px-2 text-sm font-normal">
            <option value="">{t("all")}</option>
            {CHECKOUT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("payments.filters.workspaceId")}
          <Input value={workspaceInput} onChange={(e) => setWorkspaceInput(e.target.value)} dir="ltr" className="w-80 font-mono text-xs" />
        </label>
        <Button type="submit" variant="secondary">
          {t("apply")}
        </Button>
      </form>

      {list.error ? <Alert tone="danger">{errorMessage(list.error)}</Alert> : null}
      {list.isPending && !list.error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}

      {list.data ? (
        <Card className={list.isFetching ? "opacity-70" : undefined}>
          <Table>
            <thead>
              <tr>
                <Th>{t("payments.columns.time")}</Th>
                <Th>{t("payments.columns.invoice")}</Th>
                <Th>{t("payments.columns.workspace")}</Th>
                <Th>{t("payments.columns.plan")}</Th>
                <Th>{t("payments.columns.kind")}</Th>
                <Th>{t("payments.columns.amount")}</Th>
                <Th>{t("payments.columns.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="py-8 text-center text-muted-foreground">
                    {t("payments.empty")}
                  </Td>
                </tr>
              ) : null}
              {list.data.items.map((p) => {
                const refund = refundState(p);
                return (
                  <tr key={p.id} data-testid={`payment-${p.id}`}>
                    <Td className="whitespace-nowrap" title={formatJalaliDateTime(p.paidAt ?? p.createdAt)}>
                      <Link href={`/billing/payments/${p.id}`} className="text-primary hover:underline">
                        {formatRelative(p.paidAt ?? p.createdAt)}
                      </Link>
                    </Td>
                    <Td>{p.invoiceNumber ? toPersianDigits(p.invoiceNumber) : "—"}</Td>
                    <Td>
                      <Link href={`/workspaces/${p.workspaceId}`} className="hover:underline">
                        {p.workspaceName ?? p.workspaceId.slice(-8)}
                      </Link>
                    </Td>
                    <Td>
                      {p.planName}
                      {p.cycle && t.has(`cycles.${p.cycle}`) ? <span className="text-xs text-muted-foreground"> · {t(`cycles.${p.cycle}`)}</span> : null}
                    </Td>
                    <Td>{t.has(`kinds.${p.kind}`) ? t(`kinds.${p.kind}`) : p.kind}</Td>
                    <Td className="whitespace-nowrap">
                      {formatToman(p.amount)}
                      {refund !== "none" ? <div className="text-xs text-warning-foreground">− {formatToman(p.refunded)}</div> : null}
                    </Td>
                    <Td>
                      <Badge tone={PAYMENT_TONE[p.status] ?? "neutral"}>{t.has(`payments.statuses.${p.status}`) ? t(`payments.statuses.${p.status}`) : p.status}</Badge>
                      {refund !== "none" ? <div className="mt-1 text-xs text-muted-foreground">{t(refund === "fully" ? "payments.fullyRefunded" : "payments.partlyRefunded")}</div> : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pager page={page} pageSize={PAGE_SIZE} totalCount={list.data.totalCount} onPage={(p) => navigate({ page: p })} />
        </Card>
      ) : null}
    </div>
  );
}
