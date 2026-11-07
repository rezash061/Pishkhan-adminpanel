"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { RecoveryCodesList } from "@/components/console/recovery-codes";
import { useStaff } from "@/components/console/staff-context";
import { StepUpCancelled, useStepUp } from "@/components/console/step-up";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { admin } from "@/lib/api/client";
import { toPersianDigits } from "@/lib/format";
import { useErrorMessage } from "@/lib/use-error-message";

/** How many recovery codes are left, and «کدهای تازه» (step-up) which replaces all of them. */
export function RecoveryCodesCard() {
  const t = useTranslations("recoveryCodes");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const withStepUp = useStepUp();
  const queryClient = useQueryClient();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: () => admin<{ recoveryCodesLeft?: number }>("/me") });
  const regenerate = useMutation({
    mutationFn: () => withStepUp(() => admin<{ codes: string[] }>("/me/recovery-codes", { method: "POST", body: {} })),
    onSuccess: (r) => {
      setCodes(r.codes);
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const left = me.data?.recoveryCodesLeft ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4">
        {me.data ? (
          <p className="text-sm" data-testid="recovery-codes-left">
            {t("left", { count: left, n: toPersianDigits(left) })}
          </p>
        ) : null}
        {me.data && left <= 2 && !codes ? <Alert tone="warning">{t("lowWarning")}</Alert> : null}
        {regenerate.error && !(regenerate.error instanceof StepUpCancelled) ? <Alert tone="danger">{errorMessage(regenerate.error)}</Alert> : null}
        {codes ? (
          <div className="flex w-full flex-col gap-3">
            <Alert tone="success">{t("replaced")}</Alert>
            <RecoveryCodesList codes={codes} username={staff.username} />
          </div>
        ) : confirming ? (
          <div className="flex flex-col gap-3">
            <Alert tone="warning">{t("confirm")}</Alert>
            <div className="flex gap-2">
              <Button variant="danger" size="sm" disabled={regenerate.isPending} onClick={() => regenerate.mutate()}>
                {t("regenerate")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            {t("regenerate")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
