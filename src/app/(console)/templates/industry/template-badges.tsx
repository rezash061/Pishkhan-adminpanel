"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export function TemplateStatusBadge({ status }: { status: string }) {
  const t = useTranslations("templates.statuses");
  const tone = status === "published" ? "success" : status === "draft" ? "warning" : "neutral";
  return <Badge tone={tone}>{t.has(status) ? t(status) : status}</Badge>;
}

export function useIndustryLabel() {
  const t = useTranslations("templates.industries");
  return (industry: string) => (t.has(industry) ? t(industry) : industry);
}
