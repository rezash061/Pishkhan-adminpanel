import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { NewPlan } from "./new-plan";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("plans"))("createTitle") };
}

export default async function NewPlanPage() {
  if (!(await staffWith("plans.manage"))) return <Forbidden />;
  const t = await getTranslations("plans");
  return (
    <>
      <PageHeader title={t("createTitle")} description={t("createDescription")} />
      <NewPlan />
    </>
  );
}
