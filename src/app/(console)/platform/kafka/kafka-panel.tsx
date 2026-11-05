"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { KafkaGroup, KafkaOverview } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatJalaliDateTime, formatNumber, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

export const KAFKA_REFRESH_MS = 15_000;

/** Lag above 100 messages is worth a look; above 1000 a group is falling behind. */
export function lagLevel(lag: number): "ok" | "warn" | "high" {
  return lag > 1000 ? "high" : lag > 100 ? "warn" : "ok";
}

const LAG_TONE = { ok: "success", warn: "warning", high: "danger" } as const;

/** Kafka topics and worker group lag (AD-1.7, admin plan 4.10). Refreshes every 15 seconds like the backend's cache. */
export function KafkaPanel() {
  const t = useTranslations("kafka");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [showDlq, setShowDlq] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, isPending } = useQuery({
    queryKey: ["kafka"],
    queryFn: () => admin<KafkaOverview>("/platform/kafka"),
    refetchInterval: KAFKA_REFRESH_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });

  if (isPending && !error) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (error instanceof ApiError && error.status === 404) return <Alert tone="warning">{t("notAvailable")}</Alert>;
  if (error instanceof ApiError && error.status === 503) return <Alert tone="danger">{t("unavailable")}</Alert>;
  if (error || !data) return <Alert tone="danger">{errorMessage(error)}</Alert>;

  const stateLabel = (s: string) => (t.has(`states.${s}`) ? t(`states.${s}`) : s);
  const topics = data.topics.filter((x) => showDlq || !x.isDlq);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{t("updated", { time: formatJalaliDateTime(data.at) })}</p>
      <Card>
        <CardHeader>
          <CardTitle>{t("groups")}</CardTitle>
        </CardHeader>
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
              <Fragment key={g.group}>
                <tr className="cursor-pointer hover:bg-muted/50" onClick={() => setOpen(open === g.group ? null : g.group)} data-testid={`group-${g.group}`}>
                  <Td className="font-mono" dir="ltr">
                    <button type="button" aria-expanded={open === g.group} className="text-start text-primary hover:underline">
                      {g.group}
                    </button>
                  </Td>
                  <Td>
                    <Badge tone={g.state === "Stable" ? "success" : g.state === "Dead" ? "danger" : "warning"}>{stateLabel(g.state)}</Badge>
                  </Td>
                  <Td>{toPersianDigits(g.members)}</Td>
                  <Td>
                    <Badge tone={LAG_TONE[lagLevel(g.lag)]}>{formatNumber(g.lag)}</Badge>
                  </Td>
                </tr>
                {open === g.group ? (
                  <tr>
                    <Td colSpan={4} className="bg-muted/30">
                      <GroupDetail group={g} />
                    </Td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("topics")}</CardTitle>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={showDlq} onChange={(e) => setShowDlq(e.target.checked)} />
            {t("showDlq")}
          </label>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>{t("columns.topic")}</Th>
              <Th>{t("columns.partitions")}</Th>
              <Th>{t("columns.messages")}</Th>
              <Th>{t("columns.retention")}</Th>
              <Th>{t("columns.key")}</Th>
            </tr>
          </thead>
          <tbody>
            {topics.map((x) => (
              <tr key={x.name}>
                <Td className={cn("font-mono text-xs", x.isDlq && "text-danger-foreground")} dir="ltr">
                  {x.name}
                </Td>
                <Td>{x.exists ? toPersianDigits(x.partitions) : <Badge tone="danger">{t("missing")}</Badge>}</Td>
                <Td>{formatNumber(x.messages)}</Td>
                <Td>{t("retentionDays", { days: toPersianDigits(x.retentionDays) })}</Td>
                <Td className="text-xs text-muted-foreground" dir="ltr">
                  {x.keyDescription}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function GroupDetail({ group }: { group: KafkaGroup }) {
  const t = useTranslations("kafka");
  if (group.topics.length === 0) return <p className="py-2 text-sm text-muted-foreground">{t("noLag")}</p>;
  return (
    <CardContent className="flex flex-col gap-3 p-0 py-2">
      {group.topics.map((topic) => (
        <div key={topic.topic}>
          <div className="mb-1 flex items-center gap-2 text-sm">
            <span className="font-mono text-xs" dir="ltr">
              {topic.topic}
            </span>
            <Badge tone={LAG_TONE[lagLevel(topic.lag)]}>{formatNumber(topic.lag)}</Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topic.partitions.map((p) => (
              <span
                key={p.partition}
                title={`${t("columns.committed")}: ${p.committed ?? "—"} · ${t("columns.end")}: ${p.end}`}
                className={cn("rounded border px-1.5 py-0.5 text-xs", p.lag > 0 ? "border-warning bg-warning/10" : "border-border")}
              >
                {t("columns.partition")} {toPersianDigits(p.partition)}: {formatNumber(p.lag)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </CardContent>
  );
}
