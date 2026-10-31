"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Ban, LogOut, ScrollText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { WorkspaceStatusBadge } from "@/app/(console)/workspaces/workspace-badges";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { AdminUserDetail } from "@/lib/api/types";
import { formatJalaliDateTime, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { TotpBadge, UserStatusBadge } from "../user-badges";
import { UserActionDialog, type UserAction } from "./user-action-dialog";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const linkClass = "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-muted";

/** A panel user with their workspaces and signed-in devices (backend PR #21); Support can sign them out, block and unblock. */
export function UserDetailView({ userId }: { userId: string }) {
  const t = useTranslations("users");
  const tw = useTranslations("workspaces");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const [action, setAction] = useState<UserAction | null>(null);
  const [done, setDone] = useState<UserAction | null>(null);
  const valid = UUID.test(userId);

  const { data, error, isPending } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => admin<AdminUserDetail>(`/users/${encodeURIComponent(userId)}`),
    enabled: valid,
  });

  const back = (
    <Link href="/users" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
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

  const u = data;
  const canManage = staff.can("users.manage");
  const blocked = u.status === "suspended";
  const open = (next: UserAction) => {
    setDone(null);
    setAction(next);
  };

  return (
    <div className="flex flex-col gap-4">
      {back}
      <PageHeader
        title={u.displayName ?? t("noName")}
        description={t("detail.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <>
                <Button variant="secondary" onClick={() => open("revoke")} disabled={u.sessions.length === 0}>
                  <LogOut className="size-4" aria-hidden />
                  {t("actions.revoke.button")}
                </Button>
                {blocked ? (
                  <Button variant="secondary" onClick={() => open("unblock")}>
                    <ShieldCheck className="size-4" aria-hidden />
                    {t("actions.unblock.button")}
                  </Button>
                ) : (
                  <Button variant="danger" onClick={() => open("block")}>
                    <Ban className="size-4" aria-hidden />
                    {t("actions.block.button")}
                  </Button>
                )}
              </>
            ) : null}
            {staff.can("audit.read") ? (
              <Link href={`/security/audit-log?actor=${u.id}`} className={linkClass}>
                <ScrollText className="size-4" aria-hidden />
                {t("detail.auditLog")}
              </Link>
            ) : null}
          </div>
        }
      />

      {done ? (
        <Alert tone="success">
          {t(`actions.${done}.done`)}
        </Alert>
      ) : null}
      {blocked ? <Alert tone="warning">{t("detail.blocked")}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("detail.overview")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
            <Row label={t("columns.status")}>
              <UserStatusBadge status={u.status} />
            </Row>
            <Row label={t("columns.name")}>{u.displayName ?? t("noName")}</Row>
            <Row label={t("columns.phone")}>
              <span dir="ltr" className="font-mono text-xs">
                {u.maskedPhone}
              </span>
            </Row>
            <Row label={t("detail.id")}>
              <span dir="ltr" className="font-mono text-xs">
                {u.id}
              </span>
            </Row>
            <Row label={t("columns.totp")}>
              <TotpBadge enabled={u.totpEnabled} />
            </Row>
            <Row label={t("detail.password")}>{u.hasPassword ? tc("yes") : tc("no")}</Row>
            <Row label={t("columns.createdAt")}>{formatJalaliDateTime(u.createdAt)}</Row>
            <Row label={t("columns.lastLogin")}>{u.lastLoginAt ? formatJalaliDateTime(u.lastLoginAt) : "—"}</Row>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("detail.workspaces", { count: toPersianDigits(u.workspaces.length) })}</CardTitle>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>{tw("columns.name")}</Th>
              <Th>{tw("detail.role")}</Th>
              <Th>{tw("columns.status")}</Th>
              <Th>{tw("detail.joinedAt")}</Th>
            </tr>
          </thead>
          <tbody>
            {u.workspaces.length === 0 ? (
              <tr>
                <Td colSpan={4} className="py-6 text-center text-muted-foreground">
                  {t("detail.noWorkspaces")}
                </Td>
              </tr>
            ) : null}
            {u.workspaces.map((m) => (
              <tr key={m.workspaceId}>
                <Td>
                  {staff.can("workspaces.read") ? (
                    <Link href={`/workspaces/${m.workspaceId}`} className="text-primary hover:underline">
                      {m.workspaceName}
                    </Link>
                  ) : (
                    m.workspaceName
                  )}
                </Td>
                <Td>
                  <Badge tone={m.role === "owner" ? "info" : "neutral"}>{tw.has(`roles.${m.role}`) ? tw(`roles.${m.role}`) : m.role}</Badge>
                </Td>
                <Td>
                  <WorkspaceStatusBadge status={m.workspaceStatus} />
                </Td>
                <Td className="whitespace-nowrap">{formatJalaliDateTime(m.joinedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("detail.sessions", { count: toPersianDigits(u.sessions.length) })}</CardTitle>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>{t("detail.device")}</Th>
              <Th>{t("detail.ip")}</Th>
              <Th>{t("detail.method")}</Th>
              <Th>{t("detail.firstSeen")}</Th>
              <Th>{t("detail.lastUsed")}</Th>
              <Th>{t("detail.expires")}</Th>
            </tr>
          </thead>
          <tbody>
            {u.sessions.length === 0 ? (
              <tr>
                <Td colSpan={6} className="py-6 text-center text-muted-foreground">
                  {t("detail.noSessions")}
                </Td>
              </tr>
            ) : null}
            {u.sessions.map((s) => (
              <tr key={s.id}>
                <Td className="max-w-72">
                  <span dir="ltr" className="block truncate text-start text-xs" title={s.userAgent ?? undefined}>
                    {s.userAgent ?? "—"}
                  </span>
                </Td>
                <Td className="ltr text-start font-mono text-xs">{s.ip ?? "—"}</Td>
                <Td className="ltr text-start font-mono text-xs">{s.authMethods}</Td>
                <Td className="whitespace-nowrap">{formatJalaliDateTime(s.createdAt)}</Td>
                <Td className="whitespace-nowrap">{formatJalaliDateTime(s.lastUsedAt)}</Td>
                <Td className="whitespace-nowrap">{formatJalaliDateTime(s.expiresAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <UserActionDialog userId={u.id} action={action} onClose={() => setAction(null)} onDone={(kind) => {
        setAction(null);
        setDone(kind);
      }} />
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
