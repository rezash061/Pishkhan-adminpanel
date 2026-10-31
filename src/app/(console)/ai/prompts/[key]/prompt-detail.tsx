"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { admin } from "@/lib/api/client";
import { EVAL_PROMPT_KEY, type PromptVersion } from "@/lib/api/types";
import { formatJalaliDateTime, formatNumber, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { formatPercent, GateBadge, GateChecks, RunStatusBadge, SourceBadge } from "../../ai-shared";
import { lineDiff } from "../line-diff";
import { ActivateDialog, NewVersionForm, StartRunDialog } from "./prompt-actions";

/** Every version of a prompt with its latest eval run; AIOps writes versions, runs evals and activates through the gate. */
export function PromptDetail({ promptKey }: { promptKey: string }) {
  const t = useTranslations("ai.prompts");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const canManage = staff.can("ai.manage");
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "diff" | "new">("view");
  const [dialog, setDialog] = useState<"run" | "activate" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, error, isPending } = useQuery({
    queryKey: ["ai-prompt", promptKey],
    queryFn: () => admin<PromptVersion[]>(`/ai/prompts/${encodeURIComponent(promptKey)}`),
    refetchInterval: (q) => (q.state.data?.some((v) => v.latestRun?.status === "running") ? 3000 : false),
  });

  const versions = data ?? [];
  const active = versions.find((v) => v.active);
  const version = versions.find((v) => v.version === selected) ?? active ?? versions[0];
  const base = version?.baseVersion ? versions.find((v) => v.version === version.baseVersion) : undefined;
  const run = version?.latestRun ?? null;
  const evaluable = promptKey === EVAL_PROMPT_KEY;
  const vShort = (v: string) => t("versionShort", { v: toPersianDigits(v) });

  const pick = (v: string) => {
    setSelected(v);
    setMode("view");
    setNotice(null);
  };

  return (
    <>
      <Link href="/ai/prompts" className="mb-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowRight className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <div className="mb-6">
        <h1 className="text-xl font-bold">
          <span dir="ltr" className="font-mono">
            {promptKey}
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{active ? t("activeIs", { v: toPersianDigits(active.version) }) : t("detailDescription")}</p>
      </div>
      {error instanceof ApiError && error.status === 404 ? <Alert tone="warning">{t("notFound")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      {isPending && !error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}
      {notice ? (
        <Alert tone="success" className="mb-4">
          {notice}
        </Alert>
      ) : null}
      {version ? (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <Card className="self-start">
            <CardHeader>
              <CardTitle>{t("versions")}</CardTitle>
            </CardHeader>
            <ul className="flex flex-col p-2" aria-label={t("versions")}>
              {versions.map((v) => (
                <li key={v.version}>
                  <button
                    type="button"
                    onClick={() => pick(v.version)}
                    aria-current={v.version === version.version ? "true" : undefined}
                    className="flex w-full flex-wrap items-center gap-2 rounded-md px-3 py-2 text-start text-sm hover:bg-muted aria-[current=true]:bg-primary/10"
                  >
                    <span className="font-medium">{vShort(v.version)}</span>
                    {v.active ? <Badge tone="success">{t("active")}</Badge> : null}
                    {v.latestRun ? <GateBadge run={v.latestRun} /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{vShort(version.version)}</CardTitle>
                  {version.active ? <Badge tone="success">{t("active")}</Badge> : null}
                  <SourceBadge source={version.source} />
                  {version.baseVersion ? <span className="text-xs text-muted-foreground">{t("basedOn", { v: toPersianDigits(version.baseVersion) })}</span> : null}
                  {version.createdAt ? <span className="text-xs text-muted-foreground">{formatJalaliDateTime(version.createdAt)}</span> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {base ? (
                    <Button size="sm" variant="secondary" onClick={() => setMode(mode === "diff" ? "view" : "diff")}>
                      {mode === "diff" ? t("showText") : t("compare")}
                    </Button>
                  ) : null}
                  {canManage ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setMode("new")}>
                        {t("newVersion")}
                      </Button>
                      {evaluable ? (
                        <Button size="sm" variant="secondary" onClick={() => setDialog("run")}>
                          {t("runEval")}
                        </Button>
                      ) : null}
                      {!version.active ? (
                        <Button size="sm" disabled={!run || run.status !== "completed"} onClick={() => setDialog("activate")}>
                          {t("activate")}
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                {mode === "new" ? (
                  <NewVersionForm
                    promptKey={promptKey}
                    base={version}
                    onCancel={() => setMode("view")}
                    onCreated={(created) => {
                      pick(created.version);
                      setNotice(t("created", { v: toPersianDigits(created.version) }));
                    }}
                  />
                ) : mode === "diff" && base ? (
                  <div className="overflow-x-auto rounded-md border border-border font-mono text-xs" aria-label={t("diffLabel", { from: toPersianDigits(base.version), to: toPersianDigits(version.version) })} role="region">
                    {lineDiff(base.text, version.text).map((line, i) => (
                      <div
                        key={i}
                        dir="auto"
                        className={line.kind === "added" ? "bg-success/15 px-3 whitespace-pre-wrap" : line.kind === "removed" ? "bg-danger/15 px-3 whitespace-pre-wrap line-through" : "px-3 whitespace-pre-wrap"}
                      >
                        <span aria-hidden className="me-2 select-none text-muted-foreground">
                          {line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}
                        </span>
                        <span className="sr-only">{line.kind === "added" ? t("diffAdded") : line.kind === "removed" ? t("diffRemoved") : ""}</span>
                        {line.text || " "}
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre dir="auto" data-testid="prompt-text" className="max-h-[32rem] overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
                    {version.text}
                  </pre>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("latestRun")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {run ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <RunStatusBadge status={run.status} />
                      <GateBadge run={run} />
                      <span>{t("runSummary", { set: run.setName, cases: formatNumber(run.caseCount), accuracy: formatPercent(run.intentAccuracy), errors: formatNumber(run.errorCount) })}</span>
                      <Link href={`/ai/evals/runs/${run.id}`} className="text-primary hover:underline">
                        {t("openRun")}
                      </Link>
                    </div>
                    {run.status === "completed" ? <GateChecks run={run} /> : null}
                  </>
                ) : (
                  <p className="text-muted-foreground">{evaluable ? t("noRun") : t("notEvaluable")}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
      {version ? (
        <>
          <StartRunDialog
            open={dialog === "run"}
            promptKey={promptKey}
            version={version.version}
            onClose={() => setDialog(null)}
            onStarted={() => {
              setDialog(null);
              setNotice(t("runStarted"));
            }}
          />
          <ActivateDialog
            open={dialog === "activate"}
            promptKey={promptKey}
            version={version}
            onClose={() => setDialog(null)}
            onDone={() => {
              setDialog(null);
              setNotice(t("activated", { v: toPersianDigits(version.version) }));
            }}
          />
        </>
      ) : null}
    </>
  );
}
