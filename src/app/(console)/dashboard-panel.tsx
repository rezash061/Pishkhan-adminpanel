"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { admin } from "@/lib/api/client";
import type { DashboardAlert, DashboardKpis, DashboardResponse } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatJalaliDateTime, formatNumber, formatToman, toPersianDigits } from "@/lib/format";
import type { Permission } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";

export const DASHBOARD_REFRESH_MS = 60_000;

/** Where a tile or an alert leads, with the page's filter applied, and the permission that page needs. */
const ALERT_TARGET: Record<string, { href: string; permission: Permission }> = {
  instagram_down: { href: "/platform/outage", permission: "platform.outage.read" },
  kafka_unavailable: { href: "/platform/kafka", permission: "platform.ops.read" },
  consumer_lag: { href: "/platform/kafka", permission: "platform.ops.read" },
  dead_letters: { href: "/platform/dead-letters", permission: "platform.ops.read" },
  workers_down: { href: "/platform/workers", permission: "platform.ops.read" },
  quarantine: { href: "/security/quarantine?status=infected", permission: "files.quarantine" },
  channels_reauth: { href: "/workspaces", permission: "workspaces.read" },
  ai_failures: { href: "/ai/traces?outcome=failed", permission: "ai.traces.read" },
};

export function percent(rate: number): string {
  return `${toPersianDigits((Math.round(rate * 1000) / 10).toString()).replace(".", "٫")}٪`;
}

interface Tile {
  key: string;
  label: string;
  value: string;
  href?: string;
  permission?: Permission;
  tone?: "danger" | "warning";
}

/** Home dashboard (AD-1.10): KPI tiles that link to the filtered page, and the backend's alerts. Refreshes every minute. */
export function DashboardPanel() {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const staff = useStaff();
  const { data, error, isPending } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => admin<DashboardResponse>("/dashboard"),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  if (isPending && !error) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (error instanceof ApiError && error.status === 404) return <Alert tone="info">{t("kpis.notAvailable")}</Alert>;
  if (error || !data) return null;

  const n = (v: number | null) => (v === null ? t("kpis.unknown") : formatNumber(v));
  const k: DashboardKpis = data.kpis;
  const tiles: Tile[] = [
    { key: "activeWorkspaces", label: t("kpis.activeWorkspaces"), value: n(k.activeWorkspaces), href: "/workspaces?status=active", permission: "workspaces.read" },
    { key: "signups", label: t("kpis.signups"), value: `${n(k.signupsToday)} / ${n(k.signups7d)}`, href: "/workspaces", permission: "workspaces.read" },
    { key: "paying", label: t("kpis.paying"), value: n(k.payingWorkspaces) },
    { key: "mrr", label: t("kpis.mrr"), value: k.mrrRial === null ? t("kpis.unknown") : formatToman(k.mrrRial) },
    { key: "aiReplies", label: t("kpis.aiReplies"), value: n(k.aiRepliesToday), href: "/ai/traces", permission: "ai.traces.read" },
    {
      key: "handoffRate",
      label: t("kpis.handoffRate"),
      value: k.handoffRateToday === null ? t("kpis.unknown") : percent(k.handoffRateToday),
      href: "/ai/traces?outcome=handed_off",
      permission: "ai.traces.read",
    },
    { key: "quarantine", label: t("kpis.quarantine"), value: n(k.quarantinedFiles), href: "/security/quarantine", permission: "files.quarantine", tone: k.quarantinedFiles ? "warning" : undefined },
    { key: "deadLetters", label: t("kpis.deadLetters"), value: n(k.openDeadLetters), href: "/platform/dead-letters", permission: "platform.ops.read", tone: k.openDeadLetters ? "warning" : undefined },
    { key: "lag", label: t("kpis.lag"), value: n(k.maxConsumerLag), href: "/platform/kafka", permission: "platform.ops.read", tone: k.maxConsumerLag === null || k.maxConsumerLag > 1000 ? "warning" : undefined },
    { key: "reauth", label: t("kpis.reauth"), value: n(k.channelsNeedingReauth), tone: k.channelsNeedingReauth ? "warning" : undefined },
    {
      key: "instagram",
      label: t("kpis.instagram"),
      value: k.instagramStatus === null ? t("kpis.unknown") : k.instagramStatus === "down" ? t("kpis.instagramDown") : t("kpis.instagramUp"),
      href: "/platform/outage",
      permission: "platform.outage.read",
      tone: k.instagramStatus === "down" ? "danger" : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="dashboard">
      <Card>
        <CardHeader>
          <CardTitle>{t("alerts.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("alerts.none")}</p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="dashboard-alerts">
              {data.alerts.map((a, i) => (
                <AlertRow key={`${a.code}-${a.subject ?? i}`} alert={a} canOpen={(p) => staff.can(p)} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <section aria-labelledby="kpi-title">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="kpi-title" className="font-semibold">
            {t("kpis.title")}
          </h2>
          <span className="text-xs text-muted-foreground">{t("kpis.updated", { time: formatJalaliDateTime(data.at) })}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" data-testid="kpi-tiles">
          {tiles.map((tile) => {
            const body = (
              <>
                <div className="text-xs text-muted-foreground">{tile.label}</div>
                <div className={cn("mt-1 text-lg font-semibold", tile.tone === "danger" && "text-danger-foreground", tile.tone === "warning" && "text-warning-foreground")}>{tile.value}</div>
              </>
            );
            const className = cn("rounded-lg border bg-surface p-3", tile.tone === "danger" ? "border-danger/60" : tile.tone === "warning" ? "border-warning/60" : "border-border");
            return tile.href && tile.permission && staff.can(tile.permission) ? (
              <Link key={tile.key} href={tile.href} className={cn(className, "hover:bg-muted")} data-testid={`kpi-${tile.key}`}>
                {body}
              </Link>
            ) : (
              <div key={tile.key} className={className} data-testid={`kpi-${tile.key}`}>
                {body}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function AlertRow({ alert, canOpen }: { alert: DashboardAlert; canOpen: (p: Permission) => boolean }) {
  const t = useTranslations("home.alerts");
  const known = ["instagram_down", "kafka_unavailable", "consumer_lag", "dead_letters", "workers_down", "quarantine", "channels_reauth", "ai_failures"].includes(alert.code);
  const text = known ? t(alert.code, { count: formatNumber(alert.count ?? 0), subject: alert.subject ?? "" }) : t("other", { code: alert.code });
  const target = ALERT_TARGET[alert.code];
  return (
    <li>
      <Alert tone={alert.severity === "danger" ? "danger" : "warning"}>
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span>{text}</span>
          {target && canOpen(target.permission) ? (
            <Link href={target.href} className="text-sm font-medium underline">
              {t("open")}
            </Link>
          ) : null}
        </span>
      </Alert>
    </li>
  );
}
