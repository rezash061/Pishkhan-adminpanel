"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { StepUpCancelled, useStepUp } from "@/components/console/step-up";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { admin } from "@/lib/api/client";
import type { AiProvider, AiProviderRequest, AiProviderTestResult } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";

const NAME_PATTERN = /^[a-z][a-z0-9_-]{1,39}$/;

interface Values {
  name: string;
  kind: string;
  baseUrl: string;
  apiKey: string;
  clearApiKey: boolean;
  enabled: boolean;
  reason: string;
}

const defaults = (p: AiProvider | null): Values => ({
  name: p?.name ?? "",
  kind: p?.kind ?? "openai",
  baseUrl: p?.baseUrl ?? "",
  apiKey: "",
  clearApiKey: false,
  enabled: p?.enabled ?? true,
  reason: "",
});

/** Create or change a provider: SuperAdmin, reason and step-up. The key is write-only. */
export function ProviderDialog({ provider, existing, onClose, onDone }: { provider: AiProvider | "new" | null; existing: string[]; onClose: () => void; onDone: (name: string) => void }) {
  const open = provider !== null;
  const current = provider === "new" ? null : provider;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open ? <ProviderForm key={current?.name ?? "new"} current={current} existing={existing} onClose={onClose} onDone={onDone} /> : null}
    </Dialog>
  );
}

function ProviderForm({ current, existing, onClose, onDone }: { current: AiProvider | null; existing: string[]; onClose: () => void; onDone: (name: string) => void }) {
  const t = useTranslations("ai.providers");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const withStepUp = useStepUp();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, control, formState } = useForm<Values>({ defaultValues: defaults(current) });
  const clearApiKey = useWatch({ control, name: "clearApiKey" });

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body: AiProviderRequest = {
        kind: v.kind,
        baseUrl: v.baseUrl.trim() || null,
        apiKey: v.clearApiKey ? null : v.apiKey.trim() || null,
        clearApiKey: v.clearApiKey,
        enabled: v.enabled,
        reason: v.reason.trim(),
      };
      return withStepUp(() => admin<AiProvider>(`/ai/providers/${encodeURIComponent(v.name.trim())}`, { method: "PUT", body }));
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
      onDone(result.name);
    },
    onError: (error) => {
      if (error instanceof StepUpCancelled) return;
      if (error instanceof ApiError) {
        for (const field of ["name", "kind", "baseUrl", "apiKey", "reason"] as const) {
          if (error.fieldErrors[field]) setError(field, { message: fieldError(error.fieldErrors[field]) });
        }
      }
      setFormError(errorMessage(error));
    },
  });

  const reasonRule = {
    validate: (v: string) => (v.trim().length === 0 ? te("validation.required") : v.trim().length < 5 ? te("validation.too_short") : true),
  };

  return (
    <DialogContent title={current ? t("editTitle", { name: current.name }) : t("createTitle")} description={t("dialogBody")} closeLabel={tc("close")} className="max-w-lg">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((v) => {
          setFormError(null);
          mutation.mutate(v);
        })}
      >
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        {current ? null : (
          <Field label={t("fields.name")} hint={t("fields.nameHint")} error={formState.errors.name?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                dir="ltr"
                autoComplete="off"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...register("name", {
                  validate: (v) => (!NAME_PATTERN.test(v.trim()) ? t("fields.nameInvalid") : existing.includes(v.trim()) ? t("fields.nameTaken") : true),
                })}
              />
            )}
          </Field>
        )}
        <Field label={t("fields.kind")} error={formState.errors.kind?.message}>
          {({ id, describedBy, invalid }) => (
            <select id={id} aria-describedby={describedBy} aria-invalid={invalid} className="h-10 rounded-md border border-border bg-surface px-2 text-sm" {...register("kind")}>
              <option value="openai">{t("kinds.openai")}</option>
              <option value="fake">{t("kinds.fake")}</option>
            </select>
          )}
        </Field>
        <Field label={t("fields.baseUrl")} hint={t("fields.baseUrlHint")} error={formState.errors.baseUrl?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              dir="ltr"
              type="url"
              placeholder="https://api.example.com/v1"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register("baseUrl", {
                validate: (v) => {
                  const text = v.trim();
                  if (!text) return true;
                  try {
                    const url = new URL(text);
                    return (url.protocol === "https:" || url.protocol === "http:") && text.length <= 500 ? true : t("fields.baseUrlInvalid");
                  } catch {
                    return t("fields.baseUrlInvalid");
                  }
                },
              })}
            />
          )}
        </Field>
        <Field label={t("fields.apiKey")} hint={current?.hasApiKey ? t("fields.apiKeyKeep") : t("fields.apiKeyHint")} error={formState.errors.apiKey?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} dir="ltr" type="password" autoComplete="new-password" disabled={clearApiKey} aria-describedby={describedBy} aria-invalid={invalid} {...register("apiKey", { maxLength: { value: 500, message: te("validation.too_long") } })} />
          )}
        </Field>
        {current?.hasApiKey ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" {...register("clearApiKey")} />
            {t("fields.clearApiKey")}
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" {...register("enabled")} />
          {t("fields.enabled")}
        </label>
        <Field label={tc("reason")} hint={t("fields.reasonHint")} error={formState.errors.reason?.message}>
          {({ id, describedBy, invalid }) => <Textarea id={id} maxLength={300} aria-describedby={describedBy} aria-invalid={invalid} {...register("reason", reasonRule)} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {tc("save")}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

/** Sends one tiny request through the provider as it is in effect now (SuperAdmin). */
export function ProviderTestDialog({ provider, onClose }: { provider: AiProvider | null; onClose: () => void }) {
  return (
    <Dialog open={provider !== null} onOpenChange={(o) => !o && onClose()}>
      {provider ? <ProviderTest key={provider.name} provider={provider} onClose={onClose} /> : null}
    </Dialog>
  );
}

function ProviderTest({ provider, onClose }: { provider: AiProvider; onClose: () => void }) {
  const t = useTranslations("ai.providers");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState } = useForm<{ model: string }>({ defaultValues: { model: "" } });

  const mutation = useMutation({
    mutationFn: (model: string) => admin<AiProviderTestResult>(`/ai/providers/${encodeURIComponent(provider.name)}/test`, { method: "POST", body: { model } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["ai-providers"] }),
  });
  const result = mutation.data;

  return (
    <DialogContent title={t("testTitle", { name: provider.name })} description={t("testBody")} closeLabel={tc("close")} className="max-w-lg">
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v.model.trim()))}>
        {mutation.error ? <Alert tone="danger">{errorMessage(mutation.error)}</Alert> : null}
        {result ? (
          result.ok ? (
            <Alert tone="success">{t("testPassed", { ms: formatNumber(result.latencyMs) })}</Alert>
          ) : (
            <Alert tone="danger">
              <span>{t("testFailed")}</span>{" "}
              <span dir="auto" className="break-all">
                {result.error}
              </span>
            </Alert>
          )
        ) : null}
        <Field label={t("fields.model")} hint={t("fields.modelHint")} error={formState.errors.model?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} dir="ltr" placeholder="gpt-4o-mini" aria-describedby={describedBy} aria-invalid={invalid} {...register("model", { validate: (v) => (v.trim() ? (v.trim().length > 200 ? te("validation.too_long") : true) : te("validation.required")) })} />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {tc("close")}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("testing") : t("test")}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
