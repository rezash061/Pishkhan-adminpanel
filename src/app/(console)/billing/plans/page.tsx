import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { PlansList } from "./plans-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("plans"))("title") };
}

export default async function PlansPage() {
  if (!(await staffWith("plans.read"))) return <Forbidden />;
  const t = await getTranslations("plans");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <PlansList />
    </>
  );
}
