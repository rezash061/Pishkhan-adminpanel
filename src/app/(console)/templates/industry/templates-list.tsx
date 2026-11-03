"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import { TEMPLATE_INDUSTRIES, TEMPLATE_STATUSES, type IndustryTemplate, type PagedResult } from "@/lib/api/types";
import { formatJalaliDate, formatJalaliDateTime, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { TemplateStatusBadge, useIndustryLabel } from "./template-badges";

const PAGE_SIZE = 25;

interface Filters {
  industry: string;
  status: string;
  page: number;
}

/** Every industry template version, by industry and newest first, with industry and status filters in the URL (backend PR #40). */
export function TemplatesList() {
  const t = useTranslations("templates");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const industryLabel = useIndustryLabel();
  const staff = useStaff();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const current: Filters = {
    industry: TEMPLATE_INDUSTRIES.find((s) => s === params.get("industry")) ?? "",
    status: TEMPLATE_STATUSES.find((s) => s === params.get("status")) ?? "",
    page: Math.max(1, Number(params.get("page") ?? 1) || 1),
  };
  const query = new URLSearchParams({ page: String(current.page), pageSize: String(PAGE_SIZE) });
  if (current.industry) query.set("industry", current.industry);
  if (current.status) query.set("status", current.status);

  const { data, error, isPending, isFetching } = useQuery({
    queryKey: ["industry-templates", query.toString()],
    queryFn: () => admin<PagedResult<IndustryTemplate>>(`/industry-templates?${query}`),
    placeholderData: keepPreviousData,
  });

  const navigate = (next: Partial<Filters>) => {
    const merged = { ...current, page: 1, ...next };
    const q = new URLSearchParams();
    if (merged.industry) q.set("industry", merged.industry);
    if (merged.status) q.set("status", merged.status);
    if (merged.page > 1) q.set("page", String(merged.page));
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const notAvailable = error instanceof ApiError && error.status === 404;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;
  const selectClass = "h-10 min-w-36 rounded-md border border-border bg-surface px-2 text-sm font-normal";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("filters.industry")}
          <select value={current.industry} onChange={(e) => navigate({ industry: e.target.value })} className={selectClass}>
            <option value="">{t("filters.any")}</option>
            {TEMPLATE_INDUSTRIES.map((s) => (
              <option key={s} value={s}>
                {industryLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("filters.status")}
          <select value={current.status} onChange={(e) => navigate({ status: e.target.value })} className={selectClass}>
            <option value="">{t("filters.any")}</option>
            {TEMPLATE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </select>
        </label>
        {staff.can("templates.manage") ? (
          <Link href="/templates/industry/new" className="ms-auto inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" aria-hidden />
            {t("create")}
          </Link>
        ) : null}
      </div>

      {notAvailable ? <Alert tone="warning">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      {isPending && !error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}

      {data ? (
        <Card className={isFetching ? "opacity-70" : undefined}>
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.industry")}</Th>
                <Th>{t("columns.name")}</Th>
                <Th>{t("columns.version")}</Th>
                <Th>{t("columns.status")}</Th>
                <Th>{t("columns.contents")}</Th>
                <Th>{t("columns.issues")}</Th>
                <Th>{t("columns.publishedAt")}</Th>
                <Th>{t("columns.updatedAt")}</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </Td>
                </tr>
              ) : null}
              {data.items.map((v) => (
                <tr key={v.id} className="hover:bg-muted/50">
                  <Td>
                    <div>{industryLabel(v.industry)}</div>
                    <div className="ltr text-start font-mono text-xs text-muted-foreground">{v.industry}</div>
                  </Td>
                  <Td>
                    <Link href={`/templates/industry/${v.id}`} className="font-medium text-primary hover:underline">
                      {v.name}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{t("versionN", { n: toPersianDigits(v.version) })}</Td>
                  <Td>
                    <TemplateStatusBadge status={v.status} />
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {t("counts", {
                      facts: toPersianDigits(v.content.requiredFacts?.length ?? 0),
                      faqs: toPersianDigits(v.content.faqs?.length ?? 0),
                      flows: toPersianDigits(v.content.flows?.length ?? 0),
                      rules: toPersianDigits(v.content.rules?.length ?? 0),
                    })}
                  </Td>
                  <Td>{v.issues.length ? <Badge tone="danger">{t("issueCount", { count: v.issues.length })}</Badge> : <span className="text-xs text-muted-foreground">{t("noIssues")}</span>}</Td>
                  <Td className="whitespace-nowrap">{v.publishedAt ? formatJalaliDate(v.publishedAt) : "—"}</Td>
                  <Td className="whitespace-nowrap">{formatJalaliDateTime(v.updatedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">{tc("total", { count: data.totalCount })}</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={current.page <= 1} onClick={() => navigate({ page: current.page - 1 })}>
                {tc("previous")}
              </Button>
              <span>{tc("pageOf", { page: toPersianDigits(current.page), pages: toPersianDigits(pages) })}</span>
              <Button variant="secondary" size="sm" disabled={current.page >= pages} onClick={() => navigate({ page: current.page + 1 })}>
                {tc("next")}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
