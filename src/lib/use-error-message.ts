"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { ApiError } from "@/lib/problem";

/** Turns an ApiError (backend problem code) or a network failure into a Persian message. */
export function useErrorMessage() {
  const t = useTranslations("errors");
  return useCallback(
    (error: unknown): string => {
      if (error instanceof ApiError) {
        const code = error.code;
        if (code && t.has(code)) return t(code);
        if (error.status === 429) return t("rate_limited");
        if (error.status === 403) return t("auth.forbidden");
        return t("unknown");
      }
      if (error instanceof TypeError) return t("network");
      return t("unknown");
    },
    [t],
  );
}

/** Translates field error keys such as `validation.password.too_short`. */
export function useFieldError() {
  const t = useTranslations("errors");
  return useCallback((codes: string[] | undefined): string | undefined => {
    const code = codes?.[0];
    if (!code) return undefined;
    return t.has(code) ? t(code) : t("validation.failed");
  }, [t]);
}
