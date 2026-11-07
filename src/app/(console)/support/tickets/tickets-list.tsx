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
import { TICKET_CATEGORIES, type AdminTicket, type PagedResult, type TicketCounts } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatNumber, formatRelative, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

const PAGE_SIZE = 25;
const TABS = ["open", "answered", "mine", "unassigned", "closed", "all"] as const;
type Tab = (typeof TABS)[number];

export const TICKET_TONE: Record<string, "warning" | "success" | "neutral"> = { open: "warning", answered: "success", closed: "neutral" };

/** The support queue (AD-2.6): tabs by status and owner, category and search in the URL, newest activity first. */
export function TicketsList() {
  const t = useTranslations("tickets");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const tab: Tab = TABS.find((x) => x === params.get("tab")) ?? "open";
  const category = TICKET_CATEGORIES.find((c) => c === params.get("category")) ?? "";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [search, setSearch] = useState(q);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (tab === "open" || tab === "answered" || tab === "closed") query.set("status", tab);
  if (tab === "mine") query.set("assigned", "me");
  if (tab === "unassigned") query.set("assigned", "none");
  if (category) query.set("category", category);
  if (q) query.set("q", q);

  const list = useQuery({
    queryKey: ["support-tickets", query.toString()],
    queryFn: () => admin<PagedResult<AdminTicket>>(`/support/tickets?${query}`),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({ queryKey: ["support-ticket-counts"], queryFn: () => admin<TicketCounts>("/support/tickets/counts") });

  const navigate = (next: { tab?: Tab; category?: string; q?: string; page?: number }) => {
    const m = { tab, category, q, page: 1, ...next };
    const out = new URLSearchParams();
    if (m.tab !== "open") out.set("tab", m.tab);
    if (m.category) out.set("category", m.category);
    if (m.q) out.set("q", m.q);
    if (m.page > 1) out.set("page", String(m.page));
    router.replace(out.size ? `${pathname}?${out}` : pathname, { scroll: false });
  };

  if (list.error instanceof ApiError && list.error.status === 404) return <Alert tone="warning">{t("notAvailable")}</Alert>;

  const countOf = (x: Tab): number | null => {
    const c = counts.data;
    if (!c) return null;
    return x === "all" ? null : c[x];
  };

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t("title")} className="flex flex-wrap gap-2">
        {TABS.map((x) => {
          const n = countOf(x);
          return (
            <button
              key={x}
              type="button"
              aria-pressed={tab === x}
              onClick={() => navigate({ tab: x })}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm",
                tab === x ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-muted",
              )}
            >
              {t(`tabs.${x}`)}
              {n !== null ? <span data-testid={`tab-count-${x}`}>{formatNumber(n)}</span> : null}
            </button>
          );
        })}
      </nav>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ q: search.trim() });
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("filters.q")}
          <Input value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("filters.category")}
          <select
            value={category}
            onChange={(e) => navigate({ category: e.target.value })}
            className="h-10 min-w-36 rounded-md border border-border bg-surface px-2 text-sm font-normal"
          >
            <option value="">{t("filters.allCategories")}</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
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
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.number")}</Th>
                <Th>{t("columns.subject")}</Th>
                <Th>{t("columns.workspace")}</Th>
                <Th>{t("columns.status")}</Th>
                <Th>{t("columns.assigned")}</Th>
                <Th>{t("columns.lastMessage")}</Th>
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
              {list.data.items.map((ticket) => (
                <tr key={ticket.id} data-testid={`ticket-${ticket.number}`}>
                  <Td className="whitespace-nowrap">{t("number", { number: toPersianDigits(ticket.number) })}</Td>
                  <Td>
                    <Link href={`/support/tickets/${ticket.id}`} className="font-medium text-primary hover:underline">
                      {ticket.subject}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {t.has(`categories.${ticket.category}`) ? t(`categories.${ticket.category}`) : ticket.category} · {t("messages", { count: ticket.messageCount })}
                    </div>
                  </Td>
                  <Td>{ticket.workspaceName ?? ticket.workspaceId.slice(-8)}</Td>
                  <Td>
                    <Badge tone={TICKET_TONE[ticket.status] ?? "neutral"}>{t.has(`statuses.${ticket.status}`) ? t(`statuses.${ticket.status}`) : ticket.status}</Badge>
                  </Td>
                  <Td className="text-sm">{ticket.assignedToName ?? (ticket.assignedTo ? ticket.assignedTo.slice(-8) : <span className="text-muted-foreground">{t("nobody")}</span>)}</Td>
                  <Td className="whitespace-nowrap text-xs">
                    <div>{formatRelative(ticket.lastMessageAt)}</div>
                    <div className="text-muted-foreground">{ticket.lastMessageBy === "staff" ? t("fromStaff") : t("fromSeller")}</div>
                  </Td>
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
