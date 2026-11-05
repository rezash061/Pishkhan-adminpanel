"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { StepUpCancelled, useStepUp } from "@/components/console/step-up";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";

export interface ReasonDialogProps<T> {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  /** Wrap the call in step-up (the backend answers 403 `auth.step_up.required` otherwise). */
  stepUp?: boolean;
  /** Extra content above the reason field (a warning, the affected items). */
  children?: ReactNode;
  onSubmit: (reason: string) => Promise<T>;
  onDone: (result: T) => void;
  onClose: () => void;
}

/** A required reason (5 to 300 characters, kept in the audit log), optional step-up, then the action. Server field errors land on the field. */
export function ReasonDialog<T>({ open, title, description, confirmLabel, tone = "danger", stepUp = false, children, onSubmit, onDone, onClose }: ReasonDialogProps<T>) {
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const withStepUp = useStepUp();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<{ reason: string }>({ defaultValues: { reason: "" } });

  const mutation = useMutation({
    mutationFn: (reason: string) => (stepUp ? withStepUp(() => onSubmit(reason)) : onSubmit(reason)),
    onSuccess: (result) => {
      reset();
      setFormError(null);
      onDone(result);
    },
    onError: (error) => {
      if (error instanceof StepUpCancelled) return;
      if (error instanceof ApiError && error.fieldErrors.reason) setError("reason", { message: fieldError(error.fieldErrors.reason) });
      setFormError(errorMessage(error));
    },
  });

  const close = () => {
    reset();
    setFormError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      {open ? (
        <DialogContent title={title} description={description} closeLabel={tc("close")}>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={handleSubmit(({ reason }) => {
              setFormError(null);
              mutation.mutate(reason.trim());
            })}
          >
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            {children}
            <Field label={tc("reason")} error={formState.errors.reason?.message}>
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  maxLength={300}
                  placeholder={tc("reasonPlaceholder")}
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
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                {tc("cancel")}
              </Button>
              <Button type="submit" variant={tone} disabled={mutation.isPending}>
                {confirmLabel}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
