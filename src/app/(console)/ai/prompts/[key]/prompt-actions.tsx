"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { admin } from "@/lib/api/client";
import type { EvalRun, EvalSet, PromptKey, PromptVersion } from "@/lib/api/types";
import { formatNumber, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { GateChecks, useGateCheckLabel } from "../../ai-shared";

const MAX_TEXT = 20_000;

/** A new version written from `base` (kept as its base for the diff). Not active until it passes the eval gate. */
export function NewVersionForm({ promptKey, base, onCancel, onCreated }: { promptKey: string; base: PromptVersion; onCancel: () => void; onCreated: (v: PromptVersion) => void }) {
  const t = useTranslations("ai.prompts");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const queryClient = useQueryClient();
  const { register, handleSubmit, setError, formState } = useForm<{ text: string }>({ defaultValues: { text: base.text } });

  const mutation = useMutation({
    mutationFn: (text: string) => admin<PromptVersion>(`/ai/prompts/${encodeURIComponent(promptKey)}/versions`, { method: "POST", body: { text, baseVersion: base.version } }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["ai-prompt", promptKey] });
      await queryClient.invalidateQueries({ queryKey: ["ai-prompts"] });
      onCreated(created);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.fieldErrors.text) setError("text", { message: fieldError(error.fieldErrors.text) });
    },
  });

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={handleSubmit((v) => mutation.mutate(v.text))}>
      {mutation.error ? <Alert tone="danger">{errorMessage(mutation.error)}</Alert> : null}
      <Field label={t("newVersionText", { v: toPersianDigits(base.version) })} hint={t("textHint")} error={formState.errors.text?.message}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            dir="auto"
            className="min-h-80 font-mono text-xs"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            {...register("text", {
              validate: (v) => (!v.trim() ? te("validation.required") : v.length > MAX_TEXT ? te("validation.too_long") : v === base.text ? t("unchanged") : true),
            })}
          />
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {t("saveVersion")}
        </Button>
      </div>
    </form>
  );
}

/** Starts an eval run of this version over a set; the run continues in the background. */
export function StartRunDialog({ open, promptKey, version, onClose, onStarted }: { open: boolean; promptKey: string; version: string; onClose: () => void; onStarted: (run: EvalRun) => void }) {
  const t = useTranslations("ai.prompts");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const sets = useQuery({ queryKey: ["ai-eval-sets"], queryFn: () => admin<EvalSet[]>("/ai/eval-sets"), enabled: open });
  const { register, handleSubmit, reset, formState } = useForm<{ setId: string }>({ defaultValues: { setId: "" } });

  const mutation = useMutation({
    mutationFn: (setId: string) => admin<EvalRun>("/ai/eval-runs", { method: "POST", body: { setId, promptKey, promptVersion: version } }),
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({ queryKey: ["ai-prompt", promptKey] });
      await queryClient.invalidateQueries({ queryKey: ["ai-eval-runs"] });
      reset();
      onStarted(run);
    },
  });

  const close = () => {
    reset();
    mutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open ? (
        <DialogContent title={t("runTitle", { v: toPersianDigits(version) })} description={t("runBody")} closeLabel={tc("close")}>
          <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v.setId))}>
            {mutation.error ? <Alert tone="danger">{errorMessage(mutation.error)}</Alert> : null}
            {sets.data && sets.data.length === 0 ? <Alert tone="warning">{t("noSets")}</Alert> : null}
            <Field label={t("evalSet")} error={formState.errors.setId?.message}>
              {({ id, describedBy, invalid }) => (
                <select id={id} aria-describedby={describedBy} aria-invalid={invalid} className="h-10 rounded-md border border-border bg-surface px-2 text-sm" {...register("setId", { required: te("validation.required") })}>
                  <option value="">{sets.isPending ? tc("loading") : t("chooseSet")}</option>
                  {(sets.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {t("setOption", { name: s.name, n: formatNumber(s.caseCount) })}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {t("startRun")}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/** Activates the version with its latest eval run and a reason. The backend refuses (409) unless that run passes the gate. */
export function ActivateDialog({ open, promptKey, version, onClose, onDone }: { open: boolean; promptKey: string; version: PromptVersion; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("ai.prompts");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const queryClient = useQueryClient();
  const checkLabel = useGateCheckLabel();
  const [gateReasons, setGateReasons] = useState<string[]>([]);
  const { register, handleSubmit, reset, setError, formState } = useForm<{ reason: string }>({ defaultValues: { reason: "" } });
  const run = version.latestRun;

  const mutation = useMutation({
    mutationFn: (reason: string) =>
      admin<PromptKey>(`/ai/prompts/${encodeURIComponent(promptKey)}/versions/${encodeURIComponent(version.version)}/activate`, { method: "POST", body: { evalRunId: run?.id, reason: reason.trim() } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ai-prompt", promptKey] });
      await queryClient.invalidateQueries({ queryKey: ["ai-prompts"] });
      reset();
      onDone();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.fieldErrors.reason) setError("reason", { message: fieldError(error.fieldErrors.reason) });
        setGateReasons(
          Object.entries(error.fieldErrors)
            .filter(([k]) => k !== "reason")
            .map(([k, v]) => (k.startsWith("gate.") ? t("gateFailed", { check: checkLabel(k.slice(5)) }) : (fieldError(v) ?? k))),
        );
      }
    },
  });

  const close = () => {
    reset();
    mutation.reset();
    setGateReasons([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open ? (
        <DialogContent title={t("activateTitle", { v: toPersianDigits(version.version) })} description={t("activateBody")} closeLabel={tc("close")} className="max-w-lg">
          <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v.reason))}>
            {mutation.error ? (
              <Alert tone="danger">
                <p>{errorMessage(mutation.error)}</p>
                {gateReasons.length > 0 ? (
                  <ul className="mt-1 list-disc ps-5 text-xs">
                    {gateReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : null}
              </Alert>
            ) : null}
            {run ? (
              <div className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{t("activateWithRun", { set: run.setName })}</p>
                <GateChecks run={run} />
              </div>
            ) : null}
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
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {t("activate")}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
