"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { StaffSession } from "@/lib/api/types";
import { formatJalaliDateTime, formatRelative } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

/** A short device name from a user agent: browser and system, enough to tell sign-ins apart. */
export function deviceName(userAgent: string | null): string {
  if (!userAgent) return "—";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : null;
  const system = /Windows/.test(userAgent) ? "Windows" : /Android/.test(userAgent) ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS" : /Mac OS X/.test(userAgent) ? "macOS" : /Linux/.test(userAgent) ? "Linux" : null;
  return [browser, system].filter(Boolean).join(" · ") || userAgent.slice(0, 40);
}

/** The signed-in staff member's own sessions (`/admin/v1/me/sessions`), with "end this session" for the others. */
export function SessionsCard() {
  const t = useTranslations("settings.sessions");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const { data, error, isPending } = useQuery({ queryKey: ["my-sessions"], queryFn: () => admin<StaffSession[]>("/me/sessions") });
  const revoke = useMutation({
    mutationFn: (id: string) => admin<void>(`/me/sessions/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setNotice(t("revoked"));
      await queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {revoke.error ? <Alert tone="danger">{errorMessage(revoke.error)}</Alert> : null}
        {isPending && !error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}
        {error instanceof ApiError && error.status === 404 ? <Alert tone="info">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
        {data && data.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
        {data && data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>{t("device")}</Th>
                <Th>{t("ip")}</Th>
                <Th>{t("started")}</Th>
                <Th>{t("lastActive")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} data-testid={`session-${s.id}`}>
                  <Td title={s.userAgent ?? undefined}>{deviceName(s.userAgent)}</Td>
                  <Td className="font-mono text-xs" dir="ltr">
                    {s.ip ?? "—"}
                  </Td>
                  <Td className="whitespace-nowrap">{formatJalaliDateTime(s.startedAt)}</Td>
                  <Td className="whitespace-nowrap" title={formatJalaliDateTime(s.lastActiveAt)}>
                    {formatRelative(s.lastActiveAt)}
                  </Td>
                  <Td>
                    {s.current ? (
                      <Badge tone="info">{t("current")}</Badge>
                    ) : (
                      <Button size="sm" variant="secondary" disabled={revoke.isPending} onClick={() => revoke.mutate(s.id)}>
                        {t("revoke")}
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
