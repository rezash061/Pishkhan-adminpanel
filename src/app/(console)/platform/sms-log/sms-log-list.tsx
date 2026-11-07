"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Pager } from "@/components/ui/pager";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import { SMS_PURPOSES, type PagedResult, type SmsLogItem } from "@/lib/api/types";
import { formatJalaliDateTime, formatNumber } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

const PAGE_SIZE = 50;

/** Every SMS the platform sent (AD-2.4), filtered by phone, purpose and result in the URL. Phones are masked; texts are never kept. */
export function SmsLogList() {
  const t = useTranslations("smsLog");
  const tm = useTranslations("messaging");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const phone = params.get("phone") ?? "";
  const purpose = SMS_PURPOSES.find((p) => p === params.get("purpose")) ?? "";
  const status = ["sent", "failed"].find((s) => s === params.get("status")) ?? "";
  const workspaceId = params.get("workspaceId") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [phoneInput, setPhoneInput] = useState(phone);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (phone) query.set("phone", phone);
  if (purpose) query.set("purpose", purpose);
  if (status) query.set("status", status);
  if (workspaceId) query.set("workspaceId", workspaceId);
  const list = useQuery({
    queryKey: ["sms-log", query.toString()],
    queryFn: () => admin<PagedResult<SmsLogItem>>(`/platform/sms/log?${query}`),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const navigate = (next: { phone?: string; purpose?: string; status?: string; page?: number }) => {
    const m = { phone, purpose, status, page: 1, ...next };
    const out = new URLSearchParams();
    if (m.phone) out.set("phone", m.phone);
    if (m.purpose) out.set("purpose", m.purpose);
    if (m.status) out.set("status", m.status);
    if (workspaceId) out.set("workspaceId", workspaceId);
    if (m.page > 1) out.set("page", String(m.page));
    router.replace(out.size ? `${pathname}?${out}` : pathname, { scroll: false });
  };

  if (list.error instanceof ApiError && list.error.status === 404) return <Alert tone="warning">{tm("notAvailable")}</Alert>;
  const select = "h-10 min-w-32 rounded-md border border-border bg-surface px-2 text-sm font-normal";

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ phone: phoneInput.trim() });
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("filters.phone")}
          <Input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} dir="ltr" inputMode="tel" className="w-48" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("filters.purpose")}
          <select value={purpose} onChange={(e) => navigate({ purpose: e.target.value })} className={select}>
            <option value="">{t("filters.allPurposes")}</option>
            {SMS_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {tm(`purposes.${p}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("filters.status")}
          <select value={status} onChange={(e) => navigate({ status: e.target.value })} className={select}>
            <option value="">{t("filters.allStatuses")}</option>
            <option value="sent">{t("statuses.sent")}</option>
            <option value="failed">{t("statuses.failed")}</option>
          </select>
        </label>
        <Button type="submit" variant="secondary">
          {tc("apply")}
        </Button>
      </form>

      {list.error ? <Alert tone="danger">{errorMessage(list.error)}</Alert> : null}
      {list.isPending && !list.error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}

      {list.data ? (
        <Card className={list.isFetching ? "opacity-70" : undefined}>
          <p className="px-5 pt-4 text-sm text-muted-foreground">{tc("total", { count: list.data.totalCount })}</p>
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.time")}</Th>
                <Th>{t("columns.phone")}</Th>
                <Th>{t("columns.purpose")}</Th>
                <Th>{t("columns.workspace")}</Th>
                <Th>{t("columns.status")}</Th>
                <Th>{t("columns.parts")}</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </Td>
                </tr>
              ) : null}
              {list.data.items.map((s) => (
                <tr key={s.id} data-testid="sms-row">
                  <Td className="whitespace-nowrap text-xs">{formatJalaliDateTime(s.createdAt)}</Td>
                  <Td>
                    <span dir="ltr" className="font-mono text-sm">
                      {s.phone}
                    </span>
                  </Td>
                  <Td>
                    {tm.has(`purposes.${s.purpose}`) ? tm(`purposes.${s.purpose}`) : s.purpose}
                    {s.template ? <div className="text-xs text-muted-foreground">{t("template", { name: s.template })}</div> : null}
                  </Td>
                  <Td>
                    {s.workspaceId ? (
                      <Link href={`/workspaces/${s.workspaceId}`} className="text-primary hover:underline">
                        {s.workspaceName ?? s.workspaceId.slice(-8)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Badge tone={s.status === "sent" ? "success" : "danger"}>{t.has(`statuses.${s.status}`) ? t(`statuses.${s.status}`) : s.status}</Badge>
                    {s.error ? <div className="mt-1 max-w-xs text-xs text-danger">{s.error}</div> : null}
                  </Td>
                  <Td>{formatNumber(s.segments)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} pageSize={PAGE_SIZE} totalCount={list.data.totalCount} onPage={(p) => navigate({ page: p })} />
        </Card>
      ) : null}
    </div>
  );
}
