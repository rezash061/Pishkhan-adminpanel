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
import { Input } from "@/components/ui/field";
import { Pager } from "@/components/ui/pager";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import { QUARANTINE_FILTERS, type PagedResult, type QuarantineFile, type QuarantineSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatBytes, formatJalaliDateTime, formatNumber, formatRelative, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

const PAGE_SIZE = 25;
type Action = "rescan" | "delete" | "falsePositive";
const PATHS: Record<Action, string> = { rescan: "rescan", delete: "delete", falsePositive: "false-positive" };

const STATUS_TONE: Record<string, "danger" | "warning" | "neutral" | "info"> = { infected: "danger", scan_failed: "warning", pending_scan: "info", rejected: "neutral" };

/** Antivirus quarantine (AD-1.6, admin plan 4.9): filters in the URL, re-scan, delete (step-up) and false positive (SuperAdmin, step-up). No download. */
export function QuarantineList() {
  const t = useTranslations("quarantine");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<{ action: Action; file: QuarantineFile } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const status = QUARANTINE_FILTERS.find((s) => s === params.get("status")) ?? "";
  const workspaceId = params.get("workspaceId") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [workspaceText, setWorkspaceText] = useState(workspaceId);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (status) query.set("status", status);
  if (workspaceId) query.set("workspaceId", workspaceId);

  const list = useQuery({
    queryKey: ["quarantine", query.toString()],
    queryFn: () => admin<PagedResult<QuarantineFile>>(`/files/quarantine?${query}`),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({ queryKey: ["quarantine-summary"], queryFn: () => admin<QuarantineSummary>("/files/quarantine/summary") });

  const navigate = (next: { status?: string; workspaceId?: string; page?: number }) => {
    const merged = { status, workspaceId, page: 1, ...next };
    const q = new URLSearchParams();
    if (merged.status) q.set("status", merged.status);
    if (merged.workspaceId) q.set("workspaceId", merged.workspaceId);
    if (merged.page > 1) q.set("page", String(merged.page));
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  if (list.error instanceof ApiError && list.error.status === 404) return <Alert tone="warning">{t("notAvailable")}</Alert>;

  const tabs: { key: string; label: string; count?: number }[] = [
    { key: "", label: t("filters.all") },
    { key: "infected", label: t("filters.infected"), count: summary.data?.infected },
    { key: "scan_failed", label: t("filters.scan_failed"), count: summary.data?.scanFailed },
    { key: "pending", label: t("filters.pending"), count: summary.data?.pending },
    { key: "rejected", label: t("filters.rejected"), count: summary.data?.rejected },
  ];

  const canDelete = staff.can("files.quarantine");
  const canClear = staff.can("files.false_positive");

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">{t("never")}</Alert>
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key || "all"}
              role="tab"
              type="button"
              aria-selected={status === tab.key}
              onClick={() => navigate({ status: tab.key })}
              className={cn("rounded-full border px-3 py-1 text-sm", status === tab.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-muted")}
            >
              {tab.label}
              {tab.count !== undefined ? <span className="ms-1.5 opacity-80">({formatNumber(tab.count)})</span> : null}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ workspaceId: workspaceText.trim() });
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("filters.workspace")}
            <Input dir="ltr" value={workspaceText} onChange={(e) => setWorkspaceText(e.target.value)} placeholder={t("filters.workspacePlaceholder")} className="w-80 font-mono text-xs" />
          </label>
          <Button type="submit" variant="secondary">
            {tc("apply")}
          </Button>
        </form>
      </div>

      {list.error ? <Alert tone="danger">{errorMessage(list.error)}</Alert> : null}
      {list.isPending && !list.error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}

      {list.data ? (
        <Card className={list.isFetching ? "opacity-70" : undefined}>
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.file")}</Th>
                <Th>{t("columns.workspace")}</Th>
                <Th>{t("columns.status")}</Th>
                <Th>{t("columns.detail")}</Th>
                <Th>{t("columns.size")}</Th>
                <Th>{t("columns.createdAt")}</Th>
                <Th>{t("columns.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </Td>
                </tr>
              ) : null}
              {list.data.items.map((f) => (
                <tr key={f.id} data-testid={`file-${f.id}`}>
                  <Td>
                    <div className="font-medium" dir="auto">
                      {f.originalName ?? t("noName")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.has(`purposes.${f.purpose}`) ? t(`purposes.${f.purpose}`) : f.purpose} · <span dir="ltr">{f.contentType}</span>
                    </div>
                  </Td>
                  <Td>
                    <Link href={`/workspaces/${f.workspaceId}`} className="text-primary hover:underline">
                      {f.workspaceName ?? f.workspaceId.slice(0, 8)}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[f.status] ?? "neutral"}>{t.has(`statuses.${f.status}`) ? t(`statuses.${f.status}`) : f.status}</Badge>
                    {f.stuck ? <div className="mt-1 text-xs text-warning-foreground">{t("stuck")}</div> : null}
                  </Td>
                  <Td className="max-w-72 text-xs">
                    {f.signature ? (
                      <div className="font-mono text-danger-foreground" dir="ltr">
                        {t("signature", { name: f.signature })}
                      </div>
                    ) : null}
                    {f.rejectReason ? (
                      <div className="font-mono text-muted-foreground" dir="ltr">
                        {f.rejectReason}
                      </div>
                    ) : null}
                    {f.scanAttempts > 0 ? <div className="text-muted-foreground">{t("attempts", { count: f.scanAttempts })}</div> : null}
                    {f.falsePositiveAt ? <div className="text-muted-foreground">{t("falsePositive", { date: formatJalaliDateTime(f.falsePositiveAt) })}</div> : null}
                  </Td>
                  <Td className="whitespace-nowrap">{formatBytes(f.size)}</Td>
                  <Td className="whitespace-nowrap" title={formatJalaliDateTime(f.createdAt)}>
                    {formatRelative(f.createdAt)}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {["infected", "scan_failed", "pending_scan"].includes(f.status) ? (
                        <Button size="sm" variant="secondary" onClick={() => setPending({ action: "rescan", file: f })}>
                          {t("actions.rescan.label")}
                        </Button>
                      ) : null}
                      {canClear && f.status === "infected" ? (
                        <Button size="sm" variant="secondary" onClick={() => setPending({ action: "falsePositive", file: f })}>
                          {t("actions.falsePositive.label")}
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="danger" onClick={() => setPending({ action: "delete", file: f })}>
                          {t("actions.delete.label")}
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} pageSize={PAGE_SIZE} totalCount={list.data.totalCount} onPage={(p) => navigate({ page: p })} />
        </Card>
      ) : null}

      <ReasonDialog
        open={pending !== null}
        title={pending ? t(`actions.${pending.action}.title`) : ""}
        description={pending ? t(`actions.${pending.action}.body`) : undefined}
        confirmLabel={pending ? t(`actions.${pending.action}.confirm`) : ""}
        tone={pending?.action === "rescan" ? "primary" : "danger"}
        stepUp={pending?.action !== "rescan"}
        onSubmit={(reason) => admin<QuarantineFile | undefined>(`/files/${pending!.file.id}/${PATHS[pending!.action]}`, { method: "POST", body: { reason } })}
        onDone={async () => {
          setNotice(t(`actions.${pending!.action}.done`));
          setPending(null);
          await queryClient.invalidateQueries({ queryKey: ["quarantine"] });
          await queryClient.invalidateQueries({ queryKey: ["quarantine-summary"] });
        }}
        onClose={() => setPending(null)}
      >
        {pending ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm" dir="auto">
            {pending.file.originalName ?? t("noName")} · {toPersianDigits(formatBytes(pending.file.size))}
          </p>
        ) : null}
      </ReasonDialog>
    </div>
  );
}
