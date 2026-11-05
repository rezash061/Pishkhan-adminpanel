"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { admin } from "@/lib/api/client";
import type { AdminCoupon, CouponRequest } from "@/lib/api/types";
import { formatJalaliDate } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { parseWhole } from "../plans/plan-values";

/** Form state: numbers as text (empty means none), dates as yyyy-mm-dd (Gregorian, start of day Tehran time). */
export interface CouponFormValues {
  code: string;
  kind: "percent" | "fixed";
  value: string;
  description: string;
  planCodes: string;
  firstPurchaseOnly: boolean;
  maxRedemptions: string;
  maxPerWorkspace: string;
  validFrom: string;
  validUntil: string;
  active: boolean;
}

export const EMPTY_COUPON: CouponFormValues = {
  code: "",
  kind: "percent",
  value: "",
  description: "",
  planCodes: "",
  firstPurchaseOnly: false,
  maxRedemptions: "",
  maxPerWorkspace: "1",
  validFrom: "",
  validUntil: "",
  active: true,
};

/** yyyy-mm-dd as midnight in Tehran (UTC+03:30), or null. */
export function dateToIso(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00+03:30`).toISOString()
    : null;
}

/** An ISO time as the Tehran yyyy-mm-dd it falls on. */
export function isoToDate(value: string | null): string {
  if (!value) return "";
  return new Date(Date.parse(value) + 3.5 * 3_600_000)
    .toISOString()
    .slice(0, 10);
}

export function toFormValues(c: AdminCoupon): CouponFormValues {
  return {
    code: c.code,
    kind: c.kind === "fixed" ? "fixed" : "percent",
    value: String(c.kind === "fixed" ? Math.round(c.value / 10) : c.value),
    description: c.description ?? "",
    planCodes: c.planCodes.join(", "),
    firstPurchaseOnly: c.firstPurchaseOnly,
    maxRedemptions: c.maxRedemptions === null ? "" : String(c.maxRedemptions),
    maxPerWorkspace: String(c.maxPerWorkspace),
    validFrom: isoToDate(c.validFrom),
    validUntil: isoToDate(c.validUntil),
    active: c.active,
  };
}

/** The request body; a fixed value is entered in Toman and sent in Rial. Unparseable numbers become NaN so the server rejects them. */
export function toCouponRequest(
  v: CouponFormValues,
  creating: boolean,
): CouponRequest {
  const whole = (text: string) => parseWhole(text);
  const value = whole(v.value);
  return {
    ...(creating
      ? {
          code: v.code.trim().toUpperCase(),
          kind: v.kind,
          value:
            value === null
              ? Number.NaN
              : v.kind === "fixed"
                ? value * 10
                : value,
        }
      : {}),
    description: v.description.trim() || null,
    planCodes: v.planCodes
      .split(/[,،\s]+/)
      .map((p) => p.trim())
      .filter(Boolean),
    firstPurchaseOnly: v.firstPurchaseOnly,
    maxRedemptions: whole(v.maxRedemptions),
    maxPerWorkspace: whole(v.maxPerWorkspace) ?? 1,
    validFrom: dateToIso(v.validFrom),
    validUntil: dateToIso(v.validUntil),
    active: v.active,
  };
}

export function NewCoupon() {
  const t = useTranslations("billing.coupons");
  const router = useRouter();
  const queryClient = useQueryClient();
  return (
    <>
      <PageHeader
        title={t("createTitle")}
        actions={
          <Link
            href="/billing/coupons"
            className="text-sm text-primary hover:underline"
          >
            {t("back")}
          </Link>
        }
      />
      <CouponForm
        initial={EMPTY_COUPON}
        creating
        submitLabel={t("form.create")}
        onSubmit={(body) =>
          admin<AdminCoupon>("/billing/coupons", { method: "POST", body })
        }
        onDone={(c) => {
          void queryClient.invalidateQueries({ queryKey: ["billing-coupons"] });
          router.push(`/billing/coupons/${c.id}`);
        }}
      />
    </>
  );
}

export function CouponForm({
  initial,
  creating,
  submitLabel,
  onSubmit,
  onDone,
}: {
  initial: CouponFormValues;
  creating: boolean;
  submitLabel: string;
  onSubmit: (body: CouponRequest) => Promise<AdminCoupon>;
  onDone: (c: AdminCoupon) => void;
}) {
  const t = useTranslations("billing.coupons.form");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  const mutation = useMutation({
    mutationFn: () => onSubmit(toCouponRequest(v, creating)),
    onSuccess: (c) => {
      setSaved(true);
      onDone(c);
    },
    onMutate: () => setSaved(false),
  });
  const errors =
    mutation.error instanceof ApiError ? mutation.error.fieldErrors : {};
  const err = (key: string) => fieldError(errors[key]);
  const set = <K extends keyof CouponFormValues>(
    key: K,
    value: CouponFormValues[K],
  ) => setV((old) => ({ ...old, [key]: value }));
  const text = (
    key:
      | "code"
      | "value"
      | "description"
      | "planCodes"
      | "maxRedemptions"
      | "maxPerWorkspace",
    label: string,
    opts: { hint?: string; ltr?: boolean; numeric?: boolean } = {},
  ) => (
    <Field label={label} hint={opts.hint} error={err(key)}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          value={v[key]}
          onChange={(e) => set(key, e.target.value)}
          dir={opts.ltr ? "ltr" : undefined}
          inputMode={opts.numeric ? "numeric" : undefined}
          aria-describedby={describedBy}
          aria-invalid={invalid}
        />
      )}
    </Field>
  );
  const date = (key: "validFrom" | "validUntil", label: string) => (
    <Field
      label={label}
      hint={v[key] ? formatJalaliDate(dateToIso(v[key])!) : t("dateHint")}
      error={err(key)}
    >
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          type="date"
          dir="ltr"
          value={v[key]}
          onChange={(e) => set(key, e.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid}
        />
      )}
    </Field>
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          noValidate
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {mutation.error ? (
            <Alert tone="danger" className="md:col-span-2">
              {errorMessage(mutation.error)}
            </Alert>
          ) : null}
          {saved && !creating ? (
            <Alert tone="success" className="md:col-span-2">
              {t("saved")}
            </Alert>
          ) : null}
          {creating ? (
            <>
              {text("code", t("code"), { hint: t("codeHint"), ltr: true })}
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {t("kind")}
                <select
                  value={v.kind}
                  onChange={(e) =>
                    set(
                      "kind",
                      e.target.value === "fixed" ? "fixed" : "percent",
                    )
                  }
                  className="h-10 rounded-md border border-border bg-surface px-2 text-sm font-normal"
                >
                  <option value="percent">{t("kinds.percent")}</option>
                  <option value="fixed">{t("kinds.fixed")}</option>
                </select>
              </label>
              {text(
                "value",
                v.kind === "percent" ? t("valuePercent") : t("valueToman"),
                { ltr: true, numeric: true },
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground md:col-span-2">
              {t("fixedOnly")}
            </p>
          )}
          {text("description", t("description"))}
          {text("planCodes", t("planCodes"), {
            hint: t("planCodesHint"),
            ltr: true,
          })}
          {text("maxRedemptions", t("maxRedemptions"), {
            hint: t("maxRedemptionsHint"),
            ltr: true,
            numeric: true,
          })}
          {text("maxPerWorkspace", t("maxPerWorkspace"), {
            ltr: true,
            numeric: true,
          })}
          {date("validFrom", t("validFrom"))}
          {date("validUntil", t("validUntil"))}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={v.firstPurchaseOnly}
              onChange={(e) => set("firstPurchaseOnly", e.target.checked)}
            />
            {t("firstPurchaseOnly")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={v.active}
              onChange={(e) => set("active", e.target.checked)}
            />
            {t("active")}
          </label>
          <div className="flex justify-end md:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
