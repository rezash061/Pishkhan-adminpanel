"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ReasonDialog } from "@/components/console/reason-dialog";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pager } from "@/components/ui/pager";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import { DEAD_LETTER_STATUSES, type DeadLetter, type DeadLetterActionResponse, type DeadLetterGroupCount, type PagedResult } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatJalaliDateTime, formatRelative, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

const PAGE_SIZE = 25;
export const STATUS_TONE: Record<string, "danger" | "success" | "neutral"> = { open: "danger", replayed: "success", discarded: "neutral" };

/** The handler's class name without its namespace, for narrow columns. */
export function shortConsumer(consumer: string): string {
  return consumer.split(".").pop() ?? consumer;
}

/** Dead letters per consumer group (AD-1.7): select open ones and replay or discard them (SuperAdmin, step-up, reason). */
export function DeadLettersList() {
  const t = useTranslations("deadLetters");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<"replay" | "discard" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const status = DEAD_LETTER_STATUSES.find((s) => s === params.get("status")) ?? "open";
  const group = params.get("group") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const query = new URLSearchParams({ status, page: String(page), pageSize: String(PAGE_SIZE) });
  if (group) query.set("group", group);

  const list = useQuery({
    queryKey: ["dead-letters", query.toString()],
    queryFn: () => admin<PagedResult<DeadLetter>>(`/platform/dead-letters?${query}`),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({ queryKey: ["dead-letters-summary"], queryFn: () => admin<DeadLetterGroupCount[]>("/platform/dead-letters/summary") });

  const navigate = (next: { status?: string; group?: string; page?: number }) => {
    const merged = { status, group, page: 1, ...next };
    const q = new URLSearchParams();
    if (merged.status !== "open") q.set("status", merged.status);
    if (merged.group) q.set("group", merged.group);
    if (merged.page > 1) q.set("page", String(merged.page));
    setSelected(new Set());
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  if (list.error instanceof ApiError && list.error.status === 404) return <Alert tone="warning">{t("notAvailable")}</Alert>;

  const canManage = staff.can("platform.dlq.manage");
  const openRows = list.data?.items.filter((d) => d.status === "open") ?? [];
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {summary.data ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8" data-testid="dlq-summary">
          {summary.data.map((g) => (
            <button
              key={g.group}
              type="button"
              onClick={() => navigate({ group: group === g.group ? "" : g.group })}
              className={cn("rounded-md border p-2 text-start text-sm", group === g.group ? "border-primary bg-primary/5" : "border-border bg-surface hover:bg-muted", g.open > 0 && "border-danger/60")}
            >
              <div className="font-mono text-xs" dir="ltr">
                {g.group}
              </div>
              <div className={cn("font-semibold", g.open > 0 ? "text-danger-foreground" : "text-muted-foreground")}>{t("openCount", { count: g.open })}</div>
              {g.oldestOpenAt ? <div className="text-xs text-muted-foreground">{t("oldest", { relative: formatRelative(g.oldestOpenAt) })}</div> : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("filters.status")}
          <select value={status} onChange={(e) => navigate({ status: e.target.value })} className="h-10 min-w-40 rounded-md border border-border bg-surface px-2 text-sm font-normal">
            {DEAD_LETTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </select>
        </label>
        {canManage ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("selected", { count: selected.size })}</span>
            <Button variant="primary" disabled={selected.size === 0} onClick={() => setAction("replay")}>
              {t("replay.label")}
            </Button>
            <Button variant="danger" disabled={selected.size === 0} onClick={() => setAction("discard")}>
              {t("discard.label")}
            </Button>
          </div>
        ) : null}
      </div>

      {list.error ? <Alert tone="danger">{errorMessage(list.error)}</Alert> : null}
      {list.isPending && !list.error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}

      {list.data ? (
        <Card className={list.isFetching ? "opacity-70" : undefined}>
          <Table>
            <thead>
              <tr>
                {canManage ? (
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      aria-label={t("selectAll")}
                      className="size-4 accent-primary"
                      disabled={openRows.length === 0}
                      checked={openRows.length > 0 && openRows.every((r) => selected.has(r.id))}
                      onChange={(e) => setSelected(e.target.checked ? new Set(openRows.map((r) => r.id)) : new Set())}
                    />
                  </Th>
                ) : null}
                <Th>{t("columns.type")}</Th>
                <Th>{t("columns.consumer")}</Th>
                <Th>{t("columns.error")}</Th>
                <Th>{t("columns.attempts")}</Th>
                <Th>{t("columns.failedAt")}</Th>
                <Th>{t("columns.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.length === 0 ? (
                <tr>
                  <Td colSpan={canManage ? 7 : 6} className="py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </Td>
                </tr>
              ) : null}
              {list.data.items.map((d) => (
                <tr key={d.id} data-testid={`dead-letter-${d.id}`}>
                  {canManage ? (
                    <Td>
                      <input
                        type="checkbox"
                        aria-label={t("select")}
                        className="size-4 accent-primary"
                        disabled={d.status !== "open"}
                        checked={selected.has(d.id)}
                        onChange={() => toggle(d.id)}
                      />
                    </Td>
                  ) : null}
                  <Td>
                    <Link href={`/platform/dead-letters/${d.id}`} className="font-mono text-xs text-primary hover:underline" dir="ltr">
                      {d.type}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground" dir="ltr">
                      {d.group}
                    </div>
                  </Td>
                  <Td className="font-mono text-xs" dir="ltr" title={d.consumer}>
                    {shortConsumer(d.consumer)}
                  </Td>
                  <Td className="max-w-80 truncate font-mono text-xs" dir="ltr" title={d.exceptionMessage}>
                    {d.exceptionMessage}
                  </Td>
                  <Td>{toPersianDigits(d.attempts)}</Td>
                  <Td className="whitespace-nowrap" title={formatJalaliDateTime(d.failedAt)}>
                    {formatRelative(d.failedAt)}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{t.has(`statuses.${d.status}`) ? t(`statuses.${d.status}`) : d.status}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} pageSize={PAGE_SIZE} totalCount={list.data.totalCount} onPage={(p) => navigate({ page: p })} />
        </Card>
      ) : null}

      <ReasonDialog<DeadLetterActionResponse>
        open={action !== null}
        title={action ? t(`${action}.title`) : ""}
        description={action ? t(`${action}.body`) : undefined}
        confirmLabel={action ? t(`${action}.confirm`) : ""}
        tone={action === "replay" ? "primary" : "danger"}
        stepUp
        onSubmit={(reason) => admin<DeadLetterActionResponse>(`/platform/dead-letters/${action}`, { method: "POST", body: { ids: [...selected], reason } })}
        onDone={async (result) => {
          setNotice([t(`${action!}.done`, { done: result.done }), result.skipped.length ? t("skipped", { count: result.skipped.length }) : ""].filter(Boolean).join(" "));
          setAction(null);
          setSelected(new Set());
          await queryClient.invalidateQueries({ queryKey: ["dead-letters"] });
          await queryClient.invalidateQueries({ queryKey: ["dead-letters-summary"] });
        }}
        onClose={() => setAction(null)}
      >
        <p className="text-sm">{t("selected", { count: selected.size })}</p>
      </ReasonDialog>
    </div>
  );
}
