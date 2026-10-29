"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { AuditEntry, PagedResult } from "@/lib/api/types";
import { formatJalaliDateTime, toPersianDigits } from "@/lib/format";
import { parseJalaliDate } from "@/lib/jalali";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { AuditDetail } from "./audit-detail";

const PAGE_SIZE = 25;
const ENTITY_TYPES = ["staff", "staff_session", "workspace", "membership", "invitation", "channel_account", "file", "plan", "data_deletion_request"] as const;
const TEXT_FILTERS = ["actor", "action", "entityType", "workspaceId", "from", "to"] as const;
type Filters = Record<(typeof TEXT_FILTERS)[number], string>;

/** Filters live in the URL (Jalali dates as typed) so a filtered view can be pasted into a support chat. */
export function AuditLog() {
  const t = useTranslations("audit");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const current = Object.fromEntries(TEXT_FILTERS.map((k) => [k, params.get(k) ?? ""])) as Filters;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);

  const { register, handleSubmit, reset, setError, formState } = useForm<Filters>({ values: current });

  const apiQuery = new URLSearchParams();
  for (const k of ["actor", "action", "entityType", "workspaceId"] as const) if (current[k]) apiQuery.set(k, current[k]);
  const from = current.from ? parseJalaliDate(current.from) : null;
  const to = current.to ? parseJalaliDate(current.to, true) : null;
  if (from) apiQuery.set("from", from.toISOString());
  if (to) apiQuery.set("to", to.toISOString());
  apiQuery.set("page", String(page));
  apiQuery.set("pageSize", String(PAGE_SIZE));

  const { data, error, isPending, isFetching } = useQuery({
    queryKey: ["audit", apiQuery.toString()],
    queryFn: () => admin<PagedResult<AuditEntry>>(`/audit?${apiQuery}`),
    placeholderData: keepPreviousData,
  });

  const navigate = (next: Partial<Filters> & { page?: number }) => {
    const q = new URLSearchParams();
    for (const k of TEXT_FILTERS) {
      const v = (next[k] ?? "").trim();
      if (v) q.set(k, v);
    }
    if (next.page && next.page > 1) q.set("page", String(next.page));
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const onSubmit = handleSubmit((values) => {
    let valid = true;
    for (const k of ["from", "to"] as const) {
      if (values[k].trim() && !parseJalaliDate(values[k])) {
        setError(k, { message: t("filters.invalidDate") });
        valid = false;
      }
    }
    if (valid) navigate({ ...values, page: 1 });
  });

  const notAvailable = error instanceof ApiError && error.status === 404;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" noValidate>
          <Field label={t("filters.actor")}>{({ id }) => <Input id={id} {...register("actor")} />}</Field>
          <Field label={t("filters.action")}>{({ id }) => <Input id={id} dir="ltr" {...register("action")} />}</Field>
          <Field label={t("filters.entityType")}>
            {({ id }) => (
              <select id={id} className="h-10 rounded-md border border-border bg-surface px-2 text-sm" {...register("entityType")}>
                <option value="">{t("filters.anyEntity")}</option>
                {ENTITY_TYPES.map((e) => (
                  <option key={e} value={e}>
                    {t(`entities.${e}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("filters.workspaceId")}>{({ id }) => <Input id={id} dir="ltr" {...register("workspaceId")} />}</Field>
          <Field label={t("filters.from")} error={formState.errors.from?.message}>
            {({ id, invalid }) => <Input id={id} dir="ltr" placeholder={t("filters.datePlaceholder")} aria-invalid={invalid} {...register("from")} />}
          </Field>
          <Field label={t("filters.to")} error={formState.errors.to?.message}>
            {({ id, invalid }) => <Input id={id} dir="ltr" placeholder={t("filters.datePlaceholder")} aria-invalid={invalid} {...register("to")} />}
          </Field>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
            <Button type="submit">{tc("apply")}</Button>
            <Button
              variant="secondary"
              onClick={() => {
                reset({ actor: "", action: "", entityType: "", workspaceId: "", from: "", to: "" });
                navigate({});
              }}
            >
              {tc("clear")}
            </Button>
          </div>
        </form>
      </Card>

      {notAvailable ? <Alert tone="warning">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      {isPending && !error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}

      {data ? (
        <Card className={isFetching ? "opacity-70" : undefined}>
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.occurredAt")}</Th>
                <Th>{t("columns.actor")}</Th>
                <Th>{t("columns.action")}</Th>
                <Th>{t("columns.entity")}</Th>
                <Th>{t("columns.workspace")}</Th>
                <Th>{t("columns.reason")}</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </Td>
                </tr>
              ) : null}
              {data.items.map((e) => (
                <tr
                  key={e.id}
                  tabIndex={0}
                  onClick={() => setSelected(e)}
                  onKeyDown={(k) => (k.key === "Enter" || k.key === " ") && (k.preventDefault(), setSelected(e))}
                  className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
                >
                  <Td className="whitespace-nowrap">{formatJalaliDateTime(e.occurredAt)}</Td>
                  <Td>
                    <span className="ltr">{e.actorName}</span> <Badge>{t(`actorTypes.${e.actorType}`)}</Badge>
                  </Td>
                  <Td className="ltr text-start font-mono text-xs">{e.action}</Td>
                  <Td>{t.has(`entities.${e.entityType}`) ? t(`entities.${e.entityType}`) : e.entityType}</Td>
                  <Td className="ltr text-start font-mono text-xs">{e.workspaceId ? `${e.workspaceId.slice(0, 8)}…` : "—"}</Td>
                  <Td className="max-w-64 truncate">{e.reason ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">{tc("total", { count: data.totalCount })}</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => navigate({ ...current, page: page - 1 })}>
                {tc("previous")}
              </Button>
              <span>{tc("pageOf", { page: toPersianDigits(page), pages: toPersianDigits(pages) })}</span>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => navigate({ ...current, page: page + 1 })}>
                {tc("next")}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
      <AuditDetail entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
