"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export function EntryStatusBadge({ status, scheduledAt, changed }: { status: string; scheduledAt?: string | null; changed?: boolean }) {
  const t = useTranslations("content");
  const tone = status === "published" ? "success" : status === "archived" ? "neutral" : "warning";
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge tone={tone}>{t.has(`statuses.${status}`) ? t(`statuses.${status}`) : status}</Badge>
      {scheduledAt ? <Badge tone="info">{t("scheduled")}</Badge> : null}
      {changed && status === "published" ? <Badge tone="warning">{t("unpublishedChanges")}</Badge> : null}
    </span>
  );
}

export function useKindLabel() {
  const t = useTranslations("content.kinds");
  return (kind: string) => (t.has(kind) ? t(kind) : kind);
}
