import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { TemplatesList } from "./templates-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("templates"))("title") };
}

export default async function IndustryTemplatesPage() {
  if (!(await staffWith("templates.read"))) return <Forbidden />;
  const t = await getTranslations("templates");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense>
        <TemplatesList />
      </Suspense>
    </>
  );
}
