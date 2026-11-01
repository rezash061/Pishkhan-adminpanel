"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { EvalGateCheck, EvalRun } from "@/lib/api/types";
import { formatNumber, toPersianDigits } from "@/lib/format";

/** Where a setting comes from: the back office (database) or the hosts' configuration. */
export function SourceBadge({ source }: { source: string }) {
  const t = useTranslations("ai.sources");
  return <Badge tone={source === "database" ? "info" : "neutral"}>{t.has(source) ? t(source) : source}</Badge>;
}

export function RunStatusBadge({ status }: { status: string }) {
  const t = useTranslations("ai.runStatuses");
  const tone = status === "completed" ? "success" : status === "failed" ? "danger" : "warning";
  return <Badge tone={tone}>{t.has(status) ? t(status) : status}</Badge>;
}

export function GateBadge({ run }: { run: EvalRun }) {
  const t = useTranslations("ai.gate");
  if (run.status !== "completed") return null;
  return <Badge tone={run.gate.passed ? "success" : "danger"}>{run.gate.passed ? t("passed") : t("failed")}</Badge>;
}

/** 0.873 → «۸۷٫۳٪». */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${toPersianDigits((Math.round(value * 1000) / 10).toString()).replace(".", "٫")}٪`;
}

function checkValue(check: EvalGateCheck, value: number | null): string {
  if (value == null) return "—";
  return check.name === "cases" ? formatNumber(value) : formatPercent(value);
}

/** The eval gate: each check with what it needs and what the run got. */
export function GateChecks({ run }: { run: EvalRun }) {
  const t = useTranslations("ai.gate");
  return (
    <ul className="flex flex-col gap-1 text-sm" aria-label={t("title")}>
      {run.gate.checks.map((c) => (
        <li key={c.name} className="flex flex-wrap items-center gap-2">
          <Badge tone={c.passed ? "success" : "danger"}>{c.passed ? t("ok") : t("notOk")}</Badge>
          <span>{t.has(`checks.${c.name}`) ? t(`checks.${c.name}`) : c.name}</span>
          {c.name === "completed" ? null : (
            <span className="text-muted-foreground">
              {t(c.name === "error_rate" ? "atMost" : "atLeast", { required: checkValue(c, c.required), actual: checkValue(c, c.actual) })}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The name of a gate check, for error messages such as `gate.intent_accuracy`. */
export function useGateCheckLabel() {
  const t = useTranslations("ai.gate.checks");
  return (name: string) => (t.has(name) ? t(name) : name);
}

export function useTaskLabel() {
  const t = useTranslations("ai.tasks");
  return (task: string) => (t.has(task) ? t(task) : task);
}
