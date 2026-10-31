"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { EvalRunDetail } from "@/lib/api/types";
import { formatJalaliDateTime, formatNumber, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { formatPercent, GateBadge, GateChecks, RunStatusBadge } from "../../../ai-shared";

/** One eval run: totals, the gate and every case, failures first. Polls while the run is going. */
export function EvalRunView({ runId }: { runId: string }) {
  const t = useTranslations("ai.evals");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { data, error, isPending } = useQuery({
    queryKey: ["ai-eval-run", runId],
    queryFn: () => admin<EvalRunDetail>(`/ai/eval-runs/${runId}`),
    refetchInterval: (q) => (q.state.data?.run.status === "running" ? 2000 : false),
  });
  const run = data?.run;

  return (
    <>
      <Link href="/ai/evals" className="mb-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowRight className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <PageHeader title={t("runTitle")} description={run ? t("runDescription", { set: run.setName }) : undefined} />
      {error instanceof ApiError && error.status === 404 ? <Alert tone="warning">{t("runNotFound")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      {isPending && !error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}
      {run && data ? (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center gap-2">
              <CardTitle>{t("summary")}</CardTitle>
              <RunStatusBadge status={run.status} />
              <GateBadge run={run} />
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm" data-testid="run-summary">
                <dt className="text-muted-foreground">{t("columns.prompt")}</dt>
                <dd>
                  <Link href={`/ai/prompts/${encodeURIComponent(run.promptKey)}`} dir="ltr" className="font-mono text-xs text-primary hover:underline">
                    {run.promptKey}
                  </Link>{" "}
                  {t("versionShort", { v: toPersianDigits(run.promptVersion) })}
                </dd>
                <dt className="text-muted-foreground">{t("columns.accuracy")}</dt>
                <dd>{formatPercent(run.intentAccuracy)}</dd>
                <dt className="text-muted-foreground">{t("columns.cases")}</dt>
                <dd>{t("casesErrors", { cases: formatNumber(run.caseCount), errors: formatNumber(run.errorCount) })}</dd>
                <dt className="text-muted-foreground">{t("tokens")}</dt>
                <dd>{t("tokensPair", { input: formatNumber(run.inputTokens), output: formatNumber(run.outputTokens) })}</dd>
                <dt className="text-muted-foreground">{t("columns.route")}</dt>
                <dd>
                  <span dir="ltr" className="font-mono text-xs">
                    {run.route ?? "—"}
                  </span>
                </dd>
                <dt className="text-muted-foreground">{t("columns.startedAt")}</dt>
                <dd>{formatJalaliDateTime(run.startedAt)}</dd>
                <dt className="text-muted-foreground">{t("finishedAt")}</dt>
                <dd>{run.finishedAt ? formatJalaliDateTime(run.finishedAt) : "—"}</dd>
              </dl>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t("gate")}</h3>
                {run.status === "completed" ? <GateChecks run={run} /> : <p className="text-sm text-muted-foreground">{run.status === "running" ? t("stillRunning") : t("runFailed")}</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("results", { n: formatNumber(data.results.length) })}</CardTitle>
            </CardHeader>
            <Table>
              <thead>
                <tr>
                  <Th>{t("columns.ref")}</Th>
                  <Th>{t("columns.input")}</Th>
                  <Th>{t("columns.expected")}</Th>
                  <Th>{t("columns.predicted")}</Th>
                  <Th>{t("columns.outcome")}</Th>
                  <Th>{t("columns.latency")}</Th>
                </tr>
              </thead>
              <tbody>
                {data.results.length === 0 ? (
                  <tr>
                    <Td colSpan={6} className="py-6 text-center text-muted-foreground">
                      {t("noResults")}
                    </Td>
                  </tr>
                ) : null}
                {data.results.map((r) => (
                  <tr key={r.caseId}>
                    <Td>
                      <span dir="ltr" className="font-mono text-xs">
                        {r.ref}
                      </span>
                      {r.vertical ? <div className="text-xs text-muted-foreground">{r.vertical}</div> : null}
                    </Td>
                    <Td className="max-w-md">
                      <span dir="auto">{r.input}</span>
                    </Td>
                    <Td>
                      <span dir="ltr" className="font-mono text-xs">
                        {r.expectedIntent ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <span dir="ltr" className="font-mono text-xs">
                        {r.predictedIntent ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      {r.error ? (
                        <div className="flex flex-col gap-1">
                          <Badge tone="danger">{t("outcomes.error")}</Badge>
                          <span dir="auto" className="text-xs break-all text-danger-foreground">
                            {r.error}
                          </span>
                        </div>
                      ) : r.correct === true ? (
                        <Badge tone="success">{t("outcomes.correct")}</Badge>
                      ) : r.correct === false ? (
                        <Badge tone="danger">{t("outcomes.wrong")}</Badge>
                      ) : (
                        <Badge>{t("outcomes.unscored")}</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{t("ms", { n: formatNumber(r.latencyMs) })}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      ) : null}
    </>
  );
}
