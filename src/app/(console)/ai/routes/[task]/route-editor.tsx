"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, ArrowUp, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { admin } from "@/lib/api/client";
import type { AiProvider, AiTaskRoutes } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { SourceBadge, useTaskLabel } from "../../ai-shared";
import { EMPTY_STEP, MAX_STEPS, parseDecimal, stepFieldPath, toRouteStep, toStepValues, type StepValues } from "../route-values";

interface Values {
  steps: StepValues[];
  reason: string;
}

/** Loads the task's chain and the providers, then shows the editor. */
export function RouteEditor({ task }: { task: string }) {
  const t = useTranslations("ai.routes");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const taskLabel = useTaskLabel();
  const routes = useQuery({ queryKey: ["ai-routes"], queryFn: () => admin<AiTaskRoutes[]>("/ai/routes") });
  const providers = useQuery({ queryKey: ["ai-providers"], queryFn: () => admin<AiProvider[]>("/ai/providers") });
  const current = routes.data?.find((r) => r.task === task);

  return (
    <>
      <Link href="/ai/routes" className="mb-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowRight className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <PageHeader title={t("editTitle", { task: taskLabel(task) })} description={t("editDescription")} />
      {routes.error || providers.error ? <Alert tone="danger">{errorMessage(routes.error ?? providers.error)}</Alert> : null}
      {routes.isPending || providers.isPending ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}
      {routes.data && !current ? <Alert tone="warning">{t("unknownTask")}</Alert> : null}
      {current && providers.data ? <RouteForm key={current.task} current={current} providers={providers.data} /> : null}
    </>
  );
}

function RouteForm({ current, providers }: { current: AiTaskRoutes; providers: AiProvider[] }) {
  const t = useTranslations("ai.routes");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<"saved" | "reset" | null>(null);
  const { register, control, handleSubmit, setError, getValues, trigger, reset, formState } = useForm<Values>({
    defaultValues: { steps: current.routes.map(toStepValues), reason: "" },
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: "steps" });

  const mutation = useMutation({
    mutationFn: ({ steps, reason }: { steps: StepValues[]; reason: string }) =>
      admin<AiTaskRoutes>(`/ai/routes/${current.task}`, { method: "PUT", body: { routes: steps.map(toRouteStep), reason: reason.trim() } }),
    onSuccess: (result, { steps }) => {
      queryClient.setQueryData<AiTaskRoutes[]>(["ai-routes"], (old) => old?.map((r) => (r.task === result.task ? result : r)));
      reset({ steps: result.routes.map(toStepValues), reason: "" });
      setSaved(steps.length === 0 ? "reset" : "saved");
    },
    onError: (error) => {
      setSaved(null);
      if (error instanceof ApiError) {
        for (const [key, codes] of Object.entries(error.fieldErrors)) {
          const path = stepFieldPath(key);
          if (path) setError(path, { message: fieldError(codes) });
          else if (key === "reason") setError("reason", { message: fieldError(codes) });
        }
      }
      setFormError(errorMessage(error));
    },
  });

  const submit = (values: Values) => {
    const keys = values.steps.map((s) => `${s.provider}/${s.model.trim()}`);
    if (new Set(keys).size !== keys.length) {
      setFormError(te("ai.routes.duplicate"));
      return;
    }
    setFormError(null);
    mutation.mutate(values);
  };
  const resetToConfig = async () => {
    if (!(await trigger("reason"))) return;
    setFormError(null);
    mutation.mutate({ steps: [], reason: getValues("reason") });
  };

  const enabled = providers.filter((p) => p.enabled);
  const range = (min: number, max: number, required: boolean, whole: boolean) => (v: string) => {
    const n = parseDecimal(v);
    if (n == null) return required ? te("validation.required") : true;
    return !Number.isNaN(n) && n >= min && n <= max && (!whole || Number.isInteger(n)) ? true : t("range", { min: toPersianDigits(min), max: toPersianDigits(max) });
  };

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(submit)}>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      {saved ? <Alert tone="success">{t(saved === "reset" ? "resetDone" : "savedDone")}</Alert> : null}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("currentSource")}</span>
        <SourceBadge source={current.source} />
      </div>
      {fields.length === 0 ? <Alert tone="info">{t("emptyChain")}</Alert> : null}
      {fields.map((field, i) => {
        const err = formState.errors.steps?.[i];
        return (
          <Card key={field.id}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle>{t("step", { n: toPersianDigits(i + 1) })}</CardTitle>
              <div className="flex gap-1">
                <Button size="icon" variant="secondary" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={t("moveUp", { n: toPersianDigits(i + 1) })}>
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
                <Button size="icon" variant="secondary" disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label={t("moveDown", { n: toPersianDigits(i + 1) })}>
                  <ArrowDown className="size-4" aria-hidden />
                </Button>
                <Button size="icon" variant="secondary" onClick={() => remove(i)} aria-label={t("removeStep", { n: toPersianDigits(i + 1) })}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label={t("columns.provider")} error={err?.provider?.message}>
                {({ id, describedBy, invalid }) => (
                  <select id={id} aria-describedby={describedBy} aria-invalid={invalid} className="h-10 rounded-md border border-border bg-surface px-2 text-sm" {...register(`steps.${i}.provider`, { required: te("validation.required") })}>
                    <option value="">{t("chooseProvider")}</option>
                    {enabled.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t("columns.model")} error={err?.model?.message}>
                {({ id, describedBy, invalid }) => (
                  <Input id={id} dir="ltr" aria-describedby={describedBy} aria-invalid={invalid} {...register(`steps.${i}.model`, { validate: (v) => (v.trim() ? (v.trim().length > 200 ? te("validation.too_long") : true) : te("validation.required")) })} />
                )}
              </Field>
              <Field label={t("columns.temperature")} hint={t("temperatureHint")} error={err?.temperature?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" inputMode="decimal" aria-describedby={describedBy} aria-invalid={invalid} {...register(`steps.${i}.temperature`, { validate: range(0, 2, false, false) })} />}
              </Field>
              <Field label={t("columns.maxOutputTokens")} hint={t("maxOutputTokensHint")} error={err?.maxOutputTokens?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid} {...register(`steps.${i}.maxOutputTokens`, { validate: range(1, 32000, false, true) })} />}
              </Field>
              <Field label={t("columns.timeout")} hint={t("timeoutHint")} error={err?.timeoutSeconds?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid} {...register(`steps.${i}.timeoutSeconds`, { validate: range(1, 300, true, true) })} />}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("inputPrice")} hint={t("priceHint")} error={err?.inputPrice?.message}>
                  {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" inputMode="decimal" aria-describedby={describedBy} aria-invalid={invalid} {...register(`steps.${i}.inputPrice`, { validate: range(0, 1e12, false, false) })} />}
                </Field>
                <Field label={t("outputPrice")} error={err?.outputPrice?.message}>
                  {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" inputMode="decimal" aria-describedby={describedBy} aria-invalid={invalid} {...register(`steps.${i}.outputPrice`, { validate: range(0, 1e12, false, false) })} />}
                </Field>
              </div>
            </CardContent>
          </Card>
        );
      })}
      <Button variant="secondary" className="self-start" disabled={fields.length >= MAX_STEPS} onClick={() => append({ ...EMPTY_STEP })}>
        <Plus className="size-4" aria-hidden />
        {t("addStep")}
      </Button>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Field label={tc("reason")} hint={t("reasonHint")} error={formState.errors.reason?.message}>
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                maxLength={300}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...register("reason", { validate: (v) => (v.trim().length === 0 ? te("validation.required") : v.trim().length < 5 ? te("validation.too_short") : true) })}
              />
            )}
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            {current.source === "database" ? (
              <Button variant="secondary" disabled={mutation.isPending} onClick={resetToConfig}>
                {t("resetToConfig")}
              </Button>
            ) : null}
            <Button type="submit" disabled={mutation.isPending || fields.length === 0}>
              {t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
