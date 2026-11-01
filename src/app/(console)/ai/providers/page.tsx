import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { ProvidersList } from "./providers-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("ai.providers"))("title") };
}

export default async function AiProvidersPage() {
  if (!(await staffWith("ai.read"))) return <Forbidden />;
  const t = await getTranslations("ai.providers");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ProvidersList />
    </>
  );
}
