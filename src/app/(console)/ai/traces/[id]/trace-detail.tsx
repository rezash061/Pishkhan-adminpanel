"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { ReasonDialog } from "@/components/console/reason-dialog";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { admin } from "@/lib/api/client";
import type { AdminTraceDetail } from "@/lib/api/types";
import { formatJalaliDateTime, formatNumber, formatToman, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { confidence, OUTCOME_TONE } from "../traces-list";

/** One trace, redacted; "show content" (with a reason, audited in the workspace's log) swaps in the revealed copy. */
export function TraceDetailView({ id }: { id: string }) {
  const t = useTranslations("traces");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState<AdminTraceDetail | null>(null);
  const { data, error, isPending } = useQuery({ queryKey: ["ai-trace", id], queryFn: () => admin<AdminTraceDetail>(`/ai/traces/${encodeURIComponent(id)}`) });

  const back = (
    <Link href="/ai/traces" className="text-sm text-primary hover:underline">
      {t("detail.back")}
    </Link>
  );
  if (isPending && !error) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (error instanceof ApiError && error.status === 404) {
    return (
      <>
        <PageHeader title={t("detail.title")} actions={back} />
        <Alert tone="warning">{t("detail.notFound")}</Alert>
      </>
    );
  }
  if (error || !data) return <Alert tone="danger">{errorMessage(error)}</Alert>;

  const d = revealed ?? data;
  const s = d.trace;
  const hidden = <span className="text-muted-foreground">{t("detail.hidden")}</span>;
  const row = (label: string, value: ReactNode, ltr = false) => (
    <div className="grid grid-cols-[10rem_1fr] gap-2 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={ltr ? "break-all font-mono text-xs" : "whitespace-pre-wrap"} dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );

  return (
    <>
      <PageHeader
        title={t("detail.title")}
        description={formatJalaliDateTime(s.createdAt)}
        actions={
          <div className="flex items-center gap-3">
            {d.redacted && staff.can("ai.traces.reveal") ? <Button onClick={() => setRevealing(true)}>{t("detail.reveal")}</Button> : null}
            {back}
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.summary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              {row(t("columns.outcome"), <Badge tone={OUTCOME_TONE[s.outcome] ?? "neutral"}>{t.has(`outcomes.${s.outcome}`) ? t(`outcomes.${s.outcome}`) : s.outcome}</Badge>)}
              {s.handoffReason ? row(t("detail.handoffReason"), s.handoffReason, true) : null}
              {row(t("columns.intent"), s.intent ?? "—", true)}
              {row(t("columns.confidence"), t("confidencePair", { c: confidence(s.confidence), t: confidence(s.threshold) }))}
              {row(t("detail.classifier"), confidence(d.classifierConfidence))}
              {row(t("detail.self"), confidence(d.selfConfidence))}
              {row(t("detail.sentiment"), d.sentiment ?? "—", true)}
              {row(t("columns.workspace"), <Link href={`/workspaces/${s.workspaceId}`} className="text-primary hover:underline">{s.workspaceId}</Link>, true)}
              {row(t("detail.conversation"), s.conversationId, true)}
              {row(t("detail.prompts"), s.prompts ?? "—", true)}
              {row(t("detail.models"), s.models ?? "—", true)}
              {row(t("detail.tokens"), `${formatNumber(s.inputTokens)} / ${formatNumber(s.outputTokens)}`)}
              {row(t("detail.cost"), formatToman(s.costIrr))}
              {row(t("columns.latency"), t("ms", { n: formatNumber(s.latencyMs) }))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.content")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {d.redacted ? <Alert tone="info">{t("detail.redacted")}</Alert> : null}
            <dl data-testid="trace-content">
              {d.goal || d.redacted ? row(t("detail.goal"), d.redacted ? hidden : d.goal) : null}
              {row(t("detail.input"), d.redacted ? hidden : d.input)}
              {row(t("detail.reply"), d.redacted ? hidden : (d.reply ?? "—"))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.facts")}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.facts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("detail.noFacts")}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {d.facts.map((f) => (
                  <li key={f.chunkId} className="flex justify-between gap-2">
                    <span>{f.title}</span>
                    <span className="text-muted-foreground">{confidence(f.score)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.tools")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {d.toolCalls.length === 0 ? <p className="text-sm text-muted-foreground">{t("detail.noTools")}</p> : null}
            {d.toolCalls.map((c, i) => (
              <dl key={`${c.name}-${i}`} className="rounded-md border border-border px-3">
                {row("", c.name, true)}
                {row(t("detail.arguments"), c.arguments ?? hidden, c.arguments !== null)}
                {row(t("detail.result"), c.result ?? hidden, c.result !== null)}
                {c.error ? row(t("detail.error"), c.error, true) : null}
              </dl>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("detail.guard")}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.guardIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("detail.noGuard")}</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {d.guardIssues.map((g, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <Badge tone="danger">{g.kind}</Badge>
                    <span className="text-muted-foreground">{t("detail.attempt", { n: toPersianDigits(g.attempt) })}</span>
                    <span>{d.redacted ? hidden : g.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <ReasonDialog<AdminTraceDetail>
        open={revealing}
        title={t("detail.revealTitle")}
        description={t("detail.revealBody")}
        confirmLabel={t("detail.reveal")}
        tone="primary"
        onSubmit={(reason) => admin<AdminTraceDetail>(`/ai/traces/${encodeURIComponent(id)}/reveal`, { method: "POST", body: { reason } })}
        onDone={(result) => {
          setRevealed(result);
          setRevealing(false);
        }}
        onClose={() => setRevealing(false)}
      />
    </>
  );
}
