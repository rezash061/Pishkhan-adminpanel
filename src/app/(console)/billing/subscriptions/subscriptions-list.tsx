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
import { SUBSCRIPTION_STATES, type AdminSubscriptionRow, type PagedResult } from "@/lib/api/types";
import { formatJalaliDate } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

const PAGE_SIZE = 25;
export const SUBSCRIPTION_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  active: "success",
  trialing: "info",
  scheduled: "neutral",
  expired: "warning",
  ended: "neutral",
};

/** Subscriptions across workspaces (admin plan 4.4). Filters live in the URL. */
export function SubscriptionsList() {
  const t = useTranslations("billing");
  const tw = useTranslations("workspaces.billing");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const state = SUBSCRIPTION_STATES.find((s) => s === params.get("state")) ?? "current";
  const planCode = params.get("planCode") ?? "";
  const workspaceId = params.get("workspaceId") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [planInput, setPlanInput] = useState(planCode);
  const [workspaceInput, setWorkspaceInput] = useState(workspaceId);

  const query = new URLSearchParams({ state, page: String(page), pageSize: String(PAGE_SIZE) });
  if (planCode) query.set("planCode", planCode);
  if (workspaceId) query.set("workspaceId", workspaceId);

  const list = useQuery({
    queryKey: ["billing-subscriptions", query.toString()],
    queryFn: () => admin<PagedResult<AdminSubscriptionRow>>(`/billing/subscriptions?${query}`),
    placeholderData: keepPreviousData,
  });

  const navigate = (next: { state?: string; planCode?: string; workspaceId?: string; page?: number }) => {
    const m = { state, planCode, workspaceId, page: 1, ...next };
    const q = new URLSearchParams();
    if (m.state !== "current") q.set("state", m.state);
    if (m.planCode) q.set("planCode", m.planCode);
    if (m.workspaceId) q.set("workspaceId", m.workspaceId);
    if (m.page > 1) q.set("page", String(m.page));
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  if (list.error instanceof ApiError && list.error.status === 404) return <Alert tone="warning">{t("notAvailable")}</Alert>;

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ planCode: planInput.trim(), workspaceId: workspaceInput.trim() });
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("subscriptions.filters.state")}
          <select value={state} onChange={(e) => navigate({ state: e.target.value })} className="h-10 min-w-40 rounded-md border border-border bg-surface px-2 text-sm font-normal">
            {SUBSCRIPTION_STATES.map((s) => (
              <option key={s} value={s}>
                {t(`subscriptions.stateFilters.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("subscriptions.filters.planCode")}
          <Input value={planInput} onChange={(e) => setPlanInput(e.target.value)} dir="ltr" className="w-40 font-mono text-xs" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("subscriptions.filters.workspaceId")}
          <Input value={workspaceInput} onChange={(e) => setWorkspaceInput(e.target.value)} dir="ltr" className="w-80 font-mono text-xs" />
        </label>
        <Button type="submit" variant="secondary">
          {t("apply")}
        </Button>
      </form>

      {list.error ? <Alert tone="danger">{errorMessage(list.error)}</Alert> : null}
      {list.isPending && !list.error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}

      {list.data ? (
        <Card className={list.isFetching ? "opacity-70" : undefined}>
          <Table>
            <thead>
              <tr>
                <Th>{t("subscriptions.columns.workspace")}</Th>
                <Th>{t("subscriptions.columns.plan")}</Th>
                <Th>{t("subscriptions.columns.state")}</Th>
                <Th>{t("subscriptions.columns.cycle")}</Th>
                <Th>{t("subscriptions.columns.startsAt")}</Th>
                <Th>{t("subscriptions.columns.endsAt")}</Th>
                <Th>{t("subscriptions.columns.payment")}</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="py-8 text-center text-muted-foreground">
                    {t("subscriptions.empty")}
                  </Td>
                </tr>
              ) : null}
              {list.data.items.map(({ subscription: s, workspaceId: ws, workspaceName }) => (
                <tr key={s.id} data-testid={`subscription-${s.id}`}>
                  <Td>
                    <Link href={`/workspaces/${ws}`} className="text-primary hover:underline">
                      {workspaceName ?? ws.slice(-8)}
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs" dir="ltr">
                    {s.planCode} v{s.planVersion}
                  </Td>
                  <Td>
                    <Badge tone={SUBSCRIPTION_TONE[s.state] ?? "neutral"}>{t.has(`subscriptions.states.${s.state}`) ? t(`subscriptions.states.${s.state}`) : s.state}</Badge>
                    {s.endReason ? <div className="mt-1 text-xs text-muted-foreground">{tw.has(`endReasons.${s.endReason}`) ? tw(`endReasons.${s.endReason}`) : s.endReason}</div> : null}
                  </Td>
                  <Td>{s.cycle && t.has(`cycles.${s.cycle}`) ? t(`cycles.${s.cycle}`) : "—"}</Td>
                  <Td className="whitespace-nowrap">{formatJalaliDate(s.startsAt)}</Td>
                  <Td className="whitespace-nowrap">{s.endsAt ? formatJalaliDate(s.endsAt) : t("subscriptions.noEnd")}</Td>
                  <Td>
                    {s.checkoutId ? (
                      <Link href={`/billing/payments/${s.checkoutId}`} className="text-primary hover:underline">
                        {t("subscriptions.paidBy")}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{t("subscriptions.granted")}</span>
                    )}
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
