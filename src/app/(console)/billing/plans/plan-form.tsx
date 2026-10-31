"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { BILLING_METERS, type PlanRequest } from "@/lib/api/types";
import { formatToman } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { CODE_PATTERN, formPath, parseWhole, toFormValues, toPlanRequest, type PlanFormValues } from "./plan-values";

interface Props {
  initial: PlanRequest & { code?: string };
  /** New plans ask for a code; versions keep theirs. */
  withCode?: boolean;
  readOnly?: boolean;
  submitLabel: string;
  onSubmit?: (request: PlanRequest, code: string) => Promise<unknown>;
  onDirtyChange?: (dirty: boolean) => void;
}

/** The plan editor (admin plan 4.4): prices in Toman, limits per meter (empty is unlimited), pricing-card lines and flags. */
export function PlanForm({ initial, withCode, readOnly, submitLabel, onSubmit, onDirtyChange }: Props) {
  const t = useTranslations("plans.form");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, control, setError, reset, formState } = useForm<PlanFormValues>({ defaultValues: toFormValues(initial) });
  const features = useFieldArray({ control, name: "features" });
  const isDirty = formState.isDirty;

  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  const money = (required: boolean) => ({
    validate: (v: string) => {
      const n = parseWhole(v);
      if (n == null) return required ? te("validation.required") : true;
      return Number.isNaN(n) ? t("wholeNumber") : true;
    },
  });
  const whole = { validate: (v: string) => (Number.isNaN(parseWhole(v)) ? t("wholeNumber") : true) };

  const submit = handleSubmit(async (values) => {
    if (!onSubmit) return;
    setFormError(null);
    try {
      const request = toPlanRequest(values);
      await onSubmit(request, values.code.trim().toLowerCase());
      reset(values);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "billing.plan.code_taken") setError("code", { message: te("billing.plan.code_taken") });
        for (const [key, codes] of Object.entries(error.fieldErrors)) {
          const path = formPath(key);
          if (path) setError(path as FieldPath<PlanFormValues>, { message: fieldError(codes) });
        }
      }
      setFormError(errorMessage(error));
    }
  });

  const err = (path: string) => {
    let node: unknown = formState.errors;
    for (const part of path.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
    return (node as { message?: string } | undefined)?.message;
  };
  const monthly = parseWhole(useWatch({ control, name: "monthly" }));

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <fieldset disabled={readOnly || formState.isSubmitting} className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("basics")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {withCode ? (
              <Field label={t("code")} hint={t("codeHint")} error={err("code")}>
                {({ id, describedBy, invalid }) => (
                  <Input id={id} dir="ltr" autoComplete="off" spellCheck={false} aria-describedby={describedBy} aria-invalid={invalid} {...register("code", { validate: (v) => CODE_PATTERN.test(v.trim().toLowerCase()) || t("codeInvalid") })} />
                )}
              </Field>
            ) : null}
            <Field label={t("name")} error={err("name")}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} maxLength={50} aria-describedby={describedBy} aria-invalid={invalid} {...register("name", { validate: (v) => v.trim().length > 0 || te("validation.required") })} />
              )}
            </Field>
            <Field label={t("tagline")} error={err("tagline")}>
              {({ id, describedBy, invalid }) => <Input id={id} maxLength={120} aria-describedby={describedBy} aria-invalid={invalid} {...register("tagline")} />}
            </Field>
            <Field label={t("sortOrder")} hint={t("sortOrderHint")} error={err("sortOrder")}>
              {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid} {...register("sortOrder", whole)} />}
            </Field>
            <Field label={t("description")} error={err("description")} className="md:col-span-2">
              {({ id, describedBy, invalid }) => <Textarea id={id} maxLength={1000} aria-describedby={describedBy} aria-invalid={invalid} {...register("description")} />}
            </Field>
            <div className="flex flex-wrap gap-6 md:col-span-2">
              {(["isPublic", "isFree", "highlighted"] as const).map((flag) => (
                <label key={flag} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-primary" {...register(flag)} />
                  {t(flag)}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("prices")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Field label={t("monthly")} hint={monthly && !Number.isNaN(monthly) ? formatToman(monthly * 10) : t("tomanHint")} error={err("monthly")}>
              {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid} {...register("monthly", money(true))} />}
            </Field>
            <Field label={t("annual")} hint={t("optionalToman")} error={err("annual")}>
              {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid} {...register("annual", money(false))} />}
            </Field>
            <Field label={t("overage")} hint={t("optionalToman")} error={err("overage")}>
              {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid} {...register("overage", money(false))} />}
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("limits")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <p className="text-xs text-muted-foreground md:col-span-3">{t("limitsHint")}</p>
            {BILLING_METERS.map((meter) => (
              <Field key={meter} label={t(`meters.${meter}`)} error={err(`limits.${meter}`)}>
                {({ id, describedBy, invalid }) => (
                  <Input id={id} dir="ltr" inputMode="numeric" placeholder={t("unlimited")} aria-describedby={describedBy} aria-invalid={invalid} {...register(`limits.${meter}`, whole)} />
                )}
              </Field>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("features")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">{t("featuresHint")}</p>
            {err("features") ? <p className="text-xs text-danger">{err("features")}</p> : null}
            {features.fields.map((field, i) => (
              <fieldset key={field.id} className="grid items-end gap-3 rounded-md border border-border p-3 md:grid-cols-[1fr_2fr_1fr_auto_auto]">
                <legend className="sr-only">{t("featureN", { n: i + 1 })}</legend>
                <Field label={t("featureKey")} error={err(`features.${i}.key`)}>
                  {({ id, describedBy, invalid }) => (
                    <Input id={id} dir="ltr" maxLength={40} aria-describedby={describedBy} aria-invalid={invalid} {...register(`features.${i}.key`, { validate: (v) => v.trim().length > 0 || te("validation.required") })} />
                  )}
                </Field>
                <Field label={t("featureLabel")} error={err(`features.${i}.label`)}>
                  {({ id, describedBy, invalid }) => (
                    <Input id={id} maxLength={80} aria-describedby={describedBy} aria-invalid={invalid} {...register(`features.${i}.label`, { validate: (v) => v.trim().length > 0 || te("validation.required") })} />
                  )}
                </Field>
                <Field label={t("featureLimit")}>{({ id }) => <Input id={id} maxLength={40} {...register(`features.${i}.limit`)} />}</Field>
                <label className="flex h-10 items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-primary" {...register(`features.${i}.included`)} />
                  {t("featureIncluded")}
                </label>
                {readOnly ? (
                  <span />
                ) : (
                  <Button variant="ghost" size="icon" aria-label={t("removeFeature", { n: i + 1 })} onClick={() => features.remove(i)}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              </fieldset>
            ))}
            {readOnly ? null : (
              <Button variant="secondary" size="sm" className="self-start" disabled={features.fields.length >= 20} onClick={() => features.append({ key: "", label: "", included: true, limit: "" })}>
                <Plus className="size-4" aria-hidden />
                {t("addFeature")}
              </Button>
            )}
          </CardContent>
        </Card>
      </fieldset>
      {readOnly || !onSubmit ? null : (
        <Button type="submit" className="self-start" disabled={formState.isSubmitting || (!withCode && !isDirty)}>
          {submitLabel}
        </Button>
      )}
    </form>
  );
}
