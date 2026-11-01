"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { admin } from "@/lib/api/client";
import type { ContentEntry } from "@/lib/api/types";
import { formatJalaliDateTime } from "@/lib/format";
import { useErrorMessage } from "@/lib/use-error-message";

const WEBSITE_URL = (process.env.NEXT_PUBLIC_WEBSITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

type Action = "publish" | "archive" | "delete";

/** Publishing state and actions: publish now or at a time, cancel the schedule, archive, delete a never-published entry, preview. */
export function EntryActions({ entry, canManage, dirty }: { entry: ContentEntry; canManage: boolean; dirty: boolean }) {
  const t = useTranslations("content.actions");
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Action | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; expiresAt: string } | null>(null);

  const done = async (result: ContentEntry | null, message: string) => {
    if (result) queryClient.setQueryData(["content-entry", entry.id], result);
    await queryClient.invalidateQueries({ queryKey: ["content-entries"] });
    setDialog(null);
    setNotice(message);
  };

  const unschedule = useMutation({
    mutationFn: () => admin<ContentEntry>(`/content/entries/${entry.id}/schedule`, { method: "DELETE" }),
    onSuccess: (r) => done(r, t("unscheduled")),
  });
  const previewMutation = useMutation({
    mutationFn: () => admin<{ token: string; expiresAt: string }>(`/content/entries/${entry.id}/preview`, { method: "POST" }),
    onSuccess: (r) => {
      const url = `${WEBSITE_URL}/api/preview?token=${encodeURIComponent(r.token)}`;
      setPreview({ url, expiresAt: r.expiresAt });
      window.open(url, "_blank", "noopener");
    },
  });
  const error = unschedule.error ?? previewMutation.error;

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-3 text-sm">
        <dl className="grid grid-cols-[9rem_1fr] gap-y-1">
          <dt className="text-muted-foreground">{t("firstPublished")}</dt>
          <dd>{entry.firstPublishedAt ? formatJalaliDateTime(entry.firstPublishedAt) : t("never")}</dd>
          <dt className="text-muted-foreground">{t("lastPublished")}</dt>
          <dd>{entry.publishedAt ? formatJalaliDateTime(entry.publishedAt) : "—"}</dd>
          {entry.scheduledAt ? (
            <>
              <dt className="text-muted-foreground">{t("scheduledAt")}</dt>
              <dd>{formatJalaliDateTime(entry.scheduledAt)}</dd>
            </>
          ) : null}
        </dl>
        {entry.status === "published" && entry.hasUnpublishedChanges ? <Alert tone="warning">{t("draftDiffers")}</Alert> : null}
        {error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {preview ? (
          <p>
            <a href={preview.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="size-4" aria-hidden />
              {t("previewLink")}
            </a>{" "}
            <span className="text-muted-foreground">{t("previewExpires", { at: formatJalaliDateTime(preview.expiresAt) })}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={previewMutation.isPending} onClick={() => previewMutation.mutate()}>
            {t("preview")}
          </Button>
          {canManage && entry.status !== "archived" ? (
            <Button size="sm" disabled={dirty} title={dirty ? t("saveFirst") : undefined} onClick={() => setDialog("publish")}>
              {entry.status === "published" ? t("publishChanges") : t("publish")}
            </Button>
          ) : null}
          {canManage && entry.status === "archived" ? (
            <Button size="sm" onClick={() => setDialog("publish")}>
              {t("republish")}
            </Button>
          ) : null}
          {canManage && entry.scheduledAt ? (
            <Button size="sm" variant="secondary" disabled={unschedule.isPending} onClick={() => unschedule.mutate()}>
              {t("unschedule")}
            </Button>
          ) : null}
          {canManage && entry.status === "published" ? (
            <Button size="sm" variant="secondary" onClick={() => setDialog("archive")}>
              {t("archive")}
            </Button>
          ) : null}
          {canManage && !entry.firstPublishedAt ? (
            <Button size="sm" variant="danger" onClick={() => setDialog("delete")}>
              {t("delete")}
            </Button>
          ) : null}
        </div>
        {canManage && dirty && entry.status !== "archived" ? <p className="text-xs text-muted-foreground">{t("saveFirst")}</p> : null}
      </CardContent>
      <PublishDialog open={dialog === "publish"} entry={entry} onClose={() => setDialog(null)} onDone={(r, scheduled) => done(r, scheduled ? t("scheduledDone", { at: formatJalaliDateTime(r.scheduledAt!) }) : t("publishedDone"))} />
      <ArchiveDialog open={dialog === "archive"} entry={entry} onClose={() => setDialog(null)} onDone={(r) => done(r, t("archivedDone"))} />
      <DeleteDialog open={dialog === "delete"} entry={entry} onClose={() => setDialog(null)} />
    </Card>
  );
}

function PublishDialog({ open, entry, onClose, onDone }: { open: boolean; entry: ContentEntry; onClose: () => void; onDone: (r: ContentEntry, scheduled: boolean) => void }) {
  const t = useTranslations("content.actions");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [atError, setAtError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (iso: string | null) => admin<ContentEntry>(`/content/entries/${entry.id}/publish`, { method: "POST", body: iso ? { at: iso } : {} }),
    onSuccess: (r, iso) => onDone(r, Boolean(iso) && Boolean(r.scheduledAt)),
  });
  const close = () => {
    mutation.reset();
    setAtError(null);
    onClose();
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setAtError(null);
    if (when === "now") return mutation.mutate(null);
    const date = at ? new Date(at) : null;
    if (!date || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return setAtError(t("atFuture"));
    mutation.mutate(date.toISOString());
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open ? (
        <DialogContent title={t("publishTitle", { title: entry.title })} description={t("publishBody")} closeLabel={tc("close")}>
          <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
            {mutation.error ? <Alert tone="danger">{errorMessage(mutation.error)}</Alert> : null}
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 font-medium">{t("when")}</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="when" className="accent-primary" checked={when === "now"} onChange={() => setWhen("now")} />
                {t("now")}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="when" className="accent-primary" checked={when === "later"} onChange={() => setWhen("later")} />
                {t("later")}
              </label>
            </fieldset>
            {when === "later" ? (
              <Field label={t("at")} hint={t("atHint")} error={atError ?? undefined}>
                {({ id, describedBy, invalid }) => <Input id={id} type="datetime-local" dir="ltr" value={at} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => setAt(e.target.value)} />}
              </Field>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {when === "now" ? t("publishNow") : t("schedule")}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function ArchiveDialog({ open, entry, onClose, onDone }: { open: boolean; entry: ContentEntry; onClose: () => void; onDone: (r: ContentEntry) => void }) {
  const t = useTranslations("content.actions");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () => admin<ContentEntry>(`/content/entries/${entry.id}/archive`, { method: "POST", body: { reason: reason.trim() || null } }),
    onSuccess: (r) => {
      setReason("");
      onDone(r);
    },
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open ? (
        <DialogContent title={t("archiveTitle", { title: entry.title })} description={t("archiveBody")} closeLabel={tc("close")}>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {mutation.error ? <Alert tone="danger">{errorMessage(mutation.error)}</Alert> : null}
            <Field label={t("archiveReason")}>
              {({ id }) => <Textarea id={id} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />}
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                {tc("cancel")}
              </Button>
              <Button type="submit" variant="danger" disabled={mutation.isPending}>
                {t("archive")}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function DeleteDialog({ open, entry, onClose }: { open: boolean; entry: ContentEntry; onClose: () => void }) {
  const t = useTranslations("content.actions");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => admin<void>(`/content/entries/${entry.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["content-entries"] });
      router.replace("/content/entries");
    },
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open ? (
        <DialogContent title={t("deleteTitle", { title: entry.title })} description={t("deleteBody")} closeLabel={tc("close")}>
          <div className="flex flex-col gap-4">
            {mutation.error ? <Alert tone="danger">{errorMessage(mutation.error)}</Alert> : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                {tc("cancel")}
              </Button>
              <Button variant="danger" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                {t("delete")}
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
