"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { admin } from "@/lib/api/client";
import type { Plan } from "@/lib/api/types";
import { PlanForm } from "../plan-form";
import { EMPTY_PLAN } from "../plan-values";

/** Creates version 1 as a draft, then opens it for review and publishing. */
export function NewPlan() {
  const t = useTranslations("plans");
  const router = useRouter();
  const queryClient = useQueryClient();
  return (
    <PlanForm
      initial={EMPTY_PLAN}
      withCode
      submitLabel={t("createSubmit")}
      onSubmit={async (plan, code) => {
        const created = await admin<Plan>("/plans", { method: "POST", body: { code, plan } });
        await queryClient.invalidateQueries({ queryKey: ["plans"] });
        router.push(`/billing/plans/${created.id}?created=1`);
      }}
    />
  );
}
