"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { admin } from "@/lib/api/client";
import type { AiTaskRoutes } from "@/lib/api/types";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";
import { SourceBadge, useTaskLabel } from "../ai-shared";
import { RouteStepsTable } from "./route-steps";

/** Every AI task with the fallback chain in effect (backend PR #24). AIOps edits a chain on its own page. */
export function RoutesList() {
  const t = useTranslations("ai.routes");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const taskLabel = useTaskLabel();
  const staff = useStaff();
  const { data, error, isPending } = useQuery({ queryKey: ["ai-routes"], queryFn: () => admin<AiTaskRoutes[]>("/ai/routes") });

  return (
    <div className="flex flex-col gap-4">
      {error instanceof ApiError && error.status === 404 ? <Alert tone="warning">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      {isPending && !error ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}
      {(data ?? []).map((task) => (
        <Card key={task.task}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{taskLabel(task.task)}</CardTitle>
              <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                {task.task}
              </span>
              <SourceBadge source={task.source} />
            </div>
            {staff.can("ai.manage") ? (
              <Link href={`/ai/routes/${task.task}`} className="text-sm font-medium text-primary hover:underline" aria-label={t("editLabel", { task: taskLabel(task.task) })}>
                {t("edit")}
              </Link>
            ) : null}
          </CardHeader>
          <RouteStepsTable steps={task.routes} />
        </Card>
      ))}
    </div>
  );
}
