"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { StepUpCancelled, useStepUp } from "@/components/console/step-up";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { admin } from "@/lib/api/client";
import type { AdminUserSummary } from "@/lib/api/types";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";

export type UserAction = "revoke" | "block" | "unblock";

const PATHS: Record<UserAction, string> = { revoke: "sessions/revoke", block: "block", unblock: "unblock" };

interface Props {
  userId: string;
  action: UserAction | null;
  onClose: () => void;
  onDone: (action: UserAction, result: AdminUserSummary) => void;
}

/** Reason (5 to 300 characters, audited) and step-up, then the action. */
export function UserActionDialog({ userId, action, onClose, onDone }: Props) {
  const t = useTranslations("users.actions");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const withStepUp = useStepUp();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<{ reason: string }>({ defaultValues: { reason: "" } });

  const mutation = useMutation({
    mutationFn: ({ kind, reason }: { kind: UserAction; reason: string }) =>
      withStepUp(() => admin<AdminUserSummary>(`/users/${encodeURIComponent(userId)}/${PATHS[kind]}`, { method: "POST", body: { reason } })),
    onSuccess: async (result, { kind }) => {
      await queryClient.invalidateQueries({ queryKey: ["user", userId] });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      reset();
      onDone(kind, result);
    },
    onError: (error) => {
      if (error instanceof StepUpCancelled) return;
      if (error instanceof ApiError) {
        const reason = error.fieldErrors.reason ?? error.fieldErrors["request.reason"];
        if (reason) setError("reason", { message: fieldError(reason) });
      }
      setFormError(errorMessage(error));
    },
  });

  const close = () => {
    reset();
    setFormError(null);
    onClose();
  };

  return (
    <Dialog open={action !== null} onOpenChange={(open) => !open && close()}>
      {action ? (
        <DialogContent title={t(`${action}.title`)} description={t(`${action}.body`)} closeLabel={tc("close")}>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={handleSubmit(({ reason }) => {
              setFormError(null);
              mutation.mutate({ kind: action, reason: reason.trim() });
            })}
          >
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            <Field label={tc("reason")} hint={t("reasonHint")} error={formState.errors.reason?.message}>
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  maxLength={300}
                  placeholder={tc("reasonPlaceholder")}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...register("reason", {
                    validate: (v) => (v.trim().length === 0 ? te("validation.required") : v.trim().length < 5 ? te("validation.too_short") : true),
                  })}
                />
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                {tc("cancel")}
              </Button>
              <Button type="submit" variant={action === "unblock" ? "primary" : "danger"} disabled={mutation.isPending}>
                {t(`${action}.confirm`)}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
