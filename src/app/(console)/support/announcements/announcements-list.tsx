"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Pager } from "@/components/ui/pager";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import { ANNOUNCEMENT_SEVERITIES, ANNOUNCEMENT_STATES, type AdminAnnouncement, type PagedResult } from "@/lib/api/types";
import { formatJalaliDateTime } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { toFormValues, toRequest, type AnnouncementFormValues } from "./announcement-values";

const PAGE_SIZE = 25;
const STATE_TONE: Record<string, "success" | "info" | "neutral"> = { active: "success", scheduled: "info", ended: "neutral" };
export const SEVERITY_TONE: Record<string, "info" | "warning" | "danger"> = { info: "info", warning: "warning", critical: "danger" };

/** Platform announcements (AD-2.6): the banner sellers see in their panel. Support writes them. */
export function AnnouncementsList() {
  const t = useTranslations("announcements");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const state = ANNOUNCEMENT_STATES.find((s) => s === params.get("state")) ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [editing, setEditing] = useState<AdminAnnouncement | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (state) query.set("state", state);
  const list = useQuery({
    queryKey: ["announcements", query.toString()],
    queryFn: () => admin<PagedResult<AdminAnnouncement>>(`/announcements?${query}`),
    placeholderData: keepPreviousData,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["announcements"] });

  const act = useMutation({
    mutationFn: ({ a, kind }: { a: AdminAnnouncement; kind: "end" | "delete" }) =>
      kind === "end" ? admin(`/announcements/${a.id}/end`, { method: "POST", body: {} }) : admin(`/announcements/${a.id}`, { method: "DELETE" }),
    onSuccess: () => {
      setNotice(null);
      refresh();
    },
  });

  const navigate = (next: { state?: string; page?: number }) => {
    const m = { state, page: 1, ...next };
    const out = new URLSearchParams();
    if (m.state) out.set("state", m.state);
    if (m.page > 1) out.set("page", String(m.page));
    router.replace(out.size ? `${pathname}?${out}` : pathname, { scroll: false });
  };

  if (list.error instanceof ApiError && list.error.status === 404) return <Alert tone="warning">{t("notAvailable")}</Alert>;
  const canManage = staff.can("announcements.manage");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("stateFilter")}
          <select value={state} onChange={(e) => navigate({ state: e.target.value })} className="h-10 min-w-36 rounded-md border border-border bg-surface px-2 text-sm font-normal">
            <option value="">{t("allStates")}</option>
            {ANNOUNCEMENT_STATES.map((s) => (
              <option key={s} value={s}>
                {t(`states.${s}`)}
              </option>
            ))}
          </select>
        </label>
        {canManage ? <Button onClick={() => setEditing("new")}>{t("create")}</Button> : null}
      </div>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {list.error ? <Alert tone="danger">{errorMessage(list.error)}</Alert> : null}
      {act.error ? <Alert tone="danger">{errorMessage(act.error)}</Alert> : null}
      {list.isPending && !list.error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}

      {list.data ? (
        <Card className={list.isFetching ? "opacity-70" : undefined}>
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.title")}</Th>
                <Th>{t("columns.severity")}</Th>
                <Th>{t("columns.when")}</Th>
                <Th>{t("columns.state")}</Th>
                {canManage ? <Th>{t("columns.actions")}</Th> : null}
              </tr>
            </thead>
            <tbody>
              {list.data.items.length === 0 ? (
                <tr>
                  <Td colSpan={canManage ? 5 : 4} className="py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </Td>
                </tr>
              ) : null}
              {list.data.items.map((a) => (
                <tr key={a.id} data-testid="announcement-row">
                  <Td>
                    <div className="font-medium">{a.title}</div>
                    {a.body ? <div className="max-w-md text-xs text-muted-foreground">{a.body}</div> : null}
                    {a.link ? (
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        {a.link}
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge tone={SEVERITY_TONE[a.severity] ?? "info"}>{t.has(`severities.${a.severity}`) ? t(`severities.${a.severity}`) : a.severity}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    <div>{t("from", { date: formatJalaliDateTime(a.startsAt) })}</div>
                    <div>{a.endsAt ? t("until", { date: formatJalaliDateTime(a.endsAt) }) : t("untilEnded")}</div>
                  </Td>
                  <Td>
                    <Badge tone={STATE_TONE[a.state] ?? "neutral"}>{t.has(`states.${a.state}`) ? t(`states.${a.state}`) : a.state}</Badge>
                  </Td>
                  {canManage ? (
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                          {t("edit")}
                        </Button>
                        {a.state !== "ended" ? (
                          <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ a, kind: "end" })}>
                            {t("end")}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={act.isPending}
                          onClick={() => {
                            if (window.confirm(t("deleteConfirm", { title: a.title }))) act.mutate({ a, kind: "delete" });
                          }}
                        >
                          {t("delete")}
                        </Button>
                      </div>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} pageSize={PAGE_SIZE} totalCount={list.data.totalCount} onPage={(p) => navigate({ page: p })} />
        </Card>
      ) : null}

      {editing ? (
        <AnnouncementDialog
          announcement={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            setNotice(t("saved"));
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function AnnouncementDialog({ announcement, onClose, onDone }: { announcement: AdminAnnouncement | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("announcements");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const [values, setValues] = useState<AnnouncementFormValues>(() => toFormValues(announcement));
  const set = (patch: Partial<AnnouncementFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const save = useMutation({
    mutationFn: () =>
      announcement
        ? admin<AdminAnnouncement>(`/announcements/${announcement.id}`, { method: "PUT", body: toRequest(values) })
        : admin<AdminAnnouncement>("/announcements", { method: "POST", body: toRequest(values) }),
    onSuccess: onDone,
  });
  const errors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  const err = (field: string) => fieldError(errors[field]);

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent title={announcement ? t("edit") : t("create")} closeLabel={tc("close")}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label={t("form.title")} error={err("title")}>
            {({ id, describedBy, invalid }) => <Input id={id} maxLength={120} required value={values.title} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => set({ title: e.target.value })} />}
          </Field>
          <Field label={t("form.body")} error={err("body")}>
            {({ id, describedBy, invalid }) => <Textarea id={id} rows={3} maxLength={1000} value={values.body} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => set({ body: e.target.value })} />}
          </Field>
          <Field label={t("form.severity")} error={err("severity")}>
            {({ id, describedBy, invalid }) => (
              <select id={id} value={values.severity} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => set({ severity: e.target.value })} className="h-10 rounded-md border border-border bg-surface px-2 text-sm">
                {ANNOUNCEMENT_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {t(`severities.${s}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("form.link")} hint={t("form.linkHint")} error={err("link")}>
            {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" value={values.link} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => set({ link: e.target.value })} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.startsAt")} hint={t("form.startsAtHint")} error={err("startsAt")}>
              {({ id, describedBy, invalid }) => <Input id={id} type="datetime-local" dir="ltr" value={values.startsAt} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => set({ startsAt: e.target.value })} />}
            </Field>
            <Field label={t("form.endsAt")} hint={t("form.endsAtHint")} error={err("endsAt")}>
              {({ id, describedBy, invalid }) => <Input id={id} type="datetime-local" dir="ltr" value={values.endsAt} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => set({ endsAt: e.target.value })} />}
            </Field>
          </div>
          {save.error && !(save.error instanceof ApiError && Object.keys(errors).length) ? <Alert tone="danger">{errorMessage(save.error)}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {announcement ? t("form.save") : t("form.publish")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
