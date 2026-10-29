"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { AuditEntry } from "@/lib/api/types";
import { formatJalaliDateTime } from "@/lib/format";

function Json({ value }: { value: unknown }) {
  const t = useTranslations("audit.detail");
  if (value === null || value === undefined) return <p className="text-sm text-muted-foreground">{t("none")}</p>;
  return <pre className="ltr max-h-56 overflow-auto rounded-md bg-muted p-3 text-start font-mono text-xs">{JSON.stringify(value, null, 2)}</pre>;
}

export function AuditDetail({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  const t = useTranslations("audit");
  const tc = useTranslations("common");
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      {entry ? (
        <DialogContent title={t("detail.title")} closeLabel={tc("close")} className="max-w-2xl">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t("columns.occurredAt")}</dt>
            <dd>{formatJalaliDateTime(entry.occurredAt)}</dd>
            <dt className="text-muted-foreground">{t("columns.actor")}</dt>
            <dd>
              <span className="ltr">{entry.actorName}</span> ({t(`actorTypes.${entry.actorType}`)})
            </dd>
            {entry.onBehalfOf ? (
              <>
                <dt className="text-muted-foreground">{t("detail.onBehalfOf")}</dt>
                <dd className="ltr text-start font-mono text-xs break-all">{entry.onBehalfOf}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">{t("columns.action")}</dt>
            <dd className="ltr text-start font-mono text-xs">{entry.action}</dd>
            <dt className="text-muted-foreground">{t("detail.entityId")}</dt>
            <dd className="ltr text-start font-mono text-xs break-all">{entry.entityId ?? "—"}</dd>
            <dt className="text-muted-foreground">{t("columns.workspace")}</dt>
            <dd className="ltr text-start font-mono text-xs break-all">{entry.workspaceId ?? "—"}</dd>
            <dt className="text-muted-foreground">{t("detail.ip")}</dt>
            <dd className="ltr text-start font-mono text-xs">{entry.ip ?? "—"}</dd>
            <dt className="text-muted-foreground">{t("columns.reason")}</dt>
            <dd>{entry.reason ?? "—"}</dd>
          </dl>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium">{t("detail.before")}</p>
              <Json value={entry.before} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">{t("detail.after")}</p>
              <Json value={entry.after} />
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
