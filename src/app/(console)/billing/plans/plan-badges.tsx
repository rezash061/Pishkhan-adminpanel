"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export function PlanStatusBadge({ status }: { status: string }) {
  const t = useTranslations("plans.statuses");
  const tone = status === "published" ? "success" : status === "draft" ? "warning" : "neutral";
  return <Badge tone={tone}>{t.has(status) ? t(status) : status}</Badge>;
}
