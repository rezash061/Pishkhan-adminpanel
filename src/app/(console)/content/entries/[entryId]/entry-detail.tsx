"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { admin } from "@/lib/api/client";
import type { ContentEntry } from "@/lib/api/types";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { EntryStatusBadge, useKindLabel } from "../../content-badges";
import { EntryEditor } from "../../entry-editor";
import { EntryActions } from "./entry-actions";

/** One entry: its publishing state and actions, then the draft editor. */
export function EntryDetail({ entryId }: { entryId: string }) {
  const t = useTranslations("content");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const kindLabel = useKindLabel();
  const staff = useStaff();
  const params = useSearchParams();
  const [dirty, setDirty] = useState(false);
  const onDirty = useCallback((d: boolean) => setDirty(d), []);
  const { data: entry, error, isPending } = useQuery({ queryKey: ["content-entry", entryId], queryFn: () => admin<ContentEntry>(`/content/entries/${entryId}`) });

  return (
    <>
      <Link href="/content/entries" className="mb-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowRight className="size-4" aria-hidden />
        {t("back")}
      </Link>
      {error instanceof ApiError && error.status === 404 ? <Alert tone="warning">{t("notFound")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      {isPending && !error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}
      {entry ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold" dir="auto">
              {entry.title}
            </h1>
            <span className="text-sm text-muted-foreground">{kindLabel(entry.kind)}</span>
            <EntryStatusBadge status={entry.status} scheduledAt={entry.scheduledAt} changed={entry.hasUnpublishedChanges} />
          </div>
          {params.get("created") ? (
            <Alert tone="success" className="mb-4">
              {t("created")}
            </Alert>
          ) : null}
          <EntryActions entry={entry} canManage={staff.can("content.manage")} dirty={dirty} />
          <EntryEditor key={entry.id} entry={entry} canManage={staff.can("content.manage")} onDirty={onDirty} />
        </>
      ) : null}
    </>
  );
}
