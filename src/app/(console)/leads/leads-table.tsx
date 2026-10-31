"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { Lead, PagedResult } from "@/lib/api/types";
import { formatJalaliDateTime, maskPhone, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

const PAGE_SIZE = 25;
const TYPES = ["waitlist", "contact"] as const;

/** The type filter and page live in the URL so a filtered list can be shared. Phones stay masked until revealed. */
export function LeadsTable() {
  const t = useTranslations("leads");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<Lead | null>(null);

  const type = TYPES.find((v) => v === params.get("type")) ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (type) query.set("type", type);

  const { data, error, isPending, isFetching } = useQuery({
    queryKey: ["leads", query.toString()],
    queryFn: () => admin<PagedResult<Lead>>(`/leads?${query}`),
    placeholderData: keepPreviousData,
  });

  const navigate = (next: { type?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (next.type) q.set("type", next.type);
    if (next.page && next.page > 1) q.set("page", String(next.page));
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const toggle = (id: string) =>
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const notAvailable = error instanceof ApiError && error.status === 404;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("filters.type")}
          <select
            value={type}
            onChange={(e) => navigate({ type: e.target.value })}
            className="h-10 min-w-40 rounded-md border border-border bg-surface px-2 text-sm font-normal"
          >
            <option value="">{t("filters.any")}</option>
            {TYPES.map((v) => (
              <option key={v} value={v}>
                {t(`types.${v}`)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">{t("revealNote")}</p>
      </div>

      {notAvailable ? <Alert tone="warning">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      {isPending && !error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}

      {data ? (
        <Card className={isFetching ? "opacity-70" : undefined}>
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.createdAt")}</Th>
                <Th>{t("columns.type")}</Th>
                <Th>{t("columns.name")}</Th>
                <Th>{t("columns.phone")}</Th>
                <Th>{t("columns.instagram")}</Th>
                <Th>{t("columns.vertical")}</Th>
                <Th>{t("columns.monthlyDms")}</Th>
                <Th>{t("columns.submissions")}</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </Td>
                </tr>
              ) : null}
              {data.items.map((lead) => {
                const shown = revealed.has(lead.id);
                return (
                  <tr key={lead.id} className="hover:bg-muted/50">
                    <Td className="whitespace-nowrap">
                      <button type="button" className="text-primary hover:underline" onClick={() => setSelected(lead)}>
                        {formatJalaliDateTime(lead.createdAt)}
                      </button>
                    </Td>
                    <Td>
                      <Badge tone={lead.type === "waitlist" ? "info" : "neutral"}>{t.has(`types.${lead.type}`) ? t(`types.${lead.type}`) : lead.type}</Badge>
                    </Td>
                    <Td>{lead.name ?? "—"}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-1">
                        <span className="ltr font-mono text-xs" data-testid="lead-phone">
                          {shown ? lead.phone : maskPhone(lead.phone)}
                        </span>
                        <Button variant="ghost" size="icon" className="size-7" aria-label={shown ? t("hide") : t("reveal")} aria-pressed={shown} onClick={() => toggle(lead.id)}>
                          {shown ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
                        </Button>
                      </span>
                    </Td>
                    <Td className="ltr text-start">{lead.instagramHandle ? `@${lead.instagramHandle.replace(/^@/, "")}` : "—"}</Td>
                    <Td>{lead.vertical ?? "—"}</Td>
                    <Td>{lead.monthlyDms ?? "—"}</Td>
                    <Td>{toPersianDigits(lead.submissions)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">{tc("total", { count: data.totalCount })}</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => navigate({ type, page: page - 1 })}>
                {tc("previous")}
              </Button>
              <span>{tc("pageOf", { page: toPersianDigits(page), pages: toPersianDigits(pages) })}</span>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => navigate({ type, page: page + 1 })}>
                {tc("next")}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        {selected ? (
          <DialogContent title={t("detail.title")} closeLabel={tc("close")} className="max-w-lg">
            <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("columns.createdAt")}</dt>
              <dd>{formatJalaliDateTime(selected.createdAt)}</dd>
              <dt className="text-muted-foreground">{t("detail.updatedAt")}</dt>
              <dd>{formatJalaliDateTime(selected.updatedAt)}</dd>
              <dt className="text-muted-foreground">{t("columns.name")}</dt>
              <dd>{selected.name ?? t("detail.none")}</dd>
              <dt className="text-muted-foreground">{t("detail.message")}</dt>
              <dd className="whitespace-pre-wrap">{selected.message ?? t("detail.none")}</dd>
              <dt className="text-muted-foreground">{t("detail.utm")}</dt>
              <dd className="ltr text-start font-mono text-xs">
                {Object.keys(selected.utm).length === 0
                  ? t("detail.none")
                  : Object.entries(selected.utm).map(([k, v]) => (
                      <div key={k}>
                        {k}={v}
                      </div>
                    ))}
              </dd>
            </dl>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
