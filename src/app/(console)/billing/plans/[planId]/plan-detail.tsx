"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowRight, CopyPlus, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { PagedResult, Plan } from "@/lib/api/types";
import { formatJalaliDateTime, formatToman, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { PlanStatusBadge } from "../plan-badges";
import { PlanForm } from "../plan-form";
import { PlanActionDialog, type PlanAction } from "./plan-action-dialog";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One plan version. Drafts are edited here and published (step-up); published and archived versions are fixed, and editing
 * them starts a new draft version. The plan's other versions are listed below.
 */
export function PlanDetail({ planId }: { planId: string }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<PlanAction | null>(null);
  const [notice, setNotice] = useState<string | null>(params.get("created") ? t("detail.created") : null);
  const [dirty, setDirty] = useState(false);
  const onDirtyChange = useCallback((d: boolean) => setDirty(d), []);
  const valid = UUID.test(planId);

  const plan = useQuery({ queryKey: ["plan", planId], queryFn: () => admin<Plan>(`/plans/${planId}`), enabled: valid });
  const code = plan.data?.code;
  const versions = useQuery({
    queryKey: ["plans", "versions", code],
    queryFn: () => admin<PagedResult<Plan>>(`/plans?${new URLSearchParams({ code: code ?? "", pageSize: "100" })}`),
    enabled: Boolean(code),
  });

  const newVersion = useMutation({
    mutationFn: () => admin<Plan>(`/plans/${planId}/versions`, { method: "POST" }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
      router.push(`/billing/plans/${created.id}`);
    },
  });

  const back = (
    <Link href="/billing/plans" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
      <ArrowRight className="size-4" aria-hidden />
      {t("detail.back")}
    </Link>
  );

  if (!valid || (plan.error instanceof ApiError && plan.error.status === 404)) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Alert tone="warning">{t("detail.notFound")}</Alert>
      </div>
    );
  }
  if (plan.error) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Alert tone="danger">{errorMessage(plan.error)}</Alert>
      </div>
    );
  }
  if (plan.isPending) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;

  const p = plan.data;
  const canManage = staff.can("plans.manage");
  const isDraft = p.status === "draft";
  const existingDraft = versions.data?.items.find((v) => v.status === "draft");
  const draftExists = newVersion.error instanceof ApiError && newVersion.error.code === "billing.plan.draft_exists";

  return (
    <div className="flex flex-col gap-4">
      {back}
      <PageHeader
        title={p.name}
        description={t("detail.description", { code: p.code, n: toPersianDigits(p.version) })}
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              {isDraft ? (
                <Button onClick={() => setAction("publish")} disabled={dirty} title={dirty ? t("detail.saveFirst") : undefined}>
                  <Send className="size-4" aria-hidden />
                  {t("actions.publish.button")}
                </Button>
              ) : existingDraft ? null : (
                <Button variant="secondary" onClick={() => newVersion.mutate()} disabled={newVersion.isPending}>
                  <CopyPlus className="size-4" aria-hidden />
                  {t("actions.newVersion")}
                </Button>
              )}
              {p.status !== "archived" ? (
                <Button variant="secondary" onClick={() => setAction("archive")}>
                  <Archive className="size-4" aria-hidden />
                  {t(isDraft ? "actions.archive.buttonDraft" : "actions.archive.button")}
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <PlanStatusBadge status={p.status} />
        {p.publishedAt ? <span className="text-muted-foreground">{t("detail.publishedAt", { date: formatJalaliDateTime(p.publishedAt) })}</span> : null}
        <span className="text-muted-foreground">{t("detail.updatedAt", { date: formatJalaliDateTime(p.updatedAt) })}</span>
      </div>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {dirty && isDraft ? <Alert tone="info">{t("detail.saveFirst")}</Alert> : null}
      {!isDraft && canManage && existingDraft ? (
        <Alert tone="info">
          {t("detail.hasDraft")}{" "}
          <Link href={`/billing/plans/${existingDraft.id}`} className="font-medium underline">
            {t("draftN", { n: toPersianDigits(existingDraft.version) })}
          </Link>
        </Alert>
      ) : null}
      {!isDraft && canManage && !existingDraft ? <Alert tone="info">{t("detail.fixed")}</Alert> : null}
      {newVersion.error && !draftExists ? <Alert tone="danger">{errorMessage(newVersion.error)}</Alert> : null}

      <PlanForm
        key={`${p.id}-${p.updatedAt}`}
        initial={p}
        readOnly={!isDraft || !canManage}
        submitLabel={t("detail.save")}
        onDirtyChange={onDirtyChange}
        onSubmit={async (request) => {
          const saved = await admin<Plan>(`/plans/${p.id}`, { method: "PUT", body: request });
          queryClient.setQueryData(["plan", p.id], saved);
          await queryClient.invalidateQueries({ queryKey: ["plans"] });
          setNotice(t("detail.saved"));
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("detail.versions")}</CardTitle>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>{t("columns.version")}</Th>
              <Th>{t("columns.status")}</Th>
              <Th>{t("columns.monthly")}</Th>
              <Th>{t("columns.publishedAt")}</Th>
              <Th>{t("columns.updatedAt")}</Th>
            </tr>
          </thead>
          <tbody>
            {(versions.data?.items ?? [])
              .toSorted((a, b) => b.version - a.version)
              .map((v) => (
                <tr key={v.id} className={v.id === p.id ? "bg-primary/5" : "hover:bg-muted/50"}>
                  <Td>
                    {v.id === p.id ? (
                      <span aria-current="page" className="font-medium">
                        {t("versionN", { n: toPersianDigits(v.version) })}
                      </span>
                    ) : (
                      <Link href={`/billing/plans/${v.id}`} className="text-primary hover:underline">
                        {t("versionN", { n: toPersianDigits(v.version) })}
                      </Link>
                    )}
                  </Td>
                  <Td>
                    <PlanStatusBadge status={v.status} />
                  </Td>
                  <Td className="whitespace-nowrap">{v.isFree ? t("free") : formatToman(v.monthly.amount)}</Td>
                  <Td className="whitespace-nowrap">{v.publishedAt ? formatJalaliDateTime(v.publishedAt) : "—"}</Td>
                  <Td className="whitespace-nowrap">{formatJalaliDateTime(v.updatedAt)}</Td>
                </tr>
              ))}
          </tbody>
        </Table>
      </Card>

      <PlanActionDialog
        plan={p}
        action={action}
        onClose={() => setAction(null)}
        onDone={(kind) => {
          setAction(null);
          setNotice(t(`actions.${kind}.done`));
        }}
      />
    </div>
  );
}
