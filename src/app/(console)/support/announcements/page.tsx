import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { AnnouncementsList } from "./announcements-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("announcements"))("title") };
}

export default async function Page() {
  if (!(await staffWith("tickets.read"))) return <Forbidden />;
  const t = await getTranslations("announcements");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <AnnouncementsList />
    </>
  );
}
