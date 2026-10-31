"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export function UserStatusBadge({ status }: { status: string }) {
  const t = useTranslations("users.statuses");
  return <Badge tone={status === "active" ? "success" : "danger"}>{t.has(status) ? t(status) : status}</Badge>;
}

export function TotpBadge({ enabled }: { enabled: boolean }) {
  const t = useTranslations("users");
  return <Badge tone={enabled ? "info" : "neutral"}>{enabled ? t("totpOn") : t("totpOff")}</Badge>;
}
