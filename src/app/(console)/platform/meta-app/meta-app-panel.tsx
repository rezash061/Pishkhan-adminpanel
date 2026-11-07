"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { MetaApp } from "@/lib/api/types";
import { formatNumber, formatRelative } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

const REJECTED = new Set(["bad_signature", "bad_json", "too_large", "produce_failed"]);
const ACCOUNT_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { active: "success", token_expiring: "warning", reauth_required: "danger", disconnected: "neutral" };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/** Meta app page: what the Api host is configured with, how Instagram webhooks fared in the last day, and accounts by status. */
export function MetaAppPanel() {
  const t = useTranslations("metaApp");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { data, error, isPending } = useQuery({ queryKey: ["platform-meta-app"], queryFn: () => admin<MetaApp>("/platform/meta-app"), refetchInterval: 60_000 });

  if (error instanceof ApiError && error.status === 404) return <Alert tone="warning">{t("notAvailable")}</Alert>;
  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  if (isPending || !data) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;

  const setBadge = (set: boolean) => <Badge tone={set ? "success" : "danger"}>{set ? t("set") : t("notSet")}</Badge>;
  const results = Object.entries(data.webhooks.last24Hours).sort((a, b) => b[1] - a[1]);
  const rejected = results.filter(([r]) => REJECTED.has(r)).reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card data-testid="meta-settings">
        <CardHeader>
          <CardTitle>{t("settings")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            <Row label={t("appId")}>
              <span dir="ltr">{data.appId || "—"}</span>
            </Row>
            <Row label={t("apiVersion")}>
              <span dir="ltr">{data.apiVersion}</span>
            </Row>
            <Row label={t("graphBaseUrl")}>
              <span dir="ltr" className="break-all">{data.graphBaseUrl}</span>
            </Row>
            <Row label={t("redirectUri")}>
              <span dir="ltr" className="break-all">{data.redirectUri || "—"}</span>
            </Row>
            <Row label={t("appSecret")}>{setBadge(data.appSecretSet)}</Row>
            <Row label={t("verifyToken")}>{setBadge(data.webhookVerifyTokenSet)}</Row>
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">{t("scopes")}</p>
          <div className="mt-1 flex flex-wrap gap-1.5" dir="ltr">
            {data.scopes.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t("webhookFields")}</p>
          <div className="mt-1 flex flex-wrap gap-1.5" dir="ltr">
            {data.webhookFields.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card data-testid="meta-webhooks">
          <CardHeader>
            <CardTitle>{t("webhooks")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {rejected ? <Alert tone="warning">{t("problems", { count: rejected })}</Alert> : null}
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("none")}</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t("result")}</Th>
                    <Th>{t("count")}</Th>
                    <Th>{t("lastSeen")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(([result, count]) => (
                    <tr key={result} data-testid={`webhook-${result}`}>
                      <Td>
                        <Badge tone={result === "accepted" ? "success" : REJECTED.has(result) ? "danger" : "neutral"}>{t.has(`results.${result}`) ? t(`results.${result}`) : result}</Badge>
                      </Td>
                      <Td>{formatNumber(count)}</Td>
                      <Td>{data.webhooks.lastSeen[result] ? formatRelative(data.webhooks.lastSeen[result]) : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card data-testid="meta-accounts">
          <CardHeader>
            <CardTitle>{t("accounts")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.accounts).map(([status, count]) => (
                <Badge key={status} tone={ACCOUNT_TONE[status] ?? "neutral"}>
                  {t.has(`statuses.${status}`) ? t(`statuses.${status}`) : status}: {formatNumber(count)}
                </Badge>
              ))}
            </div>
            <p className="text-sm">{t("expiringSoon", { count: data.tokensExpiringSoon })}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
