import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { EntriesList } from "./entries-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("content"))("title") };
}

export default async function ContentEntriesPage() {
  if (!(await staffWith("content.read"))) return <Forbidden />;
  const t = await getTranslations("content");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense>
        <EntriesList />
      </Suspense>
    </>
  );
}
