"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { StepUpCancelled, useStepUp } from "@/components/console/step-up";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Pager } from "@/components/ui/pager";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { AdminBaleBot, BaleCheckResult, MessagingOverview, PagedResult, SmsLogItem } from "@/lib/api/types";
import { formatJalaliDateTime, formatNumber, formatToman } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";

const BOT_TONE: Record<string, "success" | "warning" | "neutral"> = { active: "success", reauth_required: "warning", disconnected: "neutral" };
const BOT_STATUSES = ["active", "reauth_required", "disconnected"] as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/** SMS provider and Bale (AD-2.4): state from configuration, last-day traffic, a test SMS (SuperAdmin) and sellers' Bale bots. */
export function MessagingPanel() {
  const t = useTranslations("messaging");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { data, error, isPending } = useQuery({ queryKey: ["platform-messaging"], queryFn: () => admin<MessagingOverview>("/platform/messaging") });

  if (error instanceof ApiError && error.status === 404) return <Alert tone="warning">{t("notAvailable")}</Alert>;
  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  if (isPending || !data) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;

  const { provider, last24Hours } = data.sms;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card data-testid="sms-provider">
          <CardHeader>
            <CardTitle>{t("sms.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <Row label={t("sms.provider")}>{t.has(`sms.providers.${provider.provider}`) ? t(`sms.providers.${provider.provider}`) : provider.provider}</Row>
              <Row label={t("sms.configured")}>
                <Badge tone={provider.configured ? "success" : "danger"}>{provider.configured ? t("sms.configuredYes") : t("sms.configuredNo")}</Badge>
              </Row>
              {provider.otpTemplate ? (
                <Row label={t("sms.template")}>
                  <span dir="ltr">{provider.otpTemplate}</span>
                </Row>
              ) : null}
              <Row label={t("sms.credit")}>
                <span data-testid="sms-credit">{provider.credit === null ? t("sms.creditUnknown") : formatToman(provider.credit)}</span>
              </Row>
              <Row label={t("sms.last24")}>
                {t("sms.sent")}: {formatNumber(last24Hours.sent)} · {t("sms.failed")}: <span className={last24Hours.failed ? "text-danger" : undefined}>{formatNumber(last24Hours.failed)}</span>
              </Row>
            </dl>
            {provider.error ? (
              <Alert tone="warning" className="mt-3">
                {t("sms.error", { code: provider.error })}
              </Alert>
            ) : null}
            {Object.keys(last24Hours.byPurpose).length ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs" aria-label={t("sms.byPurpose")}>
                {Object.entries(last24Hours.byPurpose).map(([purpose, count]) => (
                  <Badge key={purpose}>
                    {t.has(`purposes.${purpose}`) ? t(`purposes.${purpose}`) : purpose}: {formatNumber(count)}
                  </Badge>
                ))}
              </div>
            ) : null}
            <Link href="/platform/sms-log" className="mt-3 inline-block text-sm text-primary hover:underline">
              {t("sms.logLink")}
            </Link>
          </CardContent>
        </Card>
        <Card data-testid="bale-settings">
          <CardHeader>
            <CardTitle>{t("bale.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <Row label={t("bale.apiBaseUrl")}>
                <span dir="ltr">{data.bale.apiBaseUrl}</span>
              </Row>
              <Row label={t("bale.webhookBaseUrl")}>
                <span dir="ltr">{data.bale.webhookBaseUrl}</span>
              </Row>
              <Row label={t("bale.secret")}>
                <Badge tone={data.bale.webhookSecretSet ? "success" : "danger"}>{data.bale.webhookSecretSet ? t("bale.secretSet") : t("bale.secretMissing")}</Badge>
              </Row>
              <Row label={t("bale.bots")}>
                {BOT_STATUSES.map((s) => `${t(`bale.statuses.${s}`)}: ${formatNumber(data.bale.bots[s] ?? 0)}`).join(" · ")}
              </Row>
            </dl>
          </CardContent>
        </Card>
      </div>
      <TestSms />
      <BaleBots />
    </div>
  );
}

function TestSms() {
  const t = useTranslations("messaging");
  const staff = useStaff();
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const withStepUp = useStepUp();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const send = useMutation({
    mutationFn: () => withStepUp(() => admin<SmsLogItem>("/platform/sms/test", { method: "POST", body: { phone } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform-messaging"] });
      void queryClient.invalidateQueries({ queryKey: ["sms-log"] });
    },
  });
  if (!staff.can("platform.sms.test")) return null;
  const phoneError = send.error instanceof ApiError && send.error.fieldErrors.phone ? fieldError(send.error.fieldErrors.phone) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("test.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("test.description")}</p>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <Field label={t("test.phone")} error={phoneError} className="w-64">
            {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" inputMode="tel" value={phone} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
          <Button type="submit" disabled={send.isPending || !phone.trim()}>
            {t("test.send")}
          </Button>
        </form>
        {send.data ? (
          <Alert tone="success" className="mt-3">
            {t("test.sent", { phone: send.data.phone })}
          </Alert>
        ) : null}
        {send.error && !phoneError && !(send.error instanceof StepUpCancelled) ? (
          <Alert tone="danger" className="mt-3">
            {errorMessage(send.error)}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BaleBots() {
  const t = useTranslations("messaging");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<BaleCheckResult | null>(null);
  const query = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (status) query.set("status", status);
  const list = useQuery({
    queryKey: ["bale-bots", query.toString()],
    queryFn: () => admin<PagedResult<AdminBaleBot>>(`/platform/bale/bots?${query}`),
    placeholderData: keepPreviousData,
  });
  const check = useMutation({
    mutationFn: (bot: AdminBaleBot) => admin<BaleCheckResult>(`/platform/bale/bots/${bot.id}/check`, { method: "POST", body: {} }),
    onSuccess: (r) => {
      setResult(r);
      void queryClient.invalidateQueries({ queryKey: ["bale-bots"] });
      void queryClient.invalidateQueries({ queryKey: ["platform-messaging"] });
    },
    onError: () => setResult(null),
  });
  const canCheck = staff.can("platform.bale.check");

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{t("bale.bots")}</CardTitle>
        <label className="flex items-center gap-2 text-sm">
          <span>{t("bale.columns.status")}</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          >
            <option value="">{t("bale.allStatuses")}</option>
            {BOT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`bale.statuses.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </CardHeader>
      {result ? (
        <CardContent>
          <Alert tone={result.result === "ok" ? "success" : "warning"} data-testid="bale-check-result">
            {t(`bale.results.${result.result === "ok" || result.result === "invalid_token" ? result.result : "unavailable"}`, { bot: `@${result.bot.username ?? result.bot.botId}` })}
          </Alert>
        </CardContent>
      ) : null}
      {check.error ? (
        <CardContent>
          <Alert tone="danger">{errorMessage(check.error)}</Alert>
        </CardContent>
      ) : null}
      {list.error ? (
        <CardContent>
          <Alert tone="danger">{errorMessage(list.error)}</Alert>
        </CardContent>
      ) : !list.data ? (
        <CardContent className="text-sm text-muted-foreground">{tc("loading")}</CardContent>
      ) : list.data.items.length === 0 ? (
        <CardContent className="text-sm text-muted-foreground">{t("bale.botsEmpty")}</CardContent>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>{t("bale.columns.bot")}</Th>
                <Th>{t("bale.columns.workspace")}</Th>
                <Th>{t("bale.columns.status")}</Th>
                <Th>{t("bale.columns.since")}</Th>
                {canCheck ? <Th>{t("bale.columns.actions")}</Th> : null}
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((bot) => (
                <tr key={bot.id} data-testid={`bale-bot-${bot.username ?? bot.botId}`}>
                  <Td>
                    <div dir="ltr" className="text-start font-mono text-sm">
                      @{bot.username ?? bot.botId}
                    </div>
                    {bot.displayName ? <div className="text-xs text-muted-foreground">{bot.displayName}</div> : null}
                  </Td>
                  <Td>
                    <Link href={`/workspaces/${bot.workspaceId}`} className="text-primary hover:underline">
                      {bot.workspaceName ?? bot.workspaceId.slice(-8)}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={BOT_TONE[bot.status] ?? "neutral"}>{t.has(`bale.statuses.${bot.status}`) ? t(`bale.statuses.${bot.status}`) : bot.status}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{formatJalaliDateTime(bot.statusChangedAt ?? bot.createdAt)}</Td>
                  {canCheck ? (
                    <Td>
                      {bot.status !== "disconnected" ? (
                        <Button size="sm" variant="secondary" disabled={check.isPending} onClick={() => check.mutate(bot)}>
                          {t("bale.check")}
                        </Button>
                      ) : null}
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} pageSize={25} totalCount={list.data.totalCount} onPage={setPage} />
        </>
      )}
    </Card>
  );
}
