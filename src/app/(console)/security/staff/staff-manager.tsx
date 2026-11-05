"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ReasonDialog } from "@/components/console/reason-dialog";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { StaffSummary } from "@/lib/api/types";
import { formatJalaliDate, formatJalaliDateTime, formatRelative } from "@/lib/format";
import { STAFF_ROLES } from "@/lib/permissions";
import { useErrorMessage } from "@/lib/use-error-message";
import { CreateStaffDialog } from "./create-staff-dialog";

type StaffAction = "deactivate" | "activate" | "totp-reset" | "roles";

const ACTION_TEXT: Record<StaffAction, { title: string; body: string; done: string; confirm: string }> = {
  deactivate: { title: "deactivateTitle", body: "deactivateBody", done: "deactivated", confirm: "deactivate" },
  activate: { title: "activateTitle", body: "activateBody", done: "activated", confirm: "activate" },
  "totp-reset": { title: "totpResetTitle", body: "totpResetBody", done: "totpResetDone", confirm: "totpReset" },
  roles: { title: "rolesTitle", body: "rolesBody", done: "rolesDone", confirm: "roles" },
};

export function StaffManager() {
  const t = useTranslations();
  const { can, id: myId } = useStaff();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<{ action: StaffAction; staff: StaffSummary } | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const { data, isPending, error, dataUpdatedAt } = useQuery({ queryKey: ["staff"], queryFn: () => admin<StaffSummary[]>("/staff") });
  const manage = can("staff.manage");
  const open = (action: StaffAction, staff: StaffSummary) => {
    setRoles(staff.roles);
    setPending({ action, staff });
  };
  const text = pending ? ACTION_TEXT[pending.action] : null;

  return (
    <>
      <PageHeader
        title={t("staff.title")}
        description={t("staff.description")}
        actions={
          can("staff.manage") ? (
            <Button onClick={() => setCreating(true)}>
              <UserPlus className="size-4" aria-hidden />
              {t("staff.create")}
            </Button>
          ) : null
        }
      />
      {notice ? (
        <Alert tone="success" className="mb-4">
          {notice}
        </Alert>
      ) : null}
      {error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      {isPending ? <p className="text-sm text-muted-foreground">{t("common.loading")}</p> : null}
      {data ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>{t("staff.username")}</Th>
                <Th>{t("staff.roles")}</Th>
                <Th>{t("staff.status")}</Th>
                <Th>{t("staff.totp")}</Th>
                <Th>{t("staff.lastActive")}</Th>
                <Th>{t("staff.createdAt")}</Th>
                {manage ? <Th>{t("staff.actions.label")}</Th> : null}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <Td colSpan={manage ? 7 : 6} className="py-8 text-center text-muted-foreground">
                    {t("staff.empty")}
                  </Td>
                </tr>
              ) : null}
              {data.map((s) => (
                <tr key={s.id} data-testid={`staff-${s.username}`}>
                  <Td className="ltr text-start font-medium">
                    {s.username}
                    {s.id === myId ? <span className="ms-1 font-normal text-muted-foreground">{t("staff.actions.self")}</span> : null}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {s.roles.map((r) => (
                        <Badge key={r}>{t.has(`roles.${r}`) ? t(`roles.${r}`) : r}</Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={s.status === "active" ? "success" : "danger"}>{t.has(`staff.statuses.${s.status}`) ? t(`staff.statuses.${s.status}`) : s.status}</Badge>
                      {s.lockedUntil && Date.parse(s.lockedUntil) > dataUpdatedAt ? (
                        <Badge tone="warning">{t("staff.lockedUntil", { time: formatJalaliDateTime(s.lockedUntil) })}</Badge>
                      ) : null}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={s.totpEnabled ? "success" : "warning"}>{s.totpEnabled ? t("staff.totpOn") : t("staff.totpOff")}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap" title={s.lastActiveAt ? formatJalaliDateTime(s.lastActiveAt) : undefined}>
                    {s.lastActiveAt ? formatRelative(s.lastActiveAt) : t("staff.never")}
                  </Td>
                  <Td>{formatJalaliDate(s.createdAt)}</Td>
                  {manage ? (
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {s.status === "active" ? (
                          <Button size="sm" variant="danger" disabled={s.id === myId} onClick={() => open("deactivate", s)}>
                            {t("staff.actions.deactivate")}
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => open("activate", s)}>
                            {t("staff.actions.activate")}
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" disabled={s.id === myId || !s.totpEnabled} onClick={() => open("totp-reset", s)}>
                          {t("staff.actions.totpReset")}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => open("roles", s)}>
                          {t("staff.actions.roles")}
                        </Button>
                      </div>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
      {manage ? (
        <ReasonDialog<StaffSummary>
          open={pending !== null}
          title={pending && text ? t(`staff.actions.${text.title}`, { username: pending.staff.username }) : ""}
          description={text ? t(`staff.actions.${text.body}`) : undefined}
          confirmLabel={text ? t(`staff.actions.${text.confirm}`) : ""}
          tone={pending?.action === "deactivate" || pending?.action === "totp-reset" ? "danger" : "primary"}
          stepUp
          onSubmit={(reason) =>
            pending!.action === "roles"
              ? admin<StaffSummary>(`/staff/${pending!.staff.id}/roles`, { method: "PUT", body: { roles, reason } })
              : admin<StaffSummary>(`/staff/${pending!.staff.id}/${pending!.action}`, { method: "POST", body: { reason } })
          }
          onDone={async (result) => {
            setNotice(t(`staff.actions.${ACTION_TEXT[pending!.action].done}`, { username: result.username }));
            setPending(null);
            await queryClient.invalidateQueries({ queryKey: ["staff"] });
          }}
          onClose={() => setPending(null)}
        >
          {pending?.action === "roles" ? (
            <fieldset>
              <legend className="mb-1 text-sm font-medium">{t("staff.roles")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {STAFF_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={roles.includes(role)}
                      onChange={(e) => setRoles((prev) => (e.target.checked ? [...prev, role] : prev.filter((r) => r !== role)))}
                    />
                    {t(`roles.${role}`)}
                  </label>
                ))}
              </div>
              {roles.length === 0 ? <p className="mt-1 text-sm text-danger-foreground">{t("staff.actions.rolesRequired")}</p> : null}
            </fieldset>
          ) : null}
        </ReasonDialog>
      ) : null}
      {manage ? (
        <CreateStaffDialog
          open={creating}
          onOpenChange={setCreating}
          onCreated={(s) => {
            setCreating(false);
            setNotice(t("staff.form.created", { username: s.username }));
            void queryClient.invalidateQueries({ queryKey: ["staff"] });
          }}
        />
      ) : null}
    </>
  );
}
