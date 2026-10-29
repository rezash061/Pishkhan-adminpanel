"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { request } from "@/lib/api/client";
import { toLatinDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { TotpEnrollment, type Enrollment } from "./totp-enrollment";

interface LoginValues {
  username: string;
  password: string;
  totpCode: string;
}

type LoginResult = { status: "ok" } | ({ status: "totp_enrollment_required" } & Enrollment);

export function LoginForm({ next, reason }: { next: string; reason: "expired" | "idle" | "loggedOut" | null }) {
  const t = useTranslations("login");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const { register, handleSubmit, formState, setFocus } = useForm<LoginValues>({ defaultValues: { username: "", password: "", totpCode: "" } });

  const finish = () => window.location.assign(next);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await request<LoginResult>("/api/auth/login", {
        method: "POST",
        body: { username: values.username.trim(), password: values.password, totpCode: toLatinDigits(values.totpCode.trim()) },
      });
      if (result.status === "ok") finish();
      else setEnrollment(result);
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.code?.startsWith("auth.totp")) setFocus("totpCode");
    }
  });

  if (enrollment) return <TotpEnrollment enrollment={enrollment} onDone={finish} onCancel={() => setEnrollment(null)} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {reason && !error ? <Alert tone={reason === "loggedOut" ? "success" : "warning"}>{t(reason)}</Alert> : null}
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label={t("username")} error={formState.errors.username ? te("validation.required") : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                dir="ltr"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...register("username", { required: true })}
              />
            )}
          </Field>
          <Field label={t("password")} error={formState.errors.password ? te("validation.required") : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} type="password" dir="ltr" autoComplete="current-password" aria-describedby={describedBy} aria-invalid={invalid} {...register("password", { required: true })} />
            )}
          </Field>
          <Field label={t("totp")} hint={t("totpHint")}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="tracking-[0.4em]"
                aria-describedby={describedBy}
                {...register("totpCode")}
              />
            )}
          </Field>
          <Button type="submit" disabled={formState.isSubmitting} className="mt-2">
            {formState.isSubmitting ? t("submitting") : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
