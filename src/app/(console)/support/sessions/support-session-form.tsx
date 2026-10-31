"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { StepUpCancelled, useStepUp } from "@/components/console/step-up";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { admin } from "@/lib/api/client";
import type { AdminWorkspaceDetail, SupportSessionLink } from "@/lib/api/types";
import { toLatinDigits, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { WorkspacePicker } from "./workspace-picker";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Values {
  workspaceId: string;
  userId: string;
  reason: string;
}

/**
 * Support session (admin plan 4.2, backend PR #18): step-up + reason, then a one-time link that the user panel exchanges
 * for a 30-minute session. The link is only kept in component state and dropped when it expires.
 * The workspace is picked through the workspace search (backend PR #19); where that API is missing, ids are typed in.
 */
export function SupportSessionForm({ initialWorkspaceId, initialUserId }: { initialWorkspaceId: string; initialUserId: string }) {
  const t = useTranslations("support");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const tw = useTranslations("workspaces");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const withStepUp = useStepUp();
  const [link, setLink] = useState<SupportSessionLink | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [opened, setOpened] = useState(false);
  const [manual, setManual] = useState(false);
  const { register, handleSubmit, setError, setValue, control, formState } = useForm<Values>({
    defaultValues: { workspaceId: initialWorkspaceId, userId: initialUserId, reason: "" },
  });
  const switchToManual = useCallback(() => setManual(true), []);

  const workspaceId = toLatinDigits(useWatch({ control, name: "workspaceId" }).trim());
  const workspace = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => admin<AdminWorkspaceDetail>(`/workspaces/${encodeURIComponent(workspaceId)}`),
    enabled: !manual && UUID.test(workspaceId),
    retry: false,
  });
  const workspaceMissing = workspace.error instanceof ApiError && workspace.error.status === 404;
  // Without the workspace API (or with an unknown id) fall back to typing ids, keeping what was given.
  const manualEntry = manual || workspaceMissing;

  const pick = (id: string) => {
    setValue("workspaceId", id, { shouldValidate: formState.isSubmitted });
    setValue("userId", "");
  };

  useEffect(() => {
    if (!link) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((new Date(link.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setLink(null);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [link]);

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      withStepUp(() =>
        admin<SupportSessionLink>(`/workspaces/${encodeURIComponent(values.workspaceId)}/support-sessions`, {
          method: "POST",
          body: { reason: values.reason.trim(), userId: values.userId || null },
        }),
      ),
    onSuccess: (result) => {
      setOpened(false);
      setLink(result);
    },
    onError: (error) => {
      if (error instanceof StepUpCancelled) return;
      if (error instanceof ApiError && error.status === 404) {
        setUnavailable(true);
        return;
      }
      if (error instanceof ApiError) {
        const reason = error.fieldErrors["request.reason"] ?? error.fieldErrors.reason;
        if (reason) setError("reason", { message: fieldError(reason) });
      }
      setFormError(errorMessage(error));
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    setLink(null);
    mutation.mutate({ workspaceId: toLatinDigits(values.workspaceId.trim()), userId: toLatinDigits(values.userId.trim()), reason: values.reason });
  });

  return (
    <div className="grid max-w-2xl gap-4">
      {unavailable ? <Alert tone="warning">{t("notAvailable")}</Alert> : null}
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            {manualEntry ? (
              <>
                {workspaceMissing ? <Alert tone="warning">{t("picker.notLoaded")}</Alert> : null}
                <Field label={t("workspaceId")} hint={t("workspaceHint")} error={formState.errors.workspaceId?.message}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      dir="ltr"
                      autoComplete="off"
                      spellCheck={false}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      {...register("workspaceId", { validate: (v) => UUID.test(toLatinDigits(v.trim())) || t("invalidId") })}
                    />
                  )}
                </Field>
                <Field label={t("userId")} hint={t("userHint")} error={formState.errors.userId?.message}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      dir="ltr"
                      autoComplete="off"
                      spellCheck={false}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      {...register("userId", { validate: (v) => !v.trim() || UUID.test(toLatinDigits(v.trim())) || t("invalidId") })}
                    />
                  )}
                </Field>
              </>
            ) : (
              <>
                <input type="hidden" {...register("workspaceId", { validate: (v) => UUID.test(toLatinDigits(v.trim())) || t("picker.required") })} />
                {workspace.data ? (
                  <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm" data-testid="picked-workspace">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">{t("picker.picked")}</div>
                      <div className="font-medium">{workspace.data.name}</div>
                      <div className="ltr truncate text-start font-mono text-xs text-muted-foreground">
                        {workspace.data.slug} · {workspace.data.id}
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => pick("")}>
                      {t("picker.change")}
                    </Button>
                  </div>
                ) : UUID.test(workspaceId) && workspace.isPending ? (
                  <p className="text-sm text-muted-foreground">{tc("loading")}</p>
                ) : (
                  <WorkspacePicker onPick={(w) => pick(w.id)} />
                )}
                {formState.errors.workspaceId?.message ? (
                  <p className="text-sm text-danger" role="alert">
                    {formState.errors.workspaceId.message}
                  </p>
                ) : null}
                {workspace.data ? (
                  <Field label={t("member")} hint={t("memberHint")}>
                    {({ id, describedBy }) => (
                      <select id={id} aria-describedby={describedBy} className="h-10 rounded-md border border-border bg-surface px-2 text-sm" {...register("userId")}>
                        <option value="">{t("ownerDefault")}</option>
                        {workspace.data.members
                          .filter((m) => m.role !== "owner")
                          .map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {`${m.displayName ?? m.maskedPhone ?? m.userId} (${tw.has(`roles.${m.role}`) ? tw(`roles.${m.role}`) : m.role})`}
                            </option>
                          ))}
                      </select>
                    )}
                  </Field>
                ) : null}
                <button type="button" className="self-start text-xs text-primary hover:underline" onClick={switchToManual}>
                  {t("picker.manual")}
                </button>
              </>
            )}
            <Field label={t("reason")} hint={t("reasonHint")} error={formState.errors.reason?.message}>
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  maxLength={300}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...register("reason", {
                    validate: (v) => (v.trim().length === 0 ? te("validation.required") : v.trim().length < 5 ? te("validation.too_short") : true),
                  })}
                />
              )}
            </Field>
            <Button type="submit" disabled={mutation.isPending} className="self-start">
              {t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {link ? (
        <Card className="border-warning" data-testid="support-link">
          <CardHeader>
            <CardTitle>{t("linkTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm">{t("linkBody", { seconds: toPersianDigits(secondsLeft) })}</p>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              onClick={() =>
                // The link works once: drop it as soon as it has been used.
                window.setTimeout(() => {
                  setLink(null);
                  setOpened(true);
                }, 0)
              }
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <ExternalLink className="size-4" aria-hidden />
              {t("open")}
            </a>
          </CardContent>
        </Card>
      ) : null}
      {opened ? <Alert tone="success">{t("opened")}</Alert> : null}
      {!link && !opened && mutation.isSuccess && secondsLeft === 0 ? <Alert tone="info">{t("expired")}</Alert> : null}
    </div>
  );
}
