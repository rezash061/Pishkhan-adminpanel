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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { IndustryTemplate, PagedResult } from "@/lib/api/types";
import { formatJalaliDateTime, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { TemplateStatusBadge, useIndustryLabel } from "../template-badges";
import { TemplateForm } from "../template-form";
import { IssueChecklist } from "../template-issues";
import { publishBlocker } from "../template-values";
import { TemplateActionDialog, type TemplateAction } from "./template-action-dialog";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One industry template version. Drafts are edited here and saved with PUT; the server answers with the content `issues`,
 * which block publishing until they are fixed. Published and archived versions are fixed; "new version" copies one into a
 * draft. The industry's other versions are listed below.
 */
export function TemplateDetail({ templateId }: { templateId: string }) {
  const t = useTranslations("templates");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const industryLabel = useIndustryLabel();
  const staff = useStaff();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<TemplateAction | null>(null);
  const [notice, setNotice] = useState<string | null>(params.get("created") ? t("detail.created") : params.get("version") ? t("detail.versionCreated") : null);
  const [refused, setRefused] = useState<string[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const onDirtyChange = useCallback((d: boolean) => setDirty(d), []);
  const valid = UUID.test(templateId);

  const template = useQuery({ queryKey: ["industry-template", templateId], queryFn: () => admin<IndustryTemplate>(`/industry-templates/${templateId}`), enabled: valid });
  const industry = template.data?.industry;
  const versions = useQuery({
    queryKey: ["industry-templates", "versions", industry],
    queryFn: () => admin<PagedResult<IndustryTemplate>>(`/industry-templates?${new URLSearchParams({ industry: industry ?? "", pageSize: "100" })}`),
    enabled: Boolean(industry),
  });

  const newVersion = useMutation({
    mutationFn: () => admin<IndustryTemplate>(`/industry-templates/${templateId}/versions`, { method: "POST" }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["industry-templates"] });
      queryClient.setQueryData(["industry-template", created.id], created);
      router.push(`/templates/industry/${created.id}?version=1`);
    },
  });

  const back = (
    <Link href="/templates/industry" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
      <ArrowRight className="size-4" aria-hidden />
      {t("detail.back")}
    </Link>
  );

  if (!valid || (template.error instanceof ApiError && template.error.status === 404)) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Alert tone="warning">{t("detail.notFound")}</Alert>
      </div>
    );
  }
  if (template.error) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Alert tone="danger">{errorMessage(template.error)}</Alert>
      </div>
    );
  }
  if (template.isPending) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;

  const v = template.data;
  const canManage = staff.can("templates.manage");
  const isDraft = v.status === "draft";
  const existingDraft = versions.data?.items.find((x) => x.status === "draft" && x.id !== v.id);
  const draftExists = newVersion.error instanceof ApiError && newVersion.error.code === "templates.draft_exists";
  // A refused publish shows the server's list until the next save replaces it.
  const issues = refused ?? v.issues;
  const blocker = publishBlocker({ status: v.status, issues }, dirty);

  return (
    <div className="flex flex-col gap-4">
      {back}
      <PageHeader
        title={v.name}
        description={t("detail.description", { industry: industryLabel(v.industry), n: toPersianDigits(v.version) })}
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              {isDraft ? (
                <Button
                  onClick={() => setAction("publish")}
                  disabled={blocker !== null}
                  title={blocker === "unsaved" ? t("detail.saveFirst") : blocker === "issues" ? t("detail.publishBlocked") : undefined}
                  aria-describedby={blocker ? "publish-blocker" : undefined}
                >
                  <Send className="size-4" aria-hidden />
                  {t("actions.publish.button")}
                </Button>
              ) : existingDraft ? null : (
                <Button variant="secondary" onClick={() => newVersion.mutate()} disabled={newVersion.isPending}>
                  <CopyPlus className="size-4" aria-hidden />
                  {t("actions.newVersion")}
                </Button>
              )}
              {v.status !== "archived" ? (
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
        <TemplateStatusBadge status={v.status} />
        <code dir="ltr" className="text-xs text-muted-foreground">
          {v.industry}
        </code>
        {v.publishedAt ? <span className="text-muted-foreground">{t("detail.publishedAt", { date: formatJalaliDateTime(v.publishedAt) })}</span> : null}
        <span className="text-muted-foreground">{t("detail.updatedAt", { date: formatJalaliDateTime(v.updatedAt) })}</span>
      </div>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {!canManage ? <Alert tone="info">{t("detail.readOnly")}</Alert> : null}
      {dirty && isDraft ? (
        <Alert tone="info" id={blocker === "unsaved" ? "publish-blocker" : undefined}>
          {t("detail.saveFirst")}
        </Alert>
      ) : null}
      {!isDraft && canManage && existingDraft ? (
        <Alert tone="info">
          {t("detail.hasDraft")}{" "}
          <Link href={`/templates/industry/${existingDraft.id}`} className="font-medium underline">
            {t("draftN", { n: toPersianDigits(existingDraft.version) })}
          </Link>
        </Alert>
      ) : null}
      {!isDraft && canManage && !existingDraft ? <Alert tone="info">{t("detail.fixed")}</Alert> : null}
      {newVersion.error ? (
        <Alert tone={draftExists ? "warning" : "danger"}>
          {errorMessage(newVersion.error)}
          {draftExists ? (
            <button type="button" className="ms-2 font-medium underline" onClick={() => void versions.refetch()}>
              {tc("retry")}
            </button>
          ) : null}
        </Alert>
      ) : null}

      {isDraft ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("issues.title")}</CardTitle>
          </CardHeader>
          <CardContent id={blocker === "issues" ? "publish-blocker" : undefined}>
            {refused ? <p className="mb-3 text-sm text-danger">{t("issues.publishRefused")}</p> : null}
            <IssueChecklist issues={issues} stale={dirty} />
          </CardContent>
        </Card>
      ) : null}

      <TemplateForm
        key={`${v.id}-${v.updatedAt}`}
        initial={v}
        issues={isDraft ? issues : []}
        readOnly={!isDraft || !canManage}
        submitLabel={t("detail.save")}
        onDirtyChange={onDirtyChange}
        onSubmit={async (request) => {
          const saved = await admin<IndustryTemplate>(`/industry-templates/${v.id}`, { method: "PUT", body: request });
          queryClient.setQueryData(["industry-template", v.id], saved);
          await queryClient.invalidateQueries({ queryKey: ["industry-templates"] });
          setRefused(null);
          setNotice(saved.issues.length ? t("detail.savedWithIssues", { count: saved.issues.length }) : t("detail.saved"));
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
              <Th>{t("columns.name")}</Th>
              <Th>{t("columns.issues")}</Th>
              <Th>{t("columns.publishedAt")}</Th>
              <Th>{t("columns.updatedAt")}</Th>
            </tr>
          </thead>
          <tbody>
            {(versions.data?.items ?? [])
              .toSorted((a, b) => b.version - a.version)
              .map((x) => (
                <tr key={x.id} className={x.id === v.id ? "bg-primary/5" : "hover:bg-muted/50"}>
                  <Td>
                    {x.id === v.id ? (
                      <span aria-current="page" className="font-medium">
                        {t("versionN", { n: toPersianDigits(x.version) })}
                      </span>
                    ) : (
                      <Link href={`/templates/industry/${x.id}`} className="text-primary hover:underline">
                        {t("versionN", { n: toPersianDigits(x.version) })}
                      </Link>
                    )}
                  </Td>
                  <Td>
                    <TemplateStatusBadge status={x.status} />
                  </Td>
                  <Td>{x.name}</Td>
                  <Td>{x.issues.length ? t("issueCount", { count: x.issues.length }) : "—"}</Td>
                  <Td className="whitespace-nowrap">{x.publishedAt ? formatJalaliDateTime(x.publishedAt) : "—"}</Td>
                  <Td className="whitespace-nowrap">{formatJalaliDateTime(x.updatedAt)}</Td>
                </tr>
              ))}
          </tbody>
        </Table>
      </Card>

      <TemplateActionDialog
        template={v}
        action={action}
        onClose={() => setAction(null)}
        onRefused={(list) => {
          setRefused(list);
          setNotice(null);
        }}
        onDone={(kind) => {
          setAction(null);
          setRefused(null);
          setNotice(t(`actions.${kind}.done`));
        }}
      />
    </div>
  );
}
