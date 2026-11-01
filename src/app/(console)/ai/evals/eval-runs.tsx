"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { EvalRun, EvalSet, PagedResult } from "@/lib/api/types";
import { formatJalaliDateTime, formatNumber, toPersianDigits } from "@/lib/format";
import { useErrorMessage } from "@/lib/use-error-message";
import { formatPercent, GateBadge, RunStatusBadge } from "../ai-shared";

const PAGE_SIZE = 20;

/** Eval runs, newest first, filtered by set in the URL. Refreshes while a run is still going. */
export function EvalRunsTable() {
  const t = useTranslations("ai.evals");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const setId = params.get("setId") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);

  const sets = useQuery({ queryKey: ["ai-eval-sets"], queryFn: () => admin<EvalSet[]>("/ai/eval-sets") });
  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), ...(setId ? { setId } : {}) });
  const { data, error, isPending } = useQuery({
    queryKey: ["ai-eval-runs", setId, page],
    queryFn: () => admin<PagedResult<EvalRun>>(`/ai/eval-runs?${query}`),
    refetchInterval: (q) => (q.state.data?.items.some((r) => r.status === "running") ? 3000 : false),
  });

  const go = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`);
  };
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{t("runs")}</CardTitle>
        <label className="flex items-center gap-2 text-sm">
          <span>{t("filterSet")}</span>
          <select value={setId} onChange={(e) => go({ setId: e.target.value, page: "" })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
            <option value="">{t("allSets")}</option>
            {(sets.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </CardHeader>
      {error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      <Table>
        <thead>
          <tr>
            <Th>{t("columns.startedAt")}</Th>
            <Th>{t("columns.prompt")}</Th>
            <Th>{t("columns.set")}</Th>
            <Th>{t("columns.status")}</Th>
            <Th>{t("columns.accuracy")}</Th>
            <Th>{t("columns.cases")}</Th>
            <Th>{t("columns.errors")}</Th>
            <Th>{t("columns.route")}</Th>
          </tr>
        </thead>
        <tbody>
          {isPending && !error ? (
            <tr>
              <Td colSpan={8} className="py-6 text-center text-muted-foreground">
                {tc("loading")}
              </Td>
            </tr>
          ) : null}
          {data && data.items.length === 0 ? (
            <tr>
              <Td colSpan={8} className="py-6 text-center text-muted-foreground">
                {t("noRuns")}
              </Td>
            </tr>
          ) : null}
          {(data?.items ?? []).map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap">
                <Link href={`/ai/evals/runs/${r.id}`} className="text-primary hover:underline">
                  {formatJalaliDateTime(r.startedAt)}
                </Link>
              </Td>
              <Td>
                <span dir="ltr" className="font-mono text-xs">
                  {r.promptKey}
                </span>{" "}
                {t("versionShort", { v: toPersianDigits(r.promptVersion) })}
              </Td>
              <Td>
                <span dir="ltr" className="font-mono text-xs">
                  {r.setName}
                </span>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <RunStatusBadge status={r.status} />
                  <GateBadge run={r} />
                </div>
              </Td>
              <Td>{formatPercent(r.intentAccuracy)}</Td>
              <Td>{formatNumber(r.caseCount)}</Td>
              <Td>{formatNumber(r.errorCount)}</Td>
              <Td>
                <span dir="ltr" className="font-mono text-xs">
                  {r.route ?? "—"}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {data && pages > 1 ? (
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
          <span>{tc("pageOf", { page: toPersianDigits(page), pages: toPersianDigits(pages) })}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>
              {tc("previous")}
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => go({ page: String(page + 1) })}>
              {tc("next")}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
