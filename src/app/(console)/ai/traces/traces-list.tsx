"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Pager } from "@/components/ui/pager";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import { TRACE_OUTCOMES, type AdminTraceStats, type AdminTraceSummary, type PagedResult } from "@/lib/api/types";
import { formatJalaliDateTime, formatNumber, formatRelative, formatToman, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

const PAGE_SIZE = 25;
/** "Low confidence" filter: answers the model was less than half sure of. */
export const LOW_CONFIDENCE = 0.5;
export const OUTCOME_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { sent: "success", handed_off: "warning", failed: "danger" };

/** A 0..1 confidence as a Persian decimal with two places, e.g. ۰٫۸۶. */
export function confidence(value: number | null): string {
  return value === null ? "—" : toPersianDigits(value.toFixed(2)).replace(".", "٫");
}

/** AI traces across workspaces (admin plan 4.5): filters in the URL, no customer content in the list. */
export function TracesList() {
  const t = useTranslations("traces");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const outcome = TRACE_OUTCOMES.find((o) => o === params.get("outcome")) ?? "";
  const workspaceId = params.get("workspaceId") ?? "";
  const low = params.get("low") === "1";
  const guard = params.get("guard") === "1";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [workspaceInput, setWorkspaceInput] = useState(workspaceId);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (outcome) query.set("outcome", outcome);
  if (workspaceId) query.set("workspaceId", workspaceId);
  if (low) query.set("maxConfidence", String(LOW_CONFIDENCE));
  if (guard) query.set("guardIssues", "true");

  const list = useQuery({
    queryKey: ["ai-traces", query.toString()],
    queryFn: () => admin<PagedResult<AdminTraceSummary>>(`/ai/traces?${query}`),
    placeholderData: keepPreviousData,
  });
  const stats = useQuery({ queryKey: ["ai-trace-stats"], queryFn: () => admin<AdminTraceStats>("/ai/traces/stats") });

  const navigate = (next: { outcome?: string; workspaceId?: string; low?: boolean; guard?: boolean; page?: number }) => {
    const m = { outcome, workspaceId, low, guard, page: 1, ...next };
    const q = new URLSearchParams();
    if (m.outcome) q.set("outcome", m.outcome);
    if (m.workspaceId) q.set("workspaceId", m.workspaceId);
    if (m.low) q.set("low", "1");
    if (m.guard) q.set("guard", "1");
    if (m.page > 1) q.set("page", String(m.page));
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  if (list.error instanceof ApiError && list.error.status === 404) return <Alert tone="warning">{t("notAvailable")}</Alert>;

  return (
    <div className="flex flex-col gap-4">
      {stats.data ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="trace-stats">
          {[
            [t("stats.total"), formatNumber(stats.data.total)],
            [t("stats.lowConfidence"), formatNumber(stats.data.lowConfidence)],
            [t("stats.guard"), formatNumber(stats.data.withGuardIssues)],
            [t("stats.cost"), formatToman(stats.data.costIrr)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-border bg-surface p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="font-semibold">{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ workspaceId: workspaceInput.trim() });
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("filters.outcome")}
          <select value={outcome} onChange={(e) => navigate({ outcome: e.target.value })} className="h-10 min-w-40 rounded-md border border-border bg-surface px-2 text-sm font-normal">
            <option value="">{t("filters.all")}</option>
            {TRACE_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {t(`outcomes.${o}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("filters.workspaceId")}
          <Input value={workspaceInput} onChange={(e) => setWorkspaceInput(e.target.value)} dir="ltr" className="w-80 font-mono text-xs" />
        </label>
        <Button type="submit" variant="secondary">
          {t("filters.apply")}
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={low} onChange={(e) => navigate({ low: e.target.checked })} />
          {t("filters.lowConfidence")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={guard} onChange={(e) => navigate({ guard: e.target.checked })} />
          {t("filters.guardIssues")}
        </label>
      </form>

      {list.error ? <Alert tone="danger">{errorMessage(list.error)}</Alert> : null}
      {list.isPending && !list.error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}

      {list.data ? (
        <Card className={list.isFetching ? "opacity-70" : undefined}>
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.time")}</Th>
                <Th>{t("columns.outcome")}</Th>
                <Th>{t("columns.intent")}</Th>
                <Th>{t("columns.confidence")}</Th>
                <Th>{t("columns.issues")}</Th>
                <Th>{t("columns.model")}</Th>
                <Th>{t("columns.latency")}</Th>
                <Th>{t("columns.workspace")}</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </Td>
                </tr>
              ) : null}
              {list.data.items.map((r) => (
                <tr key={r.id} data-testid={`trace-${r.id}`}>
                  <Td className="whitespace-nowrap" title={formatJalaliDateTime(r.createdAt)}>
                    <Link href={`/ai/traces/${r.id}`} className="text-primary hover:underline">
                      {formatRelative(r.createdAt)}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={OUTCOME_TONE[r.outcome] ?? "neutral"}>{t.has(`outcomes.${r.outcome}`) ? t(`outcomes.${r.outcome}`) : r.outcome}</Badge>
                    {r.handoffReason ? (
                      <div className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">
                        {r.handoffReason}
                      </div>
                    ) : null}
                  </Td>
                  <Td className="font-mono text-xs" dir="ltr">
                    {r.intent ?? "—"}
                  </Td>
                  <Td className={r.confidence !== null && r.confidence < r.threshold ? "text-warning-foreground" : undefined}>
                    {t("confidencePair", { c: confidence(r.confidence), t: confidence(r.threshold) })}
                  </Td>
                  <Td className={r.guardIssueCount ? "text-danger-foreground" : undefined}>{t("issuesPair", { g: toPersianDigits(r.guardIssueCount), c: toPersianDigits(r.toolCallCount) })}</Td>
                  <Td className="max-w-48 truncate font-mono text-xs" dir="ltr" title={r.models ?? undefined}>
                    {r.models ?? "—"}
                  </Td>
                  <Td className="whitespace-nowrap">{t("ms", { n: formatNumber(r.latencyMs) })}</Td>
                  <Td className="font-mono text-xs" dir="ltr">
                    <Link href={`/workspaces/${r.workspaceId}`} className="hover:underline" title={r.workspaceId}>
                      {r.workspaceId.slice(-8)}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} pageSize={PAGE_SIZE} totalCount={list.data.totalCount} onPage={(p) => navigate({ page: p })} />
        </Card>
      ) : null}
    </div>
  );
}
