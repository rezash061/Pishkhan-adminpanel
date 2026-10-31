"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import { USER_STATUSES, type AdminUserSummary, type PagedResult } from "@/lib/api/types";
import { formatJalaliDate, formatJalaliDateTime, toLatinDigits, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { TotpBadge, UserStatusBadge } from "./user-badges";

const PAGE_SIZE = 25;

interface Filters {
  q: string;
  status: string;
  page: number;
}

/** User search (admin plan 4.3, backend PR #21): a full phone number, a user id or text in the display name. Filters live in the URL. */
export function UserSearch() {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const current: Filters = {
    q: params.get("q") ?? "",
    status: USER_STATUSES.find((s) => s === params.get("status")) ?? "",
    page: Math.max(1, Number(params.get("page") ?? 1) || 1),
  };
  const [text, setText] = useState(current.q);

  const query = new URLSearchParams({ page: String(current.page), pageSize: String(PAGE_SIZE) });
  if (current.q) query.set("q", current.q);
  if (current.status) query.set("status", current.status);

  const { data, error, isPending, isFetching } = useQuery({
    queryKey: ["users", query.toString()],
    queryFn: () => admin<PagedResult<AdminUserSummary>>(`/users?${query}`),
    placeholderData: keepPreviousData,
  });

  const navigate = (next: Partial<Filters>) => {
    const merged = { ...current, page: 1, ...next };
    const q = new URLSearchParams();
    if (merged.q) q.set("q", merged.q);
    if (merged.status) q.set("status", merged.status);
    if (merged.page > 1) q.set("page", String(merged.page));
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate({ q: toLatinDigits(text.trim()) });
  };

  const notAvailable = error instanceof ApiError && error.status === 404;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <form role="search" onSubmit={onSearch} className="flex min-w-72 flex-1 items-end gap-2">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
            {t("filters.q")}
            <Input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("filters.qPlaceholder")} maxLength={100} autoComplete="off" spellCheck={false} />
          </label>
          <Button type="submit">{tc("search")}</Button>
        </form>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("filters.status")}
          <select value={current.status} onChange={(e) => navigate({ status: e.target.value })} className="h-10 min-w-36 rounded-md border border-border bg-surface px-2 text-sm font-normal">
            <option value="">{t("filters.any")}</option>
            {USER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{t("phoneNote")}</p>

      {notAvailable ? <Alert tone="warning">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      {isPending && !error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}

      {data ? (
        <Card className={isFetching ? "opacity-70" : undefined}>
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.name")}</Th>
                <Th>{t("columns.phone")}</Th>
                <Th>{t("columns.status")}</Th>
                <Th>{t("columns.totp")}</Th>
                <Th>{t("columns.devices")}</Th>
                <Th>{t("columns.lastLogin")}</Th>
                <Th>{t("columns.createdAt")}</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </Td>
                </tr>
              ) : null}
              {data.items.map((u) => (
                <tr key={u.id} className="hover:bg-muted/50">
                  <Td>
                    <Link href={`/users/${u.id}`} className="font-medium text-primary hover:underline">
                      {u.displayName ?? t("noName")}
                    </Link>
                  </Td>
                  <Td className="ltr text-start font-mono text-xs">{u.maskedPhone}</Td>
                  <Td>
                    <UserStatusBadge status={u.status} />
                  </Td>
                  <Td>
                    <TotpBadge enabled={u.totpEnabled} />
                  </Td>
                  <Td>{toPersianDigits(u.activeSessions)}</Td>
                  <Td className="whitespace-nowrap">{u.lastLoginAt ? formatJalaliDateTime(u.lastLoginAt) : "—"}</Td>
                  <Td className="whitespace-nowrap">{formatJalaliDate(u.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">{tc("total", { count: data.totalCount })}</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={current.page <= 1} onClick={() => navigate({ page: current.page - 1 })}>
                {tc("previous")}
              </Button>
              <span>{tc("pageOf", { page: toPersianDigits(current.page), pages: toPersianDigits(pages) })}</span>
              <Button variant="secondary" size="sm" disabled={current.page >= pages} onClick={() => navigate({ page: current.page + 1 })}>
                {tc("next")}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
