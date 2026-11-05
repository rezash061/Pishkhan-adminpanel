"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { ReasonDialog } from "@/components/console/reason-dialog";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { AdminPaymentDetail, RefundRequest } from "@/lib/api/types";
import { formatJalaliDate, formatJalaliDateTime, formatNumber, formatToman, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { parseWhole } from "../../plans/plan-values";
import { SUBSCRIPTION_TONE } from "../../subscriptions/subscriptions-list";
import { PAYMENT_TONE } from "../payments-list";

/** What is left to refund, in whole Toman (the form's unit). */
export function refundableToman(p: { amount: number; refunded: number }): number {
  return Math.max(0, Math.floor((p.amount - p.refunded) / 10));
}

/** One payment and its invoice, its refunds, and (Finance) recording a refund made in Zarinpal's panel. */
export function PaymentDetailView({ id }: { id: string }) {
  const t = useTranslations("billing");
  const tw = useTranslations("workspaces.billing");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const queryClient = useQueryClient();
  const [refunding, setRefunding] = useState(false);
  const [done, setDone] = useState(false);
  const key = ["billing-payment", id];
  const { data, error, isPending } = useQuery({ queryKey: key, queryFn: () => admin<AdminPaymentDetail>(`/billing/payments/${encodeURIComponent(id)}`) });

  const back = (
    <Link href="/billing/payments" className="text-sm text-primary hover:underline">
      {t("payment.back")}
    </Link>
  );
  if (isPending && !error) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (error || !data) {
    return (
      <>
        <PageHeader title={t("payment.title")} actions={back} />
        <Alert tone={error instanceof ApiError && error.status === 404 ? "warning" : "danger"}>{errorMessage(error)}</Alert>
      </>
    );
  }

  const p = data.payment;
  const left = refundableToman(p);
  const row = (label: string, value: ReactNode, ltr = false) => (
    <div className="grid grid-cols-[11rem_1fr] gap-2 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={ltr ? "break-all font-mono text-xs" : undefined} dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
  const sub = data.subscription;

  return (
    <>
      <PageHeader
        title={p.invoiceNumber ? t("payment.invoiceN", { n: toPersianDigits(p.invoiceNumber) }) : t("payment.title")}
        description={formatJalaliDateTime(p.paidAt ?? p.createdAt)}
        actions={
          <div className="flex items-center gap-3">
            {p.status === "paid" && left > 0 && staff.can("billing.refund") ? <Button onClick={() => setRefunding(true)}>{t("payment.refund.button")}</Button> : null}
            {back}
          </div>
        }
      />
      {done ? (
        <Alert tone="success" className="mb-4">
          {t("payment.refund.done")}
        </Alert>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("payment.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl data-testid="payment-fields">
              {row(t("payment.fields.status"), <Badge tone={PAYMENT_TONE[p.status] ?? "neutral"}>{t.has(`payments.statuses.${p.status}`) ? t(`payments.statuses.${p.status}`) : p.status}</Badge>)}
              {row(
                t("payment.fields.workspace"),
                <Link href={`/workspaces/${p.workspaceId}`} className="text-primary hover:underline">
                  {p.workspaceName ?? p.workspaceId}
                </Link>,
              )}
              {row(t("payment.fields.plan"), `${p.planName} (${p.planCode} v${toPersianDigits(p.planVersion)})`)}
              {row(t("payment.fields.kind"), t.has(`kinds.${p.kind}`) ? t(`kinds.${p.kind}`) : p.kind)}
              {p.cycle ? row(t("payment.fields.cycle"), t.has(`cycles.${p.cycle}`) ? t(`cycles.${p.cycle}`) : p.cycle) : null}
              {row(t("payment.fields.price"), formatToman(p.price))}
              {p.credit ? row(t("payment.fields.credit"), `− ${formatToman(p.credit)}`) : null}
              {row(t("payment.fields.amount"), <strong>{formatToman(p.amount)}</strong>)}
              {p.refunded ? row(t("payment.fields.refunded"), <span className="text-warning-foreground">{formatToman(p.refunded)}</span>) : null}
              {p.status === "paid" ? row(t("payment.fields.left"), formatToman(p.amount - p.refunded)) : null}
              {p.referenceId ? row(t("payment.fields.referenceId"), p.referenceId, true) : null}
              {p.cardMask ? row(t("payment.fields.cardMask"), p.cardMask, true) : null}
              {p.error ? row(t("payment.fields.error"), p.error, true) : null}
              {row(t("payment.fields.createdAt"), formatJalaliDateTime(p.createdAt))}
              {p.paidAt ? row(t("payment.fields.paidAt"), formatJalaliDateTime(p.paidAt)) : null}
              {sub
                ? row(
                    t("payment.fields.subscription"),
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={SUBSCRIPTION_TONE[sub.state] ?? "neutral"}>{t.has(`subscriptions.states.${sub.state}`) ? t(`subscriptions.states.${sub.state}`) : sub.state}</Badge>
                      <span>
                        {formatJalaliDate(sub.startsAt)} – {sub.endsAt ? formatJalaliDate(sub.endsAt) : t("subscriptions.noEnd")}
                      </span>
                      {sub.endReason ? <span className="text-xs text-muted-foreground">{tw.has(`endReasons.${sub.endReason}`) ? tw(`endReasons.${sub.endReason}`) : sub.endReason}</span> : null}
                    </span>,
                  )
                : null}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("payment.refunds")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.refunds.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("payment.noRefunds")}</p>
            ) : (
              <Table data-testid="refunds">
                <thead>
                  <tr>
                    <Th>{t("payment.refundColumns.time")}</Th>
                    <Th>{t("payment.refundColumns.amount")}</Th>
                    <Th>{t("payment.refundColumns.reference")}</Th>
                    <Th>{t("payment.refundColumns.by")}</Th>
                    <Th>{t("payment.refundColumns.reason")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.refunds.map((r) => (
                    <tr key={r.id}>
                      <Td className="whitespace-nowrap">{formatJalaliDateTime(r.createdAt)}</Td>
                      <Td className="whitespace-nowrap">
                        {formatToman(r.amount)}
                        {r.endedSubscription ? <div className="text-xs text-muted-foreground">{t("payment.refundColumns.ended")}</div> : null}
                      </Td>
                      <Td className="font-mono text-xs" dir="ltr">
                        {r.referenceId ?? "—"}
                      </Td>
                      <Td dir="ltr">{r.createdBy ?? "—"}</Td>
                      <Td>{r.reason}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      {refunding ? (
        <RefundDialog
          id={p.id}
          maxToman={left}
          canEnd={!!sub && sub.state !== "ended"}
          onClose={() => setRefunding(false)}
          onDone={(next) => {
            setRefunding(false);
            setDone(true);
            queryClient.setQueryData(key, next);
            void queryClient.invalidateQueries({ queryKey: ["billing-payments"] });
            void queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
            void queryClient.invalidateQueries({ queryKey: ["billing-subscriptions"] });
          }}
        />
      ) : null}
    </>
  );
}

function RefundDialog({ id, maxToman, canEnd, onClose, onDone }: { id: string; maxToman: number; canEnd: boolean; onClose: () => void; onDone: (d: AdminPaymentDetail) => void }) {
  const t = useTranslations("billing.payment.refund");
  const fieldError = useFieldError();
  const [amount, setAmount] = useState(String(maxToman));
  const [referenceId, setReferenceId] = useState("");
  const [endSubscription, setEndSubscription] = useState(false);
  const [amountError, setAmountError] = useState<string | undefined>();
  const [referenceError, setReferenceError] = useState<string | undefined>();
  const max = formatNumber(maxToman);

  return (
    <ReasonDialog<AdminPaymentDetail>
      open
      stepUp
      tone="primary"
      title={t("title")}
      description={t("description")}
      confirmLabel={t("submit")}
      onClose={onClose}
      onDone={onDone}
      onSubmit={async (reason) => {
        setAmountError(undefined);
        setReferenceError(undefined);
        const toman = parseWhole(amount);
        if (toman === null || !Number.isInteger(toman) || toman <= 0 || toman > maxToman) {
          const message = t("invalidAmount", { max });
          setAmountError(message);
          throw new ApiError(400, { code: "validation.failed", errors: { amount: ["billing.refund.too_much"] } });
        }
        const body: RefundRequest = { amount: toman * 10, reason, referenceId: referenceId.trim() || null, endSubscription: canEnd && endSubscription };
        try {
          return await admin<AdminPaymentDetail>(`/billing/payments/${encodeURIComponent(id)}/refunds`, { method: "POST", body });
        } catch (error) {
          if (error instanceof ApiError) {
            if (error.fieldErrors.amount) setAmountError(fieldError(error.fieldErrors.amount));
            if (error.fieldErrors.referenceId) setReferenceError(fieldError(error.fieldErrors.referenceId));
          }
          throw error;
        }
      }}
    >
      <Field label={t("amount")} hint={t("amountHint", { max })} error={amountError}>
        {({ id: fieldId, describedBy, invalid }) => (
          <Input id={fieldId} inputMode="numeric" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </Field>
      <Field label={t("referenceId")} error={referenceError}>
        {({ id: fieldId, describedBy, invalid }) => (
          <Input id={fieldId} dir="ltr" maxLength={64} value={referenceId} onChange={(e) => setReferenceId(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </Field>
      {canEnd ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={endSubscription} onChange={(e) => setEndSubscription(e.target.checked)} />
          {t("endSubscription")}
        </label>
      ) : null}
    </ReasonDialog>
  );
}
