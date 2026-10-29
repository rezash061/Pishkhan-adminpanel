"use client";

import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { request } from "@/lib/api/client";
import { toLatinDigits } from "@/lib/format";
import { useErrorMessage } from "@/lib/use-error-message";

export interface Enrollment {
  totpSecret: string;
  otpAuthUri: string;
}

/** First sign-in: the backend issued a TOTP secret; show it once and confirm a code to start the session. */
export function TotpEnrollment({ enrollment, onDone, onCancel }: { enrollment: Enrollment; onDone: () => void; onCancel: () => void }) {
  const t = useTranslations("enroll");
  const errorMessage = useErrorMessage();
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<{ code: string }>({ defaultValues: { code: "" } });

  useEffect(() => {
    // Rendered locally: the secret never leaves the browser for a third-party QR service.
    QRCode.toDataURL(enrollment.otpAuthUri, { margin: 1, width: 192 }).then(setQr, () => setQr(null));
  }, [enrollment.otpAuthUri]);

  const onSubmit = handleSubmit(async ({ code }) => {
    setError(null);
    try {
      await request("/api/auth/totp-enroll", { method: "POST", body: { code: toLatinDigits(code.trim()) } });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  const grouped = enrollment.totpSecret.replace(/(.{4})/g, "$1 ").trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">{t("intro")}</p>
        <div className="flex justify-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL generated in the browser
            <img src={qr} alt={t("qrAlt")} width={192} height={192} className="rounded-md border border-border bg-white" />
          ) : (
            <div className="size-48 animate-pulse rounded-md bg-muted" aria-hidden />
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t("manual")}</p>
          <code data-testid="totp-secret" className="ltr mt-1 block rounded-md bg-muted px-3 py-2 text-center font-mono text-sm break-all select-all">
            {grouped}
          </code>
        </div>
        <Alert tone="warning">{t("secretWarning")}</Alert>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label={t("code")}>
            {({ id }) => (
              <Input id={id} dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="tracking-[0.4em]" {...register("code", { required: true })} />
            )}
          </Field>
          <Button type="submit" disabled={formState.isSubmitting}>
            {t("submit")}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            {t("back")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
