import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { QuarantineList } from "./quarantine-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("quarantine"))("title") };
}

export default async function QuarantinePage() {
  if (!(await staffWith("files.quarantine"))) return <Forbidden />;
  const t = await getTranslations("quarantine");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <QuarantineList />
    </>
  );
}
