"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ReasonDialog } from "@/components/console/reason-dialog";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { RecurringJob, WorkersOverview } from "@/lib/api/types";
import { formatJalaliDateTime, formatNumber, formatRelative, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { lagLevel } from "../kafka/kafka-panel";

const JOB_TONE: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = { WAITING: "success", ACQUIRED: "info", EXECUTING: "info", BLOCKED: "info", PAUSED: "warning", ERROR: "danger" };
const LAG_TONE = { ok: "success", warn: "warning", high: "danger" } as const;

/** Worker replicas, recurring jobs (run now: SuperAdmin, step-up) and worker groups (AD-1.7, admin plan 4.10). */
export function WorkersPanel() {
  const t = useTranslations("workers");
  const tk = useTranslations("kafka");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const queryClient = useQueryClient();
  const [job, setJob] = useState<RecurringJob | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { data, error, isPending } = useQuery({ queryKey: ["workers"], queryFn: () => admin<WorkersOverview>("/platform/workers"), refetchInterval: 15_000 });

  if (isPending && !error) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (error instanceof ApiError && error.status === 404) return <Alert tone="warning">{t("notAvailable")}</Alert>;
  if (error || !data) return <Alert tone="danger">{errorMessage(error)}</Alert>;

  const canTrigger = staff.can("platform.jobs.manage");
  const jobState = (s: string) => (t.has(`jobStates.${s}`) ? t(`jobStates.${s}`) : s);

  return (
    <div className="flex flex-col gap-4">
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("instances")}</CardTitle>
        </CardHeader>
        {data.instances.length === 0 ? (
          <CardContent className="text-sm text-muted-foreground">{t("noInstances")}</CardContent>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.instance")}</Th>
                <Th>{t("columns.status")}</Th>
                <Th>{t("columns.lastCheckin")}</Th>
                <Th>{t("columns.interval")}</Th>
              </tr>
            </thead>
            <tbody>
              {data.instances.map((i) => (
                <tr key={i.instanceId}>
                  <Td className="font-mono text-xs" dir="ltr">
                    {i.instanceId}
                  </Td>
                  <Td>
                    <Badge tone={i.alive ? "success" : "danger"}>{i.alive ? t("alive") : t("dead")}</Badge>
                  </Td>
                  <Td title={formatJalaliDateTime(i.lastCheckinAt)}>{formatRelative(i.lastCheckinAt)}</Td>
                  <Td>{t("seconds", { n: toPersianDigits(i.checkinIntervalSeconds) })}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("jobs")}</CardTitle>
        </CardHeader>
        {data.jobs.length === 0 ? (
          <CardContent className="text-sm text-muted-foreground">{t("noJobs")}</CardContent>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.job")}</Th>
                <Th>{t("columns.cron")}</Th>
                <Th>{t("columns.state")}</Th>
                <Th>{t("columns.previous")}</Th>
                <Th>{t("columns.next")}</Th>
                {canTrigger ? <Th /> : null}
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((j) => (
                <tr key={j.name} data-testid={`job-${j.name}`}>
                  <Td className="font-mono text-xs" dir="ltr">
                    {j.name}
                  </Td>
                  <Td className="font-mono text-xs" dir="ltr">
                    {j.cron ?? "—"}
                  </Td>
                  <Td>
                    <Badge tone={JOB_TONE[j.state] ?? "neutral"}>{jobState(j.state)}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">{j.previousFireAt ? formatJalaliDateTime(j.previousFireAt) : "—"}</Td>
                  <Td className="whitespace-nowrap">{j.nextFireAt ? formatJalaliDateTime(j.nextFireAt) : "—"}</Td>
                  {canTrigger ? (
                    <Td>
                      <Button size="sm" variant="secondary" disabled={j.state !== "WAITING"} onClick={() => setJob(j)}>
                        {t("trigger.label")}
                      </Button>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("groups")}</CardTitle>
        </CardHeader>
        {data.groups.length === 0 ? (
          <CardContent className="text-sm text-muted-foreground">{t("noGroups")}</CardContent>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.group")}</Th>
                <Th>{t("columns.state")}</Th>
                <Th>{t("columns.members")}</Th>
                <Th>{t("columns.lag")}</Th>
              </tr>
            </thead>
            <tbody>
              {data.groups.map((g) => (
                <tr key={g.group}>
                  <Td className="font-mono text-xs" dir="ltr">
                    {g.group}
                  </Td>
                  <Td>{tk.has(`states.${g.state}`) ? tk(`states.${g.state}`) : g.state}</Td>
                  <Td>{toPersianDigits(g.members)}</Td>
                  <Td>
                    <Badge tone={LAG_TONE[lagLevel(g.lag)]}>{formatNumber(g.lag)}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <ReasonDialog<RecurringJob>
        open={job !== null}
        title={t("trigger.title")}
        description={job ? t("trigger.body", { name: job.name }) : undefined}
        confirmLabel={t("trigger.confirm")}
        tone="primary"
        stepUp
        onSubmit={(reason) => admin<RecurringJob>(`/platform/jobs/${encodeURIComponent(job!.name)}/trigger`, { method: "POST", body: { reason } })}
        onDone={async (result) => {
          setNotice(t("trigger.done", { name: result.name }));
          setJob(null);
          await queryClient.invalidateQueries({ queryKey: ["workers"] });
        }}
        onClose={() => setJob(null)}
      />
    </div>
  );
}
