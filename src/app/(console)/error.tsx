"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPages");
  const tc = useTranslations("common");
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
      <h1 className="text-xl font-bold">{t("errorTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("errorBody")}</p>
      {error.digest ? <p className="ltr text-xs text-muted-foreground">{t("errorId", { id: error.digest })}</p> : null}
      <Button onClick={reset}>{tc("retry")}</Button>
    </div>
  );
}
