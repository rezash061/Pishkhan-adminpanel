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
import { WORKSPACE_INDUSTRIES, WORKSPACE_STATUSES, type AdminWorkspaceSummary, type PagedResult } from "@/lib/api/types";
import { formatJalaliDate, toLatinDigits, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { channelLabel, ChannelStatusBadge, WorkspaceStatusBadge } from "./workspace-badges";

const PAGE_SIZE = 25;

interface Filters {
  q: string;
  status: string;
  industry: string;
  page: number;
}

/**
 * Workspace search (admin plan 4.2, backend PR #19). `q` matches a workspace id, the owner's phone, or text in the name,
 * slug or an Instagram username. Every filter lives in the URL so a search can be shared.
 */
export function WorkspaceSearch() {
  const t = useTranslations("workspaces");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const current: Filters = {
    q: params.get("q") ?? "",
    status: WORKSPACE_STATUSES.find((s) => s === params.get("status")) ?? "",
    industry: WORKSPACE_INDUSTRIES.find((s) => s === params.get("industry")) ?? "",
    page: Math.max(1, Number(params.get("page") ?? 1) || 1),
  };
  const [text, setText] = useState(current.q);

  const query = new URLSearchParams({ page: String(current.page), pageSize: String(PAGE_SIZE) });
  if (current.q) query.set("q", current.q);
  if (current.status) query.set("status", current.status);
  if (current.industry) query.set("industry", current.industry);

  const { data, error, isPending, isFetching } = useQuery({
    queryKey: ["workspaces", query.toString()],
    queryFn: () => admin<PagedResult<AdminWorkspaceSummary>>(`/workspaces?${query}`),
    placeholderData: keepPreviousData,
  });

  const navigate = (next: Partial<Filters>) => {
    const merged = { ...current, page: 1, ...next };
    const q = new URLSearchParams();
    if (merged.q) q.set("q", merged.q);
    if (merged.status) q.set("status", merged.status);
    if (merged.industry) q.set("industry", merged.industry);
    if (merged.page > 1) q.set("page", String(merged.page));
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate({ q: toLatinDigits(text.trim()) });
  };

  const notAvailable = error instanceof ApiError && error.status === 404;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;
  const selectClass = "h-10 min-w-36 rounded-md border border-border bg-surface px-2 text-sm font-normal";

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
          <select value={current.status} onChange={(e) => navigate({ status: e.target.value })} className={selectClass}>
            <option value="">{t("filters.any")}</option>
            {WORKSPACE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("filters.industry")}
          <select value={current.industry} onChange={(e) => navigate({ industry: e.target.value })} className={selectClass}>
            <option value="">{t("filters.any")}</option>
            {WORKSPACE_INDUSTRIES.map((s) => (
              <option key={s} value={s}>
                {t(`industries.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notAvailable ? <Alert tone="warning">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      {isPending && !error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}

      {data ? (
        <Card className={isFetching ? "opacity-70" : undefined}>
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.name")}</Th>
                <Th>{t("columns.owner")}</Th>
                <Th>{t("columns.status")}</Th>
                <Th>{t("columns.industry")}</Th>
                <Th>{t("columns.channels")}</Th>
                <Th>{t("columns.members")}</Th>
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
              {data.items.map((w) => (
                <tr key={w.id} className="hover:bg-muted/50">
                  <Td>
                    <Link href={`/workspaces/${w.id}`} className="font-medium text-primary hover:underline">
                      {w.name}
                    </Link>
                    <div className="ltr text-start font-mono text-xs text-muted-foreground">{w.slug}</div>
                  </Td>
                  <Td>
                    {w.owner ? (
                      <>
                        <div>{w.owner.displayName ?? "—"}</div>
                        <div className="ltr text-start font-mono text-xs text-muted-foreground">{w.owner.maskedPhone}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <WorkspaceStatusBadge status={w.status} />
                  </Td>
                  <Td>{t.has(`industries.${w.industry}`) ? t(`industries.${w.industry}`) : w.industry}</Td>
                  <Td>
                    {w.channels.length === 0 ? (
                      <span className="text-muted-foreground">{t("noChannels")}</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {w.channels.map((c) => (
                          <li key={c.id} className="flex items-center gap-1.5">
                            <span dir="ltr" className="font-mono text-xs">{channelLabel(c)}</span>
                            <ChannelStatusBadge status={c.status} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Td>
                  <Td>{toPersianDigits(w.memberCount)}</Td>
                  <Td className="whitespace-nowrap">{formatJalaliDate(w.createdAt)}</Td>
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
