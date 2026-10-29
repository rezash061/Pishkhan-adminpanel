"use client";

import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { StaffSummary } from "@/lib/api/types";
import { formatJalaliDate } from "@/lib/format";
import { useErrorMessage } from "@/lib/use-error-message";
import { CreateStaffDialog } from "./create-staff-dialog";

export function StaffManager() {
  const t = useTranslations();
  const { can } = useStaff();
  const errorMessage = useErrorMessage();
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { data, isPending, error } = useQuery({ queryKey: ["staff"], queryFn: () => admin<StaffSummary[]>("/staff") });

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
                <Th>{t("staff.createdAt")}</Th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-8 text-center text-muted-foreground">
                    {t("staff.empty")}
                  </Td>
                </tr>
              ) : null}
              {data.map((s) => (
                <tr key={s.id}>
                  <Td className="ltr text-start font-medium">{s.username}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {s.roles.map((r) => (
                        <Badge key={r}>{t.has(`roles.${r}`) ? t(`roles.${r}`) : r}</Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={s.status === "active" ? "success" : "danger"}>{t.has(`staff.statuses.${s.status}`) ? t(`staff.statuses.${s.status}`) : s.status}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={s.totpEnabled ? "success" : "warning"}>{s.totpEnabled ? t("staff.totpOn") : t("staff.totpOff")}</Badge>
                  </Td>
                  <Td>{formatJalaliDate(s.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
      {can("staff.manage") ? (
        <CreateStaffDialog
          open={creating}
          onOpenChange={setCreating}
          onCreated={(s) => {
            setCreating(false);
            setNotice(t("staff.form.created", { username: s.username }));
          }}
        />
      ) : null}
    </>
  );
}
