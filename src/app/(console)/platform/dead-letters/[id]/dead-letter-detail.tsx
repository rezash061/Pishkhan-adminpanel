"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ReasonDialog } from "@/components/console/reason-dialog";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { admin } from "@/lib/api/client";
import type { DeadLetterActionResponse, DeadLetterDetail } from "@/lib/api/types";
import { formatJalaliDateTime, toPersianDigits } from "@/lib/format";
import { useErrorMessage } from "@/lib/use-error-message";
import { STATUS_TONE } from "../dead-letters-list";

/** One dead letter: metadata, the error and (Support, SuperAdmin) the envelope with its payload; replay or discard when open. */
export function DeadLetterDetailView({ id }: { id: string }) {
  const t = useTranslations("deadLetters");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<"replay" | "discard" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canPayload = staff.can("platform.dlq.payload");
  const { data, error, isPending } = useQuery({
    queryKey: ["dead-letter", id],
    queryFn: () => admin<DeadLetterDetail>(`/platform/dead-letters/${encodeURIComponent(id)}`),
    enabled: canPayload,
  });

  const back = (
    <Link href="/platform/dead-letters" className="text-sm text-primary hover:underline">
      {t("detail.back")}
    </Link>
  );
  if (!canPayload) {
    return (
      <>
        <PageHeader title={t("detail.title")} actions={back} />
        <Alert tone="info">{t("detail.noPayload")}</Alert>
      </>
    );
  }
  if (isPending && !error) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (error || !data) return <Alert tone="danger">{errorMessage(error)}</Alert>;

  const d = data.deadLetter;
  const row = (label: string, value: React.ReactNode, ltr = true) => (
    <div className="grid grid-cols-[10rem_1fr] gap-2 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={ltr ? "break-all font-mono text-xs" : undefined} dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );

  return (
    <>
      <PageHeader
        title={d.type}
        description={t("detail.title")}
        actions={
          <>
            {back}
            {staff.can("platform.dlq.manage") && d.status === "open" ? (
              <>
                <Button onClick={() => setAction("replay")}>{t("replay.label")}</Button>
                <Button variant="danger" onClick={() => setAction("discard")}>
                  {t("discard.label")}
                </Button>
              </>
            ) : null}
          </>
        }
      />
      <div className="flex flex-col gap-4">
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{t.has(`statuses.${d.status}`) ? t(`statuses.${d.status}`) : d.status}</Badge>
            {d.resolvedAt ? (
              <span className="text-sm text-muted-foreground">
                {t("detail.resolved", { status: t(`statuses.${d.status}`), who: d.resolvedBy ?? "—", date: formatJalaliDateTime(d.resolvedAt) })}
              </span>
            ) : null}
          </CardHeader>
          <CardContent>
            <dl>
              {row(t("detail.messageId"), d.messageId)}
              {row(t("detail.topic"), d.topic)}
              {row(t("columns.group"), d.group)}
              {row(t("columns.consumer"), d.consumer)}
              {row(t("detail.key"), d.key)}
              {d.workspaceId ? row(t("detail.workspace"), <Link href={`/workspaces/${d.workspaceId}`} className="text-primary hover:underline">{d.workspaceId}</Link>) : null}
              {row(t("detail.exception"), d.exceptionType)}
              {row(t("columns.error"), d.exceptionMessage)}
              {row(t("columns.attempts"), toPersianDigits(d.attempts), false)}
              {row(t("columns.failedAt"), formatJalaliDateTime(d.failedAt), false)}
              {d.resolutionReason ? row(t("detail.reason"), <span dir="auto">{d.resolutionReason}</span>, false) : null}
              {d.replayMessageId ? row(t("detail.replayId"), d.replayMessageId) : null}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.envelope")}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre dir="ltr" data-testid="dead-letter-envelope" className="max-h-[32rem] overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs leading-relaxed">
              {JSON.stringify(data.envelope, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
      <ReasonDialog<DeadLetterActionResponse>
        open={action !== null}
        title={action ? t(`${action}.title`) : ""}
        description={action ? t(`${action}.body`) : undefined}
        confirmLabel={action ? t(`${action}.confirm`) : ""}
        tone={action === "replay" ? "primary" : "danger"}
        stepUp
        onSubmit={(reason) => admin<DeadLetterActionResponse>(`/platform/dead-letters/${action}`, { method: "POST", body: { ids: [d.id], reason } })}
        onDone={async (result) => {
          setNotice(t(`${action!}.done`, { done: result.done }));
          setAction(null);
          await queryClient.invalidateQueries({ queryKey: ["dead-letter", id] });
          await queryClient.invalidateQueries({ queryKey: ["dead-letters"] });
          await queryClient.invalidateQueries({ queryKey: ["dead-letters-summary"] });
        }}
        onClose={() => setAction(null)}
      />
    </>
  );
}
