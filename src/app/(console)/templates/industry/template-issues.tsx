"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { cn } from "@/lib/cn";
import { groupIssues, type TemplateIssue } from "./template-values";

/** Persian text for an issue's error key: the template-specific explanation, then the shared `errors.*` key, then the raw code. */
export function useIssueText() {
  const t = useTranslations("templates.issues");
  const te = useTranslations("errors");
  return useCallback(
    (issue: TemplateIssue): string => {
      if (t.has(`codes.${issue.code}`)) return t(`codes.${issue.code}`);
      if (te.has(issue.code)) return te(issue.code);
      return t("unknownCode", { code: issue.code });
    },
    [t, te],
  );
}

/** Where the issue is: «پرسش‌های رایج › مورد shipping-cost › پاسخ». Item keys are Latin and shown left-to-right. */
export function IssuePlace({ issue }: { issue: TemplateIssue }) {
  const t = useTranslations("templates.issues");
  const field = issue.field ? (t.has(`fields.${issue.field}`) ? t(`fields.${issue.field}`) : issue.field) : null;
  return (
    <span className="text-xs text-muted-foreground">
      {t(`sections.${issue.section}`)}
      {issue.item !== null ? (
        <>
          {" › "}
          {t("item")}{" "}
          <bdi dir="ltr" className="font-mono">
            {issue.item || "—"}
          </bdi>
        </>
      ) : null}
      {field ? ` › ${field}` : null}
    </span>
  );
}

/**
 * The pre-publish checklist: every issue the server returned for the saved draft, grouped by section, with a Persian
 * explanation. Publishing stays blocked while the list is not empty.
 */
export function IssueChecklist({ issues, stale, className }: { issues: readonly string[]; stale?: boolean; className?: string }) {
  const t = useTranslations("templates.issues");
  const text = useIssueText();
  const groups = groupIssues(issues);

  if (issues.length === 0) {
    return (
      <p className={cn("flex items-center gap-2 text-sm text-success-foreground", className)}>
        <CircleCheck className="size-4 shrink-0" aria-hidden />
        {t("ok")}
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="flex items-center gap-2 text-sm font-medium text-danger">
        <CircleAlert className="size-4 shrink-0" aria-hidden />
        {t("pending", { count: issues.length })}
      </p>
      {stale ? <p className="text-xs text-muted-foreground">{t("staleHint")}</p> : null}
      {groups.map((g) => (
        <section key={g.section} aria-label={t(`sections.${g.section}`)} className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold">{t(`sections.${g.section}`)}</h3>
          <ul className="flex flex-col gap-1.5">
            {g.issues.map((issue, i) => (
              <li key={`${issue.raw}-${i}`} className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm">
                <span aria-hidden className="mt-1 size-3.5 shrink-0 rounded-sm border-2 border-danger" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <IssuePlace issue={issue} />
                  <span>{text(issue)}</span>
                  <code dir="ltr" className="self-start text-[11px] text-muted-foreground">
                    {issue.raw}
                  </code>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** A short marker next to an item that has issues. */
export function ItemIssues({ issues }: { issues: TemplateIssue[] }) {
  const text = useIssueText();
  const t = useTranslations("templates.issues");
  if (issues.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-xs text-danger" aria-label={t("title")}>
      {issues.map((issue, i) => (
        <li key={`${issue.raw}-${i}`} className="flex items-start gap-1">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {issue.field ? `${t.has(`fields.${issue.field}`) ? t(`fields.${issue.field}`) : issue.field}: ` : null}
            {text(issue)}
          </span>
        </li>
      ))}
    </ul>
  );
}
