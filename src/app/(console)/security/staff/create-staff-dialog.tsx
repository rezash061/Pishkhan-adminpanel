"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { StepUpCancelled, useStepUp } from "@/components/console/step-up";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { admin } from "@/lib/api/client";
import type { CreateStaffRequest, StaffSummary } from "@/lib/api/types";
import { STAFF_ROLES } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (staff: StaffSummary) => void;
}

const USERNAME = /^[a-z][a-z0-9._-]{2,63}$/;

export function CreateStaffDialog({ open, onOpenChange, onCreated }: Props) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const withStepUp = useStepUp();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<CreateStaffRequest>({
    defaultValues: { username: "", password: "", roles: [] },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateStaffRequest) => withStepUp(() => admin<StaffSummary>("/staff", { method: "POST", body: values })),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      reset();
      onCreated(created);
    },
    onError: (error) => {
      if (error instanceof StepUpCancelled) return;
      if (error instanceof ApiError) {
        for (const [field, codes] of Object.entries(error.fieldErrors)) {
          if (field === "username" || field === "password" || field === "roles") setError(field, { message: fieldError(codes) });
        }
      }
      setFormError(errorMessage(error));
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate({ ...values, username: values.username.trim() });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          setFormError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent title={t("staff.form.title")} description={t("staff.form.intro")} closeLabel={t("common.close")}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <Field label={t("staff.form.username")} hint={t("staff.form.usernameHint")} error={formState.errors.username?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                dir="ltr"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...register("username", {
                  validate: (v) => USERNAME.test(v.trim()) || t("errors.validation.username.invalid"),
                })}
              />
            )}
          </Field>
          <Field label={t("staff.form.password")} hint={t("staff.form.passwordHint")} error={formState.errors.password?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="password"
                dir="ltr"
                autoComplete="new-password"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...register("password", { validate: (v) => v.length >= 14 || t("errors.validation.password.too_short") })}
              />
            )}
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("staff.form.roles")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {STAFF_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={role} className="size-4 accent-primary" {...register("roles", { validate: (v) => v.length > 0 || t("errors.validation.required") })} />
                  {t(`roles.${role}`)}
                </label>
              ))}
            </div>
            {formState.errors.roles?.message ? (
              <p role="alert" className="text-xs text-danger">
                {formState.errors.roles.message}
              </p>
            ) : null}
          </fieldset>
          <Button type="submit" disabled={mutation.isPending}>
            {t("staff.form.submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
