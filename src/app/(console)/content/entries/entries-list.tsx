"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import { CONTENT_KINDS, CONTENT_STATUSES, type ContentEntrySummary, type PagedResult } from "@/lib/api/types";
import { formatJalaliDateTime, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { EntryStatusBadge, useKindLabel } from "../content-badges";

const PAGE_SIZE = 25;

/** CMS entries with kind, status and text filters in the URL (backend PR #31). */
export function EntriesList() {
  const t = useTranslations("content");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const kindLabel = useKindLabel();
  const staff = useStaff();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kind = params.get("kind") ?? "";
  const status = params.get("status") ?? "";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [text, setText] = useState(q);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), ...(kind ? { kind } : {}), ...(status ? { status } : {}), ...(q ? { q } : {}) });
  const { data, error, isPending } = useQuery({
    queryKey: ["content-entries", kind, status, q, page],
    queryFn: () => admin<PagedResult<ContentEntrySummary>>(`/content/entries?${query}`),
  });

  const go = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`);
  };
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1;
  const select = "h-10 rounded-md border border-border bg-surface px-2 text-sm";

  return (
    <div className="flex flex-col gap-4">
      {staff.can("content.manage") ? (
        <Link href="/content/entries/new" className="inline-flex h-10 items-center gap-2 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="size-4" aria-hidden />
          {t("create")}
        </Link>
      ) : null}
      <form
        role="search"
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: text.trim(), page: "" });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("filters.q")}</span>
          <Input type="search" value={text} onChange={(e) => setText(e.target.value)} className="w-64" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("filters.kind")}</span>
          <select className={select} value={kind} onChange={(e) => go({ kind: e.target.value, page: "" })}>
            <option value="">{t("filters.any")}</option>
            {CONTENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("filters.status")}</span>
          <select className={select} value={status} onChange={(e) => go({ status: e.target.value, page: "" })}>
            <option value="">{t("filters.any")}</option>
            {CONTENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary">
          {tc("search")}
        </Button>
      </form>
      {error instanceof ApiError && error.status === 404 ? <Alert tone="warning">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t("columns.title")}</Th>
              <Th>{t("columns.kind")}</Th>
              <Th>{t("columns.slug")}</Th>
              <Th>{t("columns.status")}</Th>
              <Th>{t("columns.publishedAt")}</Th>
              <Th>{t("columns.updatedAt")}</Th>
            </tr>
          </thead>
          <tbody>
            {isPending && !error ? (
              <tr>
                <Td colSpan={6} className="py-6 text-center text-muted-foreground">
                  {tc("loading")}
                </Td>
              </tr>
            ) : null}
            {data && data.items.length === 0 ? (
              <tr>
                <Td colSpan={6} className="py-6 text-center text-muted-foreground">
                  {t("empty")}
                </Td>
              </tr>
            ) : null}
            {(data?.items ?? []).map((e) => (
              <tr key={e.id}>
                <Td>
                  <Link href={`/content/entries/${e.id}`} className="font-medium text-primary hover:underline">
                    {e.title}
                  </Link>
                </Td>
                <Td>{kindLabel(e.kind)}</Td>
                <Td>
                  <span dir="auto" className="text-xs">
                    {e.slug}
                  </span>
                </Td>
                <Td>
                  <EntryStatusBadge status={e.status} scheduledAt={e.scheduledAt} changed={e.hasUnpublishedChanges} />
                </Td>
                <Td className="whitespace-nowrap">{e.scheduledAt ? t("scheduledFor", { at: formatJalaliDateTime(e.scheduledAt) }) : e.publishedAt ? formatJalaliDateTime(e.publishedAt) : "—"}</Td>
                <Td className="whitespace-nowrap">{formatJalaliDateTime(e.updatedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {data && pages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
            <span>{tc("pageOf", { page: toPersianDigits(page), pages: toPersianDigits(pages) })}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>
                {tc("previous")}
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => go({ page: String(page + 1) })}>
                {tc("next")}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
