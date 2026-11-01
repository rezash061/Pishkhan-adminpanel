"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { PromptKey } from "@/lib/api/types";
import { formatNumber, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { SourceBadge } from "../ai-shared";

/** Prompt keys with their active version (backend PR #24). */
export function PromptsList() {
  const t = useTranslations("ai.prompts");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { data, error, isPending } = useQuery({ queryKey: ["ai-prompts"], queryFn: () => admin<PromptKey[]>("/ai/prompts") });

  return (
    <div className="flex flex-col gap-4">
      {error instanceof ApiError && error.status === 404 ? <Alert tone="warning">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t("columns.key")}</Th>
              <Th>{t("columns.active")}</Th>
              <Th>{t("columns.source")}</Th>
              <Th>{t("columns.versions")}</Th>
            </tr>
          </thead>
          <tbody>
            {isPending && !error ? (
              <tr>
                <Td colSpan={4} className="py-6 text-center text-muted-foreground">
                  {tc("loading")}
                </Td>
              </tr>
            ) : null}
            {data && data.length === 0 ? (
              <tr>
                <Td colSpan={4} className="py-6 text-center text-muted-foreground">
                  {t("empty")}
                </Td>
              </tr>
            ) : null}
            {(data ?? []).map((p) => (
              <tr key={p.key}>
                <Td>
                  <Link href={`/ai/prompts/${encodeURIComponent(p.key)}`} dir="ltr" className="font-mono text-sm text-primary hover:underline">
                    {p.key}
                  </Link>
                </Td>
                <Td>{t("versionShort", { v: toPersianDigits(p.activeVersion) })}</Td>
                <Td>
                  <SourceBadge source={p.activeSource} />
                </Td>
                <Td>{formatNumber(p.versionCount)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
