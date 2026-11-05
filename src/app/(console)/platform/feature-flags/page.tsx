import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { FlagsManager } from "./flags-manager";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("flags"))("title") };
}

export default async function Page() {
  if (!(await staffWith("flags.read"))) return <Forbidden />;
  const t = await getTranslations("flags");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <FlagsManager />
    </>
  );
}
