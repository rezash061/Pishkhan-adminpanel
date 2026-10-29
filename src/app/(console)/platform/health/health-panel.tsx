"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { request } from "@/lib/api/client";
import type { HealthReport } from "@/lib/api/types";
import { formatJalaliDateTime, formatNumber } from "@/lib/format";

type Health = HealthReport & { reachable: boolean; checkedAt: string };

const tone = (status: string) => (status === "Healthy" ? "success" : status === "Degraded" ? "warning" : "danger");

function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => request<Health>("/api/health"),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("health.statuses");
  return <Badge tone={tone(status)}>{t.has(status) ? t(status) : status}</Badge>;
}

export function HealthSummary() {
  const t = useTranslations("health");
  const { data, isPending } = useHealth();
  if (isPending || !data) return <p className="text-sm text-muted-foreground">…</p>;
  return (
    <div className="flex items-center gap-2 text-sm" data-testid="health-summary">
      <span>{t("overall")}:</span>
      <StatusBadge status={data.status} />
    </div>
  );
}

export function HealthPanel() {
  const t = useTranslations("health");
  const tc = useTranslations("common");
  const { data, isPending, isError } = useHealth();

  if (isPending) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (isError || !data) return <Alert tone="danger">{t("unreachable")}</Alert>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{t("overall")}:</span>
        <StatusBadge status={data.status} />
        <span className="text-sm text-muted-foreground">{t("checkedAt", { time: formatJalaliDateTime(data.checkedAt) })}</span>
      </div>
      {!data.reachable ? <Alert tone="danger">{t("unreachable")}</Alert> : null}
      {Object.keys(data.checks).length > 0 ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>{t("dependency")}</Th>
                <Th>{t("status")}</Th>
                <Th>{t("latency")}</Th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.checks).map(([name, check]) => (
                <tr key={name}>
                  <Td>{t.has(`checks.${name}`) ? t(`checks.${name}`) : name}</Td>
                  <Td>
                    <StatusBadge status={check.status} />
                  </Td>
                  <Td>{t("ms", { ms: formatNumber(check.ms) })}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
