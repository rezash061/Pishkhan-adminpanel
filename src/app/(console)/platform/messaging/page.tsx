import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { MessagingPanel } from "./messaging-panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("messaging"))("title") };
}

export default async function Page() {
  if (!(await staffWith("platform.messaging.read"))) return <Forbidden />;
  const t = await getTranslations("messaging");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <MessagingPanel />
    </>
  );
}
