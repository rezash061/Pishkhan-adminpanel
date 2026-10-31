"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { WorkspaceStatusBadge } from "@/app/(console)/workspaces/workspace-badges";
import { admin } from "@/lib/api/client";
import type { AdminWorkspaceSummary, PagedResult } from "@/lib/api/types";
import { toLatinDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

const RESULTS = 8;

/** Debounced search over `GET /admin/v1/workspaces` (name, slug, owner phone, Instagram username or id). */
export function WorkspacePicker({ onPick }: { onPick: (workspace: AdminWorkspaceSummary) => void }) {
  const t = useTranslations("support.picker");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const inputId = useId();
  const listId = useId();
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(toLatinDigits(text.trim())), 300);
    return () => window.clearTimeout(timer);
  }, [text]);

  const { data, error, isFetching } = useQuery({
    queryKey: ["workspace-picker", term],
    queryFn: () => admin<PagedResult<AdminWorkspaceSummary>>(`/workspaces?${new URLSearchParams({ q: term, pageSize: String(RESULTS) })}`),
    enabled: term.length >= 2,
  });

  const unavailable = error instanceof ApiError && error.status === 404;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        {t("label")}
      </label>
      <Input
        id={inputId}
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("placeholder")}
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        aria-controls={listId}
      />
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
      {unavailable ? <Alert tone="warning">{t("unavailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      <div id={listId} aria-live="polite" aria-busy={isFetching}>
        {term.length >= 2 && data ? (
          data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border" aria-label={t("results")}>
              {data.items.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      {w.name} <WorkspaceStatusBadge status={w.status} />
                    </div>
                    <div className="ltr truncate text-start font-mono text-xs text-muted-foreground">
                      {w.slug}
                      {w.owner ? ` · ${w.owner.maskedPhone}` : ""}
                      {w.channels.filter((c) => c.username).map((c) => ` · @${c.username}`)}
                    </div>
                  </div>
                  <Button type="button" variant="secondary" size="sm" disabled={w.status === "deleted"} onClick={() => onPick(w)} aria-label={t("pickNamed", { name: w.name })}>
                    {t("pick")}
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : isFetching ? (
          <p className="text-sm text-muted-foreground">{tc("loading")}</p>
        ) : null}
      </div>
    </div>
  );
}
