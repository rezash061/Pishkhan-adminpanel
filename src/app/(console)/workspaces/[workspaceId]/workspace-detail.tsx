"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, LifeBuoy, ScrollText } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { AdminWorkspaceDetail } from "@/lib/api/types";
import { formatJalaliDateTime, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { channelLabel, ChannelStatusBadge, WorkspaceStatusBadge } from "../workspace-badges";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actionClass = "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-muted";

/** A workspace with its owner, members and connected accounts (backend PR #19). Read only. */
export function WorkspaceDetailView({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("workspaces");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const valid = UUID.test(workspaceId);

  const { data, error, isPending } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => admin<AdminWorkspaceDetail>(`/workspaces/${encodeURIComponent(workspaceId)}`),
    enabled: valid,
  });

  const back = (
    <Link href="/workspaces" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
      <ArrowRight className="size-4" aria-hidden />
      {t("detail.back")}
    </Link>
  );

  if (!valid || (error instanceof ApiError && error.status === 404)) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Alert tone="warning">{t("detail.notFound")}</Alert>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Alert tone="danger">{errorMessage(error)}</Alert>
      </div>
    );
  }
  if (isPending) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;

  const w = data;
  const canSupport = staff.can("workspaces.impersonate") && w.status !== "deleted";
  const supportHref = (userId?: string) => `/support/sessions?${new URLSearchParams(userId ? { workspaceId: w.id, userId } : { workspaceId: w.id })}`;
  const industry = t.has(`industries.${w.industry}`) ? t(`industries.${w.industry}`) : w.industry;

  return (
    <div className="flex flex-col gap-4">
      {back}
      <PageHeader
        title={w.name}
        description={t("detail.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            {canSupport ? (
              <Link href={supportHref()} className={actionClass}>
                <LifeBuoy className="size-4" aria-hidden />
                {t("detail.startSupport")}
              </Link>
            ) : null}
            {staff.can("audit.read") ? (
              <Link href={`/security/audit-log?workspaceId=${w.id}`} className={actionClass}>
                <ScrollText className="size-4" aria-hidden />
                {t("detail.auditLog")}
              </Link>
            ) : null}
          </div>
        }
      />

      {w.status === "pending_deletion" && w.deletionScheduledFor ? (
        <Alert tone="warning">{t("detail.pendingDeletion", { date: formatJalaliDateTime(w.deletionScheduledFor) })}</Alert>
      ) : null}
      {w.status === "deleted" ? <Alert tone="info">{t("detail.deleted", { date: w.deletedAt ? formatJalaliDateTime(w.deletedAt) : "—" })}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.overview")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              <Row label={t("columns.status")}>
                <WorkspaceStatusBadge status={w.status} />
              </Row>
              <Row label={t("detail.id")}>
                <span dir="ltr" className="font-mono text-xs">{w.id}</span>
              </Row>
              <Row label={t("detail.slug")}>
                <span dir="ltr" className="font-mono text-xs">{w.slug}</span>
              </Row>
              <Row label={t("columns.industry")}>{industry}</Row>
              <Row label={t("detail.timeZone")}>
                <span dir="ltr">{w.timeZone}</span>
              </Row>
              <Row label={t("detail.plan")}>{w.planId ? <span dir="ltr" className="font-mono text-xs">{w.planId}</span> : t("detail.noPlan")}</Row>
              <Row label={t("columns.createdAt")}>{formatJalaliDateTime(w.createdAt)}</Row>
              {w.deletionRequestedAt ? <Row label={t("detail.deletionRequestedAt")}>{formatJalaliDateTime(w.deletionRequestedAt)}</Row> : null}
              <Row label={t("detail.pendingInvitations")}>{toPersianDigits(w.pendingInvitations)}</Row>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("columns.owner")}</CardTitle>
          </CardHeader>
          <CardContent>
            {w.owner ? (
              <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
                <Row label={t("detail.name")}>{w.owner.displayName ?? "—"}</Row>
                <Row label={t("detail.phone")}>
                  <span dir="ltr" className="font-mono text-xs">{w.owner.maskedPhone}</span>
                </Row>
                <Row label={t("detail.userId")}>
                  <span dir="ltr" className="font-mono text-xs">{w.owner.id}</span>
                </Row>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">{t("detail.noOwner")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("detail.members", { count: toPersianDigits(w.members.length) })}</CardTitle>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>{t("detail.name")}</Th>
              <Th>{t("detail.phone")}</Th>
              <Th>{t("detail.role")}</Th>
              <Th>{t("detail.joinedAt")}</Th>
              {canSupport ? <Th>{t("detail.actions")}</Th> : null}
            </tr>
          </thead>
          <tbody>
            {w.members.length === 0 ? (
              <tr>
                <Td colSpan={canSupport ? 5 : 4} className="py-6 text-center text-muted-foreground">
                  {t("detail.noMembers")}
                </Td>
              </tr>
            ) : null}
            {w.members.map((m) => (
              <tr key={m.userId}>
                <Td>
                  {staff.can("users.read") ? (
                    <Link href={`/users/${m.userId}`} className="text-primary hover:underline">
                      {m.displayName ?? t("detail.openUser")}
                    </Link>
                  ) : (
                    (m.displayName ?? "—")
                  )}
                </Td>
                <Td className="ltr text-start font-mono text-xs">{m.maskedPhone ?? "—"}</Td>
                <Td>
                  <Badge tone={m.role === "owner" ? "info" : "neutral"}>{t.has(`roles.${m.role}`) ? t(`roles.${m.role}`) : m.role}</Badge>
                </Td>
                <Td className="whitespace-nowrap">{formatJalaliDateTime(m.joinedAt)}</Td>
                {canSupport ? (
                  <Td>
                    <Link href={supportHref(m.userId)} className="text-primary hover:underline" aria-label={t("detail.supportAs", { name: m.displayName ?? m.maskedPhone ?? m.userId })}>
                      {t("detail.supportAsShort")}
                    </Link>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("detail.channels")}</CardTitle>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>{t("detail.account")}</Th>
              <Th>{t("columns.status")}</Th>
              <Th>{t("detail.statusReason")}</Th>
              <Th>{t("detail.tokenExpiresAt")}</Th>
              <Th>{t("detail.connectedAt")}</Th>
            </tr>
          </thead>
          <tbody>
            {w.channels.length === 0 ? (
              <tr>
                <Td colSpan={5} className="py-6 text-center text-muted-foreground">
                  {t("noChannels")}
                </Td>
              </tr>
            ) : null}
            {w.channels.map((c) => (
              <tr key={c.id}>
                <Td>
                  <span dir="ltr" className="font-mono text-xs">{channelLabel(c)}</span>
                  <div className="text-xs text-muted-foreground">{t.has(`kinds.${c.kind}`) ? t(`kinds.${c.kind}`) : c.kind}</div>
                </Td>
                <Td>
                  <ChannelStatusBadge status={c.status} />
                  {c.statusChangedAt ? <div className="text-xs text-muted-foreground">{formatJalaliDateTime(c.statusChangedAt)}</div> : null}
                </Td>
                <Td className="ltr text-start text-xs">{c.statusReason ?? "—"}</Td>
                <Td className="whitespace-nowrap">{c.tokenExpiresAt ? formatJalaliDateTime(c.tokenExpiresAt) : "—"}</Td>
                <Td className="whitespace-nowrap">{formatJalaliDateTime(c.connectedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}
