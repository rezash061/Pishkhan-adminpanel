"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Ten one-time recovery codes (admin plan AD-0.2): shown once, with copy and download, for when the authenticator is lost. */
export function RecoveryCodesList({ codes, username }: { codes: string[]; username: string }) {
  const t = useTranslations("recoveryCodes");
  const [copied, setCopied] = useState(false);
  const text = `${t("fileTitle", { username })}\n\n${codes.join("\n")}\n`;

  return (
    <div className="flex flex-col gap-3">
      <ol data-testid="recovery-codes" className="ltr grid grid-cols-2 gap-2 rounded-md bg-muted p-3 font-mono text-sm" aria-label={t("listLabel")}>
        {codes.map((c) => (
          <li key={c} className="text-center select-all">
            {c}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            void navigator.clipboard?.writeText(text).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          {copied ? t("copied") : t("copy")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `pishkhan-admin-recovery-${username}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          {t("download")}
        </Button>
      </div>
    </div>
  );
}
