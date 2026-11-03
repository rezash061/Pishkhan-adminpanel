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

/** 0.05 → «۵» (percentage points, for the gap between two accuracies). */
export function formatPoints(value: number | null | undefined): string {
  if (value == null) return "—";
  return toPersianDigits((Math.round(value * 1000) / 10).toString()).replace(".", "٫");
}

function checkValue(check: EvalGateCheck, value: number | null, points: (n: string) => string): string {
  if (value == null) return "—";
  if (check.name === "cases") return formatNumber(value);
  if (check.name === "finglish_gap") return points(formatPoints(value));
  return formatPercent(value);
}

/** Checks where the run must stay at or under the limit. */
const AT_MOST = new Set(["error_rate", "finglish_gap"]);

/** The eval gate: each check with what it needs and what the run got. */
export function GateChecks({ run }: { run: EvalRun }) {
  const t = useTranslations("ai.gate");
  const points = (n: string) => t("points", { n });
  return (
    <ul className="flex flex-col gap-1 text-sm" aria-label={t("title")}>
      {run.gate.checks.map((c) => (
        <li key={c.name} className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={c.passed ? "success" : "danger"}>{c.passed ? t("ok") : t("notOk")}</Badge>
            <span>{t.has(`checks.${c.name}`) ? t(`checks.${c.name}`) : c.name}</span>
            {c.name === "completed" ? null : (
              <span className="text-muted-foreground">
                {t(AT_MOST.has(c.name) ? "atMost" : "atLeast", { required: checkValue(c, c.required, points), actual: checkValue(c, c.actual, points) })}
              </span>
            )}
          </span>
          {t.has(`explain.${c.name}`) ? <span className="text-xs text-muted-foreground">{t(`explain.${c.name}`)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Persian-script and Finglish intent accuracy side by side, with the number of Finglish cases (BE-2.3). «—» when a side
 * had no cases, or the backend does not report it yet.
 */
export function FinglishSplit({ run, compact }: { run: EvalRun; compact?: boolean }) {
  const t = useTranslations("ai.evals.finglish");
  const cases = run.finglishCaseCount;
  return (
    <span className={compact ? "flex flex-col gap-0.5 text-xs whitespace-nowrap" : "flex flex-wrap gap-x-4 gap-y-1"}>
      <span>
        <span className="text-muted-foreground">{t("script")}: </span>
        {formatPercent(run.scriptIntentAccuracy)}
      </span>
      <span>
        <span className="text-muted-foreground">{t("finglish")}: </span>
        {formatPercent(run.finglishIntentAccuracy)}
        <span className="text-muted-foreground"> ({cases == null ? "—" : t("cases", { n: formatNumber(cases) })})</span>
      </span>
    </span>
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
