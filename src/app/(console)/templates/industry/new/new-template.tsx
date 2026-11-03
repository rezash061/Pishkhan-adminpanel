"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { admin } from "@/lib/api/client";
import { ApiError } from "@/lib/problem";
import { TEMPLATE_INDUSTRIES, type IndustryTemplate, type PagedResult } from "@/lib/api/types";
import { useIndustryLabel } from "../template-badges";
import { TemplateForm } from "../template-form";
import { EMPTY_CONTENT } from "../template-values";

/** Creates version 1 of an industry that has no template yet, as a draft, then opens it. */
export function NewTemplate() {
  const t = useTranslations("templates");
  const te = useTranslations("errors");
  const industryLabel = useIndustryLabel();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [industry, setIndustry] = useState(TEMPLATE_INDUSTRIES.find((i) => i === params.get("industry")) ?? "");
  const [industryError, setIndustryError] = useState<string | null>(null);

  // Industries that already have any version cannot get a first draft (409 templates.industry_taken).
  const existing = useQuery({
    queryKey: ["industry-templates", "all"],
    queryFn: () => admin<PagedResult<IndustryTemplate>>("/industry-templates?pageSize=100"),
  });
  const taken = new Set(existing.data?.items.map((v) => v.industry) ?? []);
  const free = TEMPLATE_INDUSTRIES.filter((i) => !taken.has(i));

  return (
    <div className="flex flex-col gap-4">
      {existing.data && free.length === 0 ? <Alert tone="info">{t("new.allTaken")}</Alert> : null}
      <TemplateForm
        initial={{ name: "", description: null, content: EMPTY_CONTENT }}
        allowPristine
        submitLabel={t("new.submit")}
        header={
          <Field label={t("new.industry")} error={industryError ?? undefined} className="md:col-span-2">
            {({ id, describedBy, invalid }) => (
              <select
                id={id}
                value={industry}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                onChange={(e) => {
                  setIndustry(e.target.value);
                  setIndustryError(null);
                }}
                className="h-10 rounded-md border border-border bg-surface px-2 text-sm md:max-w-xs"
              >
                <option value="">{t("new.chooseIndustry")}</option>
                {TEMPLATE_INDUSTRIES.map((i) => (
                  <option key={i} value={i} disabled={taken.has(i)}>
                    {industryLabel(i)}
                    {taken.has(i) ? ` (${t("new.taken")})` : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
        }
        onSubmit={async (template) => {
          if (!industry) {
            setIndustryError(te("validation.required"));
            return false;
          }
          try {
            const created = await admin<IndustryTemplate>("/industry-templates", { method: "POST", body: { industry, template } });
            await queryClient.invalidateQueries({ queryKey: ["industry-templates"] });
            router.push(`/templates/industry/${created.id}?created=1`);
          } catch (error) {
            if (error instanceof ApiError && error.code === "templates.industry_taken") setIndustryError(te("templates.industry_taken"));
            throw error;
          }
        }}
      />
    </div>
  );
}
