import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { EntryEditor } from "../../entry-editor";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("content"))("create") };
}

export default async function NewEntryPage() {
  if (!(await staffWith("content.manage"))) return <Forbidden />;
  const t = await getTranslations("content");
  return (
    <>
      <PageHeader title={t("create")} description={t("createDescription")} />
      <EntryEditor entry={null} canManage />
    </>
  );
}
