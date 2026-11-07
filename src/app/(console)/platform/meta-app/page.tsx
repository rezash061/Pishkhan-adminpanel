import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { MetaAppPanel } from "./meta-app-panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metaApp"))("title") };
}

export default async function Page() {
  if (!(await staffWith("platform.messaging.read"))) return <Forbidden />;
  const t = await getTranslations("metaApp");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <MetaAppPanel />
    </>
  );
}
