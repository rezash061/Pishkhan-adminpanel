"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { StepUpCancelled, useStepUp } from "@/components/console/step-up";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { admin } from "@/lib/api/client";
import { OUTAGE_MODES, type AdminOutage } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatJalaliDateTime, formatNumber, formatRelative, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { failureShare, OUTAGE_QUERY_KEY, OUTAGE_REFRESH_MS } from "./outage-values";

export function useOutage(enabled = true) {
  return useQuery({
    queryKey: OUTAGE_QUERY_KEY,
    queryFn: () => admin<AdminOutage>("/platform/outage"),
    refetchInterval: OUTAGE_REFRESH_MS,
    refetchIntervalInBackground: false,
    enabled,
  });
}

function percent(share: number | null): string {
  if (share === null) return "—";
  return `${toPersianDigits((Math.round(share * 1000) / 10).toString()).replace(".", "٫")}٪`;
}

/** Instagram outage mode (admin plan 4.7, backend PR #47): status, detector counts and the staff override. */
export function OutagePanel() {
  const t = useTranslations("outage");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { data, error, isPending, dataUpdatedAt } = useOutage();

  if (isPending && !error) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (error instanceof ApiError && error.status === 404) return <Alert tone="warning">{t("notAvailable")}</Alert>;
  if (error || !data) return <Alert tone="danger">{errorMessage(error)}</Alert>;

  const down = data.status === "down";
  const share = failureShare(data);
  const modeLabel = (m: string) => (t.has(`modes.${m}`) ? t(`modes.${m}`) : m);

  return (
    <div className="flex flex-col gap-4">
      <div
        data-testid="outage-status"
        role={down ? "alert" : "status"}
        className={cn(
          "flex flex-col gap-1 rounded-lg border-2 px-5 py-4",
          down ? "border-danger bg-danger/10 text-danger" : "border-success/60 bg-success/10 text-success-foreground",
        )}
      >
        <span className="text-lg font-bold">{t.has(`statuses.${data.status}`) ? t(`statuses.${data.status}`) : data.status}</span>
        <span className="text-sm text-foreground">{t("since", { date: formatJalaliDateTime(data.since), relative: formatRelative(data.since) })}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("modeLabel")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge tone={data.mode === "auto" ? "info" : "warning"}>{modeLabel(data.mode)}</Badge>
              <code dir="ltr" className="text-xs text-muted-foreground">
                {data.mode}
              </code>
            </div>
            {t.has(`modeHelp.${data.mode}`) ? <p className="text-muted-foreground">{t(`modeHelp.${data.mode}`)}</p> : null}
            <div>
              <div className="text-muted-foreground">{t("reasonLabel")}</div>
              <div dir="auto">{data.modeReason ?? t("noReason")}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("detector", { minutes: toPersianDigits(data.windowMinutes) })}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-3 text-center" data-testid="outage-counts">
              <div className="rounded-md border border-border p-3">
                <dt className="text-xs text-muted-foreground">{t("ok")}</dt>
                <dd className="text-xl font-semibold">{formatNumber(data.ok)}</dd>
              </div>
              <div className="rounded-md border border-border p-3">
                <dt className="text-xs text-muted-foreground">{t("failed")}</dt>
                <dd className={cn("text-xl font-semibold", data.failed > 0 && "text-danger")}>{formatNumber(data.failed)}</dd>
              </div>
              <div className="rounded-md border border-border p-3">
                <dt className="text-xs text-muted-foreground">{t("failureShare")}</dt>
                <dd className="text-xl font-semibold">{percent(share)}</dd>
              </div>
            </dl>
            {share === null ? <p className="mt-3 text-xs text-muted-foreground">{t("noCalls")}</p> : null}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">{t("refresh", { time: formatJalaliDateTime(new Date(dataUpdatedAt)) })}</p>

      <ModeForm current={data} />
    </div>
  );
}

/** Auto, forced down or forced up, with a required reason and step-up. */
function ModeForm({ current }: { current: AdminOutage }) {
  const t = useTranslations("outage");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const staff = useStaff();
  const withStepUp = useStepUp();
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, control, reset, setError, formState } = useForm<{ mode: string; reason: string }>({ defaultValues: { mode: current.mode, reason: "" } });
  const mode = useWatch({ control, name: "mode" });

  const mutation = useMutation({
    mutationFn: (body: { mode: string; reason: string }) => withStepUp(() => admin<AdminOutage>("/platform/outage", { method: "PUT", body })),
    onSuccess: (result) => {
      queryClient.setQueryData(OUTAGE_QUERY_KEY, result);
      reset({ mode: result.mode, reason: "" });
      setNotice(t("change.done", { mode: t(`modes.${result.mode}`), status: t(`statuses.${result.status}`) }));
    },
    onError: (error) => {
      if (error instanceof StepUpCancelled) return;
      if (error instanceof ApiError) {
        if (error.fieldErrors.reason) setError("reason", { message: fieldError(error.fieldErrors.reason) });
        if (error.fieldErrors.mode) setError("mode", { message: fieldError(error.fieldErrors.mode) });
      }
      setFormError(errorMessage(error));
    },
  });

  if (!staff.can("platform.outage.manage")) {
    return <Alert tone="info">{t("change.readOnly")}</Alert>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("change.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) => {
            setNotice(null);
            setFormError(null);
            mutation.mutate({ mode: values.mode, reason: values.reason.trim() });
          })}
        >
          {notice ? <Alert tone="success">{notice}</Alert> : null}
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("modeLabel")}</legend>
            {OUTAGE_MODES.map((m) => (
              <label key={m} className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm", mode === m ? "border-primary bg-primary/5" : "border-border")}>
                <input type="radio" value={m} className="mt-1 size-4 accent-primary" {...register("mode")} />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {t(`modes.${m}`)}
                    {m === current.mode ? <span className="ms-2 text-xs font-normal text-muted-foreground">({t("change.current")})</span> : null}
                  </span>
                  <span className="text-muted-foreground">{t(`modeHelp.${m}`)}</span>
                </span>
              </label>
            ))}
            {formState.errors.mode?.message ? <p className="text-xs text-danger">{formState.errors.mode.message}</p> : null}
          </fieldset>
          <Alert tone="warning">{t("change.warning")}</Alert>
          <Field label={tc("reason")} hint={t("change.reasonHint")} error={formState.errors.reason?.message}>
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                maxLength={300}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...register("reason", {
                  validate: (v) => {
                    const n = v.trim().length;
                    if (n === 0) return te("validation.required");
                    if (n < 5) return te("validation.too_short");
                    return n > 300 ? te("validation.too_long") : true;
                  },
                })}
              />
            )}
          </Field>
          <Button type="submit" className="self-start" variant={mode === "forced_down" ? "danger" : "primary"} disabled={mutation.isPending}>
            {t("change.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** A red alert for the home dashboard while Instagram is down; nothing otherwise. */
export function OutageHomeAlert() {
  const t = useTranslations("outage");
  const { data } = useOutage();
  if (!data || data.status !== "down") return null;
  return (
    <Alert tone="danger" className="mb-6" data-testid="outage-home-alert">
      {t("homeAlert", { relative: formatRelative(data.since), mode: t.has(`modes.${data.mode}`) ? t(`modes.${data.mode}`) : data.mode })}{" "}
      <Link href="/platform/outage" className="font-medium underline">
        {t("homeAlertLink")}
      </Link>
    </Alert>
  );
}
