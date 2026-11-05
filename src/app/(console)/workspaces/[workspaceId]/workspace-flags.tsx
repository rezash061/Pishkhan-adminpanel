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
import type { WorkspaceFeatureFlag } from "@/lib/api/types";
import { formatJalaliDateTime } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

type Change = { flag: WorkspaceFeatureFlag; enabled: boolean | null };

/** Feature flags as they apply to this workspace, with overrides (AD-1.8: Support and SuperAdmin set them). */
export function WorkspaceFlags({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("flags");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const queryClient = useQueryClient();
  const [change, setChange] = useState<Change | null>(null);
  const key = ["workspace-flags", workspaceId];
  const { data, error } = useQuery({ queryKey: key, queryFn: () => admin<WorkspaceFeatureFlag[]>(`/workspaces/${workspaceId}/feature-flags`), enabled: staff.can("flags.read") });

  if (!staff.can("flags.read")) return null;
  if (error instanceof ApiError && error.status === 404) return null;
  const canOverride = staff.can("flags.override");
  const mode = change ? (change.enabled === null ? "clear" : change.enabled ? "on" : "off") : "on";

  return (
    <Card data-testid="workspace-flags">
      <CardHeader>
        <CardTitle>{t("workspace.title")}</CardTitle>
      </CardHeader>
      {error ? (
        <CardContent>
          <Alert tone="danger">{errorMessage(error)}</Alert>
        </CardContent>
      ) : !data ? null : data.length === 0 ? (
        <CardContent className="text-sm text-muted-foreground">{t("workspace.empty")}</CardContent>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("columns.key")}</Th>
              <Th>{t("workspace.effective")}</Th>
              <Th>{t("workspace.source")}</Th>
              <Th>{t("workspace.override")}</Th>
              {canOverride ? <Th /> : null}
            </tr>
          </thead>
          <tbody>
            {data.map((f) => (
              <tr key={f.key} data-testid={`ws-flag-${f.key}`}>
                <Td>
                  <div className="font-mono text-xs" dir="ltr">
                    {f.key}
                  </div>
                  {f.description ? <div className="text-xs text-muted-foreground">{f.description}</div> : null}
                </Td>
                <Td>
                  <Badge tone={f.effective ? "success" : "neutral"}>{f.effective ? t("on") : t("off")}</Badge>
                </Td>
                <Td className="text-xs">{t.has(`sources.${f.source}`) ? t(`sources.${f.source}`) : f.source}</Td>
                <Td className="text-xs">
                  {f.override === null ? (
                    <span className="text-muted-foreground">{t("workspace.none")}</span>
                  ) : (
                    <>
                      <Badge tone={f.override ? "success" : "warning"}>{f.override ? t("on") : t("off")}</Badge>
                      <div className="mt-1 text-muted-foreground" dir="auto">
                        {t("workspace.by", { who: f.overriddenBy ?? "—", date: f.overriddenAt ? formatJalaliDateTime(f.overriddenAt) : "—", reason: f.overrideReason ?? "" })}
                      </div>
                    </>
                  )}
                </Td>
                {canOverride ? (
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {f.override !== true ? (
                        <Button size="sm" variant="secondary" onClick={() => setChange({ flag: f, enabled: true })}>
                          {t("workspace.turnOn")}
                        </Button>
                      ) : null}
                      {f.override !== false ? (
                        <Button size="sm" variant="secondary" onClick={() => setChange({ flag: f, enabled: false })}>
                          {t("workspace.turnOff")}
                        </Button>
                      ) : null}
                      {f.override !== null ? (
                        <Button size="sm" variant="secondary" onClick={() => setChange({ flag: f, enabled: null })}>
                          {t("workspace.clear")}
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <ReasonDialog<WorkspaceFeatureFlag>
        open={change !== null}
        title={change ? t("workspace.dialogTitle", { key: change.flag.key }) : ""}
        description={t(`workspace.dialogBody.${mode}`)}
        confirmLabel={t("workspace.confirm")}
        tone="primary"
        onSubmit={(reason) =>
          admin<WorkspaceFeatureFlag>(`/workspaces/${workspaceId}/feature-flags/${encodeURIComponent(change!.flag.key)}`, { method: "PUT", body: { enabled: change!.enabled, reason } })
        }
        onDone={async () => {
          setChange(null);
          await queryClient.invalidateQueries({ queryKey: key });
        }}
        onClose={() => setChange(null)}
      />
    </Card>
  );
}
