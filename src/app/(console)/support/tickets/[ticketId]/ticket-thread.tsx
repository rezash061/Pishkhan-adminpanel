"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { admin } from "@/lib/api/client";
import type { AdminTicket, AdminTicketDetail } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatJalaliDateTime, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { TICKET_TONE } from "../tickets-list";

/** One ticket: the conversation with the seller, a reply box, and take, release, close or reopen. */
export function TicketThread({ id }: { id: string }) {
  const t = useTranslations("tickets");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const staff = useStaff();
  const queryClient = useQueryClient();
  const key = ["support-ticket", id];
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);

  const { data, error, isPending } = useQuery({
    queryKey: key,
    queryFn: () => admin<AdminTicketDetail>(`/support/tickets/${encodeURIComponent(id)}`),
  });

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    void queryClient.invalidateQueries({ queryKey: ["support-ticket-counts"] });
  };

  const send = useMutation({
    mutationFn: (body: string) => admin<AdminTicketDetail>(`/support/tickets/${encodeURIComponent(id)}/messages`, { method: "POST", body: { body } }),
    onSuccess: (next) => {
      queryClient.setQueryData(key, next);
      setReply("");
      setReplyError(undefined);
      setNotice(t("sent"));
      refreshLists();
    },
    onError: (e) => {
      setNotice(null);
      setReplyError(e instanceof ApiError && e.fieldErrors.body ? fieldError(e.fieldErrors.body) : errorMessage(e));
    },
  });

  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) =>
      admin<AdminTicket>(`/support/tickets/${encodeURIComponent(id)}/${path}`, { method: "POST", body: body ?? {} }),
    onSuccess: (ticket) => {
      queryClient.setQueryData<AdminTicketDetail>(key, (old) => (old ? { ...old, ticket } : old));
      setNotice(null);
      refreshLists();
    },
  });

  const back = (
    <Link href="/support/tickets" className="text-sm text-primary hover:underline">
      {t("back")}
    </Link>
  );
  if (isPending && !error) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (error || !data) {
    return (
      <>
        <PageHeader title={t("title")} actions={back} />
        <Alert tone={error instanceof ApiError && error.status === 404 ? "warning" : "danger"}>{errorMessage(error)}</Alert>
      </>
    );
  }

  const ticket = data.ticket;
  const canManage = staff.can("tickets.manage");
  const mine = ticket.assignedTo === staff.id;

  return (
    <>
      <PageHeader title={`${t("number", { number: toPersianDigits(ticket.number) })} · ${ticket.subject}`} actions={back} />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm" data-testid="ticket-summary">
        <Badge tone={TICKET_TONE[ticket.status] ?? "neutral"}>{t.has(`statuses.${ticket.status}`) ? t(`statuses.${ticket.status}`) : ticket.status}</Badge>
        <span>{t.has(`categories.${ticket.category}`) ? t(`categories.${ticket.category}`) : ticket.category}</span>
        <Link href={`/workspaces/${ticket.workspaceId}`} className="text-primary hover:underline">
          {ticket.workspaceName ?? t("workspaceLink")}
        </Link>
        <span className="text-muted-foreground">{t("openedAt", { date: formatJalaliDateTime(ticket.createdAt) })}</span>
        <span data-testid="ticket-assignee">{ticket.assignedTo ? t("assignedTo", { name: ticket.assignedToName ?? ticket.assignedTo.slice(-8) }) : t("nobody")}</span>
      </div>

      {canManage ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {mine ? (
            <Button variant="secondary" size="sm" disabled={action.isPending} onClick={() => action.mutate({ path: "assign", body: { staffId: null } })}>
              {t("release")}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled={action.isPending} onClick={() => action.mutate({ path: "assign", body: { staffId: staff.id } })}>
              {t("takeIt")}
            </Button>
          )}
          {ticket.status === "closed" ? (
            <Button variant="secondary" size="sm" disabled={action.isPending} onClick={() => action.mutate({ path: "reopen" })}>
              {t("reopen")}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled={action.isPending} onClick={() => action.mutate({ path: "close" })}>
              {t("close")}
            </Button>
          )}
        </div>
      ) : null}
      {action.error ? (
        <Alert tone="danger" className="mb-4">
          {errorMessage(action.error)}
        </Alert>
      ) : null}

      <ol className="flex flex-col gap-3" aria-label={t("messages", { count: data.messages.length })} data-testid="ticket-messages">
        {data.messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              "max-w-3xl rounded-lg border p-4",
              m.authorKind === "staff" ? "ms-auto border-primary/30 bg-primary/5" : "me-auto border-border bg-surface",
            )}
          >
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{m.authorName ?? (m.authorKind === "staff" ? t("staff") : t("seller"))}</span>
              <span>{m.authorKind === "staff" ? t("staff") : t("seller")}</span>
              <time dateTime={m.createdAt}>{formatJalaliDateTime(m.createdAt)}</time>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-7">{m.body}</p>
          </li>
        ))}
      </ol>

      {canManage ? (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const body = reply.trim();
                if (!body) return setReplyError(t("reply"));
                send.mutate(body);
              }}
            >
              {ticket.status === "closed" ? <Alert tone="info">{t("closedNote")}</Alert> : null}
              <Field label={t("reply")} hint={t("replyHint")} error={replyError}>
                {({ id: fieldId, describedBy, invalid }) => (
                  <Textarea id={fieldId} rows={5} maxLength={4000} value={reply} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => setReply(e.target.value)} />
                )}
              </Field>
              {notice ? <Alert tone="success">{notice}</Alert> : null}
              <div className="flex justify-end">
                <Button type="submit" disabled={send.isPending}>
                  {t("send")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
