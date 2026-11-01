"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { AdminWorkspaceBilling } from "@/lib/api/types";
import { formatJalaliDate, formatJalaliDateTime, formatNumber, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { SubscriptionDialog, type SubscriptionAction } from "./subscription-dialog";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";
const STATE_TONES: Record<string, Tone> = { active: "success", trialing: "info", expired: "warning", ended: "neutral" };

/** The workspace's plan, usage this period and subscription history; Finance can grant, extend and cancel (backend PR #23). */
export function WorkspaceBilling({ workspaceId, deleted }: { workspaceId: string; deleted: boolean }) {
  const t = useTranslations("workspaces.billing");
  const tm = useTranslations("plans.form.meters");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const [action, setAction] = useState<SubscriptionAction | null>(null);
  const [done, setDone] = useState<SubscriptionAction | null>(null);

  const { data, error, isPending } = useQuery({
    queryKey: ["workspace-billing", workspaceId],
    queryFn: () => admin<AdminWorkspaceBilling>(`/workspaces/${workspaceId}/billing`),
  });

  const canManage = staff.can("subscriptions.manage") && !deleted;
  const current = data?.current;
  const sub = current?.subscription ?? null;
  const open = (next: SubscriptionAction) => {
    setDone(null);
    setAction(next);
  };
  const state = (s: string) => <Badge tone={STATE_TONES[s] ?? "neutral"}>{t.has(`states.${s}`) ? t(`states.${s}`) : s}</Badge>;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{t("title")}</CardTitle>
        {canManage && data ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => open("grant")}>
              {t("grant.button")}
            </Button>
            {sub?.endsAt ? (
              <Button size="sm" variant="secondary" onClick={() => open("extend")}>
                {t("extend.button")}
              </Button>
            ) : null}
            {sub ? (
              <Button size="sm" variant="secondary" onClick={() => open("cancel")}>
                {t("cancel.button")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error instanceof ApiError && error.status === 404 ? <Alert tone="warning">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
        {isPending && !error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}
        {done ? <Alert tone="success">{t(`${done}.done`)}</Alert> : null}
        {current && data ? (
          <>
            <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm" data-testid="current-plan">
              <dt className="text-muted-foreground">{t("currentPlan")}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{current.planName ?? t("noPlan")}</span>
                {current.planVersion ? <span className="text-muted-foreground">{t("versionShort", { n: toPersianDigits(current.planVersion) })}</span> : null}
                <Badge>{t(`sources.${current.source}`)}</Badge>
                {sub ? state(sub.state) : null}
              </dd>
              <dt className="text-muted-foreground">{t("endsAt")}</dt>
              <dd>{current.endsAt ? formatJalaliDateTime(current.endsAt) : current.source === "subscription" ? t("noEnd") : "—"}</dd>
              <dt className="text-muted-foreground">{t("period")}</dt>
              <dd>{t("periodRange", { from: formatJalaliDate(data.usage.periodStart), to: formatJalaliDate(data.usage.periodEnd) })}</dd>
            </dl>

            <div className="grid gap-3 md:grid-cols-2" aria-label={t("usage")} role="list">
              {data.usage.meters.map((m) => {
                const ratio = m.limit ? Math.min(1, m.used / m.limit) : 0;
                const over = m.limit != null && m.used >= m.limit;
                return (
                  <div key={m.meter} role="listitem" className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>{tm.has(m.meter) ? tm(m.meter) : m.meter}</span>
                      <span className={over ? "font-medium text-danger" : "text-muted-foreground"}>
                        {m.limit == null ? t("usedUnlimited", { used: formatNumber(m.used) }) : t("usedOf", { used: formatNumber(m.used), limit: formatNumber(m.limit) })}
                      </span>
                    </div>
                    {m.limit != null ? (
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div className={over ? "h-full bg-danger" : ratio > 0.8 ? "h-full bg-warning" : "h-full bg-primary"} style={{ width: `${Math.round(ratio * 100)}%` }} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">{t("history")}</h3>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("plan")}</Th>
                    <Th>{t("state")}</Th>
                    <Th>{t("startsAt")}</Th>
                    <Th>{t("endsAt")}</Th>
                    <Th>{t("endReason")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.length === 0 ? (
                    <tr>
                      <Td colSpan={5} className="py-6 text-center text-muted-foreground">
                        {t("noHistory")}
                      </Td>
                    </tr>
                  ) : null}
                  {data.history.map((s) => (
                    <tr key={s.id}>
                      <Td>
                        <span dir="ltr" className="font-mono text-xs">
                          {s.planCode}
                        </span>{" "}
                        {t("versionShort", { n: toPersianDigits(s.planVersion) })}
                        {s.trial ? <Badge className="ms-2" tone="info">{t("trialBadge")}</Badge> : null}
                      </Td>
                      <Td>{state(s.state)}</Td>
                      <Td className="whitespace-nowrap">{formatJalaliDateTime(s.startsAt)}</Td>
                      <Td className="whitespace-nowrap">{s.endedAt ? formatJalaliDateTime(s.endedAt) : s.endsAt ? formatJalaliDateTime(s.endsAt) : t("noEnd")}</Td>
                      <Td>{s.endReason ? (t.has(`endReasons.${s.endReason}`) ? t(`endReasons.${s.endReason}`) : s.endReason) : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        ) : null}
      </CardContent>
      <SubscriptionDialog workspaceId={workspaceId} action={action} onClose={() => setAction(null)} onDone={(kind) => {
        setAction(null);
        setDone(kind);
      }} />
    </Card>
  );
}
