"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { PagedResult, Plan } from "@/lib/api/types";
import { formatJalaliDate, formatToman, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { PlanStatusBadge } from "./plan-badges";

interface PlanGroup {
  code: string;
  published: Plan | undefined;
  draft: Plan | undefined;
  latest: Plan;
  versions: number;
}

/** Every plan code with its published version, its draft and how many versions it has (backend PR #22). */
export function PlansList() {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();

  const { data, error, isPending } = useQuery({
    queryKey: ["plans"],
    queryFn: () => admin<PagedResult<Plan>>("/plans?pageSize=100"),
  });

  // Rows come in display order with the newest version first, so the first row of a code is its latest version.
  const groups: PlanGroup[] = [];
  for (const plan of data?.items ?? []) {
    let group = groups.find((g) => g.code === plan.code);
    if (!group) {
      group = { code: plan.code, published: undefined, draft: undefined, latest: plan, versions: 0 };
      groups.push(group);
    }
    group.versions += 1;
    if (plan.status === "published") group.published = plan;
    if (plan.status === "draft") group.draft = plan;
  }

  const notAvailable = error instanceof ApiError && error.status === 404;

  return (
    <div className="flex flex-col gap-4">
      {staff.can("plans.manage") ? (
        <Link href="/billing/plans/new" className="inline-flex h-10 items-center gap-2 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="size-4" aria-hidden />
          {t("create")}
        </Link>
      ) : null}
      {notAvailable ? <Alert tone="warning">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      {isPending && !error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}
      {data ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>{t("columns.plan")}</Th>
                <Th>{t("columns.monthly")}</Th>
                <Th>{t("columns.onSale")}</Th>
                <Th>{t("columns.draft")}</Th>
                <Th>{t("columns.flags")}</Th>
                <Th>{t("columns.versions")}</Th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </Td>
                </tr>
              ) : null}
              {groups.map((g) => {
                const shown = g.published ?? g.latest;
                return (
                  <tr key={g.code} className="hover:bg-muted/50">
                    <Td>
                      <Link href={`/billing/plans/${shown.id}`} className="font-medium text-primary hover:underline">
                        {shown.name}
                      </Link>
                      <div className="ltr text-start font-mono text-xs text-muted-foreground">{g.code}</div>
                    </Td>
                    <Td className="whitespace-nowrap">{shown.isFree ? t("free") : formatToman(shown.monthly.amount)}</Td>
                    <Td>
                      {g.published ? (
                        <span className="flex flex-col gap-0.5">
                          <span>{t("versionN", { n: toPersianDigits(g.published.version) })}</span>
                          {g.published.publishedAt ? <span className="text-xs text-muted-foreground">{formatJalaliDate(g.published.publishedAt)}</span> : null}
                        </span>
                      ) : (
                        <PlanStatusBadge status={g.latest.status} />
                      )}
                    </Td>
                    <Td>
                      {g.draft ? (
                        <Link href={`/billing/plans/${g.draft.id}`} className="text-primary hover:underline">
                          {t("draftN", { n: toPersianDigits(g.draft.version) })}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {shown.isPublic ? <Badge tone="info">{t("flags.public")}</Badge> : <Badge>{t("flags.private")}</Badge>}
                        {shown.isFree ? <Badge>{t("flags.free")}</Badge> : null}
                        {shown.highlighted ? <Badge tone="warning">{t("flags.highlighted")}</Badge> : null}
                      </span>
                    </Td>
                    <Td>{toPersianDigits(g.versions)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
