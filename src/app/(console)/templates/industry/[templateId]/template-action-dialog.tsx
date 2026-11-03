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
import type { IndustryTemplate } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { problemIssues } from "../template-values";

export type TemplateAction = "publish" | "archive";

interface Props {
  template: IndustryTemplate;
  action: TemplateAction | null;
  onClose: () => void;
  onDone: (action: TemplateAction, result: IndustryTemplate) => void;
  /** A 422 `templates.invalid` on publish: the server's issues, shown in the checklist. */
  onRefused: (issues: string[]) => void;
}

/** Publish (reason optional) or archive (reason required, 5 to 300 characters), each after step-up. */
export function TemplateActionDialog({ template, action, onClose, onDone, onRefused }: Props) {
  const t = useTranslations("templates.actions");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const withStepUp = useStepUp();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<{ reason: string }>({ defaultValues: { reason: "" } });

  const close = () => {
    reset();
    setFormError(null);
    onClose();
  };

  const mutation = useMutation({
    mutationFn: ({ kind, reason }: { kind: TemplateAction; reason: string }) =>
      withStepUp(() => admin<IndustryTemplate>(`/industry-templates/${template.id}/${kind}`, { method: "POST", body: { reason: reason || null } })),
    onSuccess: async (result, { kind }) => {
      await queryClient.invalidateQueries({ queryKey: ["industry-templates"] });
      queryClient.setQueryData(["industry-template", template.id], result);
      reset();
      onDone(kind, result);
    },
    onError: (error) => {
      if (error instanceof StepUpCancelled) return;
      if (error instanceof ApiError && error.code === "templates.invalid") {
        onRefused(problemIssues(error.problem));
        close();
        return;
      }
      if (error instanceof ApiError && error.fieldErrors.reason) setError("reason", { message: fieldError(error.fieldErrors.reason) });
      setFormError(errorMessage(error));
    },
  });

  const required = action === "archive";
  const body = action === "archive" ? t(template.status === "published" ? "archive.bodyPublished" : template.status === "draft" ? "archive.bodyDraft" : "archive.body") : action ? t("publish.body") : "";

  return (
    <Dialog open={action !== null} onOpenChange={(open) => !open && close()}>
      {action ? (
        <DialogContent title={t(`${action}.title`, { name: template.name, n: toPersianDigits(template.version) })} description={body} closeLabel={tc("close")}>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={handleSubmit(({ reason }) => {
              setFormError(null);
              mutation.mutate({ kind: action, reason: reason.trim() });
            })}
          >
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            <Field label={required ? tc("reason") : t("reasonOptional")} hint={t("reasonHint")} error={formState.errors.reason?.message}>
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  maxLength={300}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...register("reason", {
                    validate: (v) => {
                      const n = v.trim().length;
                      if (n === 0) return required ? te("validation.required") : true;
                      return n < 5 ? te("validation.too_short") : true;
                    },
                  })}
                />
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>
                {tc("cancel")}
              </Button>
              <Button type="submit" variant={action === "archive" ? "danger" : "primary"} disabled={mutation.isPending}>
                {t(`${action}.confirm`)}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
