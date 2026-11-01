"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { AiProvider } from "@/lib/api/types";
import { formatJalaliDateTime } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { SourceBadge } from "../ai-shared";
import { ProviderDialog, ProviderTestDialog } from "./provider-dialogs";

/** Providers in effect (backend PR #24). SuperAdmin edits them with a step-up and can send a test request. */
export function ProvidersList() {
  const t = useTranslations("ai.providers");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const canManage = staff.can("ai.providers.manage");
  const [editing, setEditing] = useState<AiProvider | "new" | null>(null);
  const [testing, setTesting] = useState<AiProvider | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const { data, error, isPending } = useQuery({ queryKey: ["ai-providers"], queryFn: () => admin<AiProvider[]>("/ai/providers") });
  const notAvailable = error instanceof ApiError && error.status === 404;

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <Button className="self-start" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden />
          {t("create")}
        </Button>
      ) : null}
      {saved ? <Alert tone="success">{t("saved", { name: saved })}</Alert> : null}
      {notAvailable ? <Alert tone="warning">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t("columns.name")}</Th>
              <Th>{t("columns.kind")}</Th>
              <Th>{t("columns.baseUrl")}</Th>
              <Th>{t("columns.key")}</Th>
              <Th>{t("columns.status")}</Th>
              <Th>{t("columns.source")}</Th>
              <Th>{t("columns.lastTest")}</Th>
              {canManage ? <Th>{t("columns.actions")}</Th> : null}
            </tr>
          </thead>
          <tbody>
            {isPending && !error ? (
              <tr>
                <Td colSpan={8} className="py-6 text-center text-muted-foreground">
                  {tc("loading")}
                </Td>
              </tr>
            ) : null}
            {data && data.length === 0 ? (
              <tr>
                <Td colSpan={8} className="py-6 text-center text-muted-foreground">
                  {t("empty")}
                </Td>
              </tr>
            ) : null}
            {(data ?? []).map((p) => (
              <tr key={p.name}>
                <Td>
                  <span dir="ltr" className="font-mono text-xs">
                    {p.name}
                  </span>
                </Td>
                <Td>{t.has(`kinds.${p.kind}`) ? t(`kinds.${p.kind}`) : p.kind}</Td>
                <Td>
                  {p.baseUrl ? (
                    <span dir="ltr" className="font-mono text-xs break-all">
                      {p.baseUrl}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t("defaultUrl")}</span>
                  )}
                </Td>
                <Td>{p.hasApiKey ? <Badge tone="success">{t("keySet")}</Badge> : <Badge>{t("noKey")}</Badge>}</Td>
                <Td>{p.enabled ? <Badge tone="success">{t("enabled")}</Badge> : <Badge tone="danger">{t("disabled")}</Badge>}</Td>
                <Td>
                  <SourceBadge source={p.source} />
                </Td>
                <Td className="text-xs">
                  {p.lastTestedAt ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="whitespace-nowrap">{formatJalaliDateTime(p.lastTestedAt)}</span>
                      {p.lastTestError ? (
                        <span dir="auto" className="text-danger-foreground break-all">
                          {p.lastTestError}
                        </span>
                      ) : (
                        <span className="text-success-foreground">{t("testOk")}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Td>
                {canManage ? (
                  <Td>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(p)} aria-label={t("editLabel", { name: p.name })}>
                        {t("edit")}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setTesting(p)} aria-label={t("testLabel", { name: p.name })}>
                        {t("test")}
                      </Button>
                    </div>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <ProviderDialog
        provider={editing}
        existing={(data ?? []).map((p) => p.name)}
        onClose={() => setEditing(null)}
        onDone={(name) => {
          setEditing(null);
          setSaved(name);
        }}
      />
      <ProviderTestDialog provider={testing} onClose={() => setTesting(null)} />
    </div>
  );
}
