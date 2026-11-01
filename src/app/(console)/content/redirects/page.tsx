import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { RedirectsManager } from "./redirects-manager";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("content.redirects"))("title") };
}

export default async function ContentRedirectsPage() {
  if (!(await staffWith("content.read"))) return <Forbidden />;
  const t = await getTranslations("content.redirects");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <RedirectsManager />
    </>
  );
}
