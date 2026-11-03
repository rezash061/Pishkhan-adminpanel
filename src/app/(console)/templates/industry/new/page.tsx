import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { NewTemplate } from "./new-template";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("templates"))("new.title") };
}

export default async function NewIndustryTemplatePage() {
  if (!(await staffWith("templates.manage"))) return <Forbidden />;
  const t = await getTranslations("templates");
  return (
    <>
      <PageHeader title={t("new.title")} description={t("new.description")} />
      <Suspense>
        <NewTemplate />
      </Suspense>
    </>
  );
}
