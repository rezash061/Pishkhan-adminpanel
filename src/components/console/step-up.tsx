"use client";

import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { request } from "@/lib/api/client";
import { toLatinDigits } from "@/lib/format";
import { isStepUpRequired } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

export class StepUpCancelled extends Error {
  constructor() {
    super("step-up cancelled");
    this.name = "StepUpCancelled";
  }
}

type Run = <T>(action: () => Promise<T>) => Promise<T>;

const StepUpContext = createContext<Run | null>(null);

/**
 * Dangerous actions (admin plan 2.2): when the AdminApi answers 403 `auth.step_up.required`, ask for the
 * password and TOTP again, obtain a 5-minute step-up token (kept in an HttpOnly cookie) and retry once.
 */
export function StepUpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pending = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);

  const askForStepUp = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        pending.current = { resolve, reject };
        setOpen(true);
      }),
    [],
  );

  const run = useCallback<Run>(
    async (action) => {
      try {
        return await action();
      } catch (error) {
        if (!isStepUpRequired(error)) throw error;
        await askForStepUp();
        return action();
      }
    },
    [askForStepUp],
  );

  const close = (ok: boolean) => {
    setOpen(false);
    const p = pending.current;
    pending.current = null;
    if (ok) p?.resolve();
    else p?.reject(new StepUpCancelled());
  };

  return (
    <StepUpContext.Provider value={run}>
      {children}
      <StepUpDialog open={open} onDone={() => close(true)} onCancel={() => close(false)} />
    </StepUpContext.Provider>
  );
}

/** Wrap a mutation: `const withStepUp = useStepUp(); await withStepUp(() => admin(...))`. */
export function useStepUp(): Run {
  const run = useContext(StepUpContext);
  if (!run) throw new Error("useStepUp must be used inside StepUpProvider");
  return run;
}

function StepUpDialog({ open, onDone, onCancel }: { open: boolean; onDone: () => void; onCancel: () => void }) {
  const t = useTranslations("stepUp");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<{ password: string; totpCode: string }>({
    defaultValues: { password: "", totpCode: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await request("/api/auth/step-up", { method: "POST", body: { password: values.password, totpCode: toLatinDigits(values.totpCode.trim()) } });
      reset();
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          setError(null);
          onCancel();
        }
      }}
    >
      <DialogContent title={t("title")} description={t("body")} closeLabel={tc("close")}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label={t("password")}>
            {({ id }) => <Input id={id} type="password" dir="ltr" autoComplete="current-password" autoFocus {...register("password", { required: true })} />}
          </Field>
          <Field label={t("totp")}>
            {({ id }) => (
              <Input id={id} dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="tracking-[0.4em]" {...register("totpCode", { required: true })} />
            )}
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={formState.isSubmitting}>
              {t("submit")}
            </Button>
            <Button variant="secondary" onClick={() => { reset(); setError(null); onCancel(); }}>
              {tc("cancel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
