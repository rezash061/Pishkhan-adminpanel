"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { toPersianDigits } from "@/lib/format";
import type { FlowSummary, RuleSummary } from "./template-values";

function useLabel(group: "triggerKinds" | "actionKinds" | "nodeTypes") {
  const t = useTranslations(`templates.form.${group}`);
  return (key: string) => (t.has(key) ? t(key) : key);
}

/** Read-only preview of the flows JSON: name, key, node count and node types. */
export function FlowsSummary({ flows }: { flows: FlowSummary[] | null }) {
  const t = useTranslations("templates.form");
  const nodeType = useLabel("nodeTypes");
  if (flows === null) return <p className="text-sm text-muted-foreground">{t("summaryUnavailable")}</p>;
  if (flows.length === 0) return <p className="text-sm text-muted-foreground">{t("noFlows")}</p>;
  return (
    <ul className="flex flex-col gap-2" aria-label={t("summary")}>
      {flows.map((f, i) => (
        <li key={`${f.key}-${i}`} className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 text-sm">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{f.name || "—"}</span>
            <code dir="ltr" className="text-xs text-muted-foreground">
              {f.key}
            </code>
            <Badge tone="info">{t("nodes", { count: f.nodeCount })}</Badge>
            <span className="text-xs text-muted-foreground">{t("edges", { count: f.edgeCount })}</span>
            {f.start ? (
              <span className="text-xs text-muted-foreground">
                {t("startNode", { node: "" })}
                <bdi dir="ltr" className="font-mono">
                  {f.start}
                </bdi>
              </span>
            ) : null}
          </span>
          {f.nodeTypes.length ? (
            <span className="flex flex-wrap gap-1">
              {f.nodeTypes.map((n) => (
                <Badge key={n.type}>
                  {nodeType(n.type)} × {toPersianDigits(n.count)}
                </Badge>
              ))}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Read-only preview of the rules JSON: name, trigger kind, keywords, actions and the flow a rule starts. */
export function RulesSummary({ rules }: { rules: RuleSummary[] | null }) {
  const t = useTranslations("templates.form");
  const trigger = useLabel("triggerKinds");
  const action = useLabel("actionKinds");
  if (rules === null) return <p className="text-sm text-muted-foreground">{t("summaryUnavailable")}</p>;
  if (rules.length === 0) return <p className="text-sm text-muted-foreground">{t("noRules")}</p>;
  return (
    <ul className="flex flex-col gap-2" aria-label={t("summary")}>
      {rules.map((r, i) => (
        <li key={`${r.key}-${i}`} className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 text-sm">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.name || "—"}</span>
            <code dir="ltr" className="text-xs text-muted-foreground">
              {r.key}
            </code>
            {r.priority !== null ? <span className="text-xs text-muted-foreground">{t("priority", { n: toPersianDigits(r.priority) })}</span> : null}
          </span>
          <span className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-muted-foreground">{t("trigger")}:</span>
            <Badge tone="info">{r.triggerKind ? trigger(r.triggerKind) : "—"}</Badge>
            {r.keywords.length ? <span className="text-muted-foreground">{r.keywords.map((k) => `«${k}»`).join("، ")}</span> : null}
          </span>
          <span className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-muted-foreground">{t("actions")}:</span>
            {r.actions.map((a, n) => (
              <Badge key={`${a}-${n}`}>{action(a)}</Badge>
            ))}
            {r.flowKey ? (
              <span className="text-muted-foreground">
                → <bdi dir="ltr" className="font-mono">{r.flowKey}</bdi>
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
