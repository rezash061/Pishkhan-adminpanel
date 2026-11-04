import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { OutagePanel } from "./outage-panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("outage"))("title") };
}

export default async function OutagePage() {
  if (!(await staffWith("platform.outage.read"))) return <Forbidden />;
  const t = await getTranslations("outage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <OutagePanel />
    </>
  );
}
