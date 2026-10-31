"use client";

import { useTranslations } from "next-intl";
import { Table, Td, Th } from "@/components/ui/table";
import type { AiRouteStep } from "@/lib/api/types";
import { formatNumber, formatToman, toPersianDigits } from "@/lib/format";

/** A fallback chain, first step first. Prices arrive in Rial per million tokens and show in Toman. */
export function RouteStepsTable({ steps }: { steps: AiRouteStep[] }) {
  const t = useTranslations("ai.routes");
  if (steps.length === 0) return <p className="px-5 py-4 text-sm text-muted-foreground">{t("noSteps")}</p>;
  const price = (rial: number | null) => (rial == null ? "—" : formatToman(rial));
  return (
    <Table>
      <thead>
        <tr>
          <Th>#</Th>
          <Th>{t("columns.provider")}</Th>
          <Th>{t("columns.model")}</Th>
          <Th>{t("columns.temperature")}</Th>
          <Th>{t("columns.maxOutputTokens")}</Th>
          <Th>{t("columns.timeout")}</Th>
          <Th>{t("columns.prices")}</Th>
        </tr>
      </thead>
      <tbody>
        {steps.map((s, i) => (
          <tr key={`${s.provider}/${s.model}`}>
            <Td>{toPersianDigits(i + 1)}</Td>
            <Td>
              <span dir="ltr" className="font-mono text-xs">
                {s.provider}
              </span>
            </Td>
            <Td>
              <span dir="ltr" className="font-mono text-xs">
                {s.model}
              </span>
            </Td>
            <Td>{s.temperature == null ? "—" : toPersianDigits(s.temperature)}</Td>
            <Td>{s.maxOutputTokens == null ? "—" : formatNumber(s.maxOutputTokens)}</Td>
            <Td>{t("seconds", { n: formatNumber(s.timeoutSeconds) })}</Td>
            <Td className="text-xs whitespace-nowrap">
              {s.inputPricePerMillion == null && s.outputPricePerMillion == null ? "—" : t("pricePair", { input: price(s.inputPricePerMillion), output: price(s.outputPricePerMillion) })}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
