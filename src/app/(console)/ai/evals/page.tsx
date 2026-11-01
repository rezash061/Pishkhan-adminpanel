import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { EvalRunsTable } from "./eval-runs";
import { EvalSets } from "./eval-sets";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("ai.evals"))("title") };
}

export default async function AiEvalsPage() {
  if (!(await staffWith("ai.read"))) return <Forbidden />;
  const t = await getTranslations("ai.evals");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="flex flex-col gap-6">
        <EvalSets />
        <Suspense>
          <EvalRunsTable />
        </Suspense>
      </div>
    </>
  );
}
