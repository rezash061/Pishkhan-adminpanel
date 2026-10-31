import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { LeadsTable } from "./leads-table";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("leads"))("title") };
}

export default async function LeadsPage() {
  if (!(await staffWith("leads.read"))) return <Forbidden />;
  const t = await getTranslations("leads");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense>
        <LeadsTable />
      </Suspense>
    </>
  );
}
