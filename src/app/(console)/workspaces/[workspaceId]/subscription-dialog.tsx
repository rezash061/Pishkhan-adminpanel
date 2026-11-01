"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { StepUpCancelled, useStepUp } from "@/components/console/step-up";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { admin } from "@/lib/api/client";
import type { GrantPlanRequest, PagedResult, Plan, SubscriptionInfo } from "@/lib/api/types";
import { formatToman, toLatinDigits, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";

export type SubscriptionAction = "grant" | "extend" | "cancel";

interface Values {
  planId: string;
  trial: boolean;
  days: string;
  reason: string;
}

const PATHS: Record<SubscriptionAction, string> = { grant: "subscription", extend: "subscription/extend", cancel: "subscription/cancel" };

/** Grant a plan or trial, extend, or cancel (backend PR #23): Finance or SuperAdmin, reason and step-up. */
export function SubscriptionDialog({ workspaceId, action, onClose, onDone }: { workspaceId: string; action: SubscriptionAction | null; onClose: () => void; onDone: (action: SubscriptionAction) => void }) {
  const t = useTranslations("workspaces.billing");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const withStepUp = useStepUp();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, control, formState } = useForm<Values>({ defaultValues: { planId: "", trial: false, days: "", reason: "" } });
  const trial = useWatch({ control, name: "trial" });

  const plans = useQuery({
    queryKey: ["plans", "published"],
    queryFn: () => admin<PagedResult<Plan>>("/plans?status=published&pageSize=100"),
    enabled: action === "grant",
  });

  const mutation = useMutation({
    mutationFn: ({ kind, values }: { kind: SubscriptionAction; values: Values }) => {
      const days = values.days.trim() ? Number(toLatinDigits(values.days.trim())) : null;
      const reason = values.reason.trim();
      const body =
        kind === "grant"
          ? ({ planId: values.planId, trial: values.trial, endsAt: null, days, reason } satisfies GrantPlanRequest)
          : kind === "extend"
            ? { days, reason }
            : { reason };
      return withStepUp(() => admin<SubscriptionInfo>(`/workspaces/${workspaceId}/${PATHS[kind]}`, { method: "POST", body }));
    },
    onSuccess: async (_, { kind }) => {
      await queryClient.invalidateQueries({ queryKey: ["workspace-billing", workspaceId] });
      reset();
      onDone(kind);
    },
    onError: (error) => {
      if (error instanceof StepUpCancelled) return;
      if (error instanceof ApiError) {
        for (const field of ["planId", "days", "reason"] as const) {
          const codes = error.fieldErrors[field] ?? (field === "days" ? error.fieldErrors.endsAt : undefined);
          if (codes) setError(field, { message: fieldError(codes) });
        }
      }
      setFormError(errorMessage(error));
    },
  });

  const close = () => {
    reset();
    setFormError(null);
    onClose();
  };
  const daysRule = (max: number, required: boolean) => ({
    validate: (v: string) => {
      const text = toLatinDigits(v.trim());
      if (!text) return required ? te("validation.required") : true;
      const n = Number(text);
      return Number.isInteger(n) && n >= 1 && n <= max ? true : t("daysRange", { max });
    },
  });

  return (
    <Dialog open={action !== null} onOpenChange={(open) => !open && close()}>
      {action ? (
        <DialogContent title={t(`${action}.title`)} description={t(`${action}.body`)} closeLabel={tc("close")} className="max-w-lg">
          <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((values) => {
            setFormError(null);
            mutation.mutate({ kind: action, values });
          })}>
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            {action === "grant" ? (
              <>
                <Field label={t("plan")} error={formState.errors.planId?.message}>
                  {({ id, describedBy, invalid }) => (
                    <select id={id} aria-describedby={describedBy} aria-invalid={invalid} className="h-10 rounded-md border border-border bg-surface px-2 text-sm" {...register("planId", { required: te("validation.required") })}>
                      <option value="">{plans.isPending ? tc("loading") : t("choosePlan")}</option>
                      {(plans.data?.items ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {`${p.name} (${p.code}, ${t("versionShort", { n: toPersianDigits(p.version) })}) — ${p.isFree ? t("free") : formatToman(p.monthly.amount)}`}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-primary" {...register("trial")} />
                  {t("trial")}
                </label>
                <Field label={t("days")} hint={trial ? t("daysTrialHint") : t("daysHint")} error={formState.errors.days?.message}>
                  {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid} {...register("days", daysRule(1095, trial))} />}
                </Field>
              </>
            ) : null}
            {action === "extend" ? (
              <Field label={t("extendDays")} hint={t("extendHint")} error={formState.errors.days?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid} {...register("days", daysRule(365, true))} />}
              </Field>
            ) : null}
            <Field label={tc("reason")} hint={t("reasonHint")} error={formState.errors.reason?.message}>
              {({ id, describedBy, invalid }) => (
                <Textarea id={id} maxLength={300} aria-describedby={describedBy} aria-invalid={invalid} {...register("reason", {
                  validate: (v) => (v.trim().length === 0 ? te("validation.required") : v.trim().length < 5 ? te("validation.too_short") : true),
                })} />
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>
                {tc("cancel")}
              </Button>
              <Button type="submit" variant={action === "cancel" ? "danger" : "primary"} disabled={mutation.isPending}>
                {t(`${action}.confirm`)}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
