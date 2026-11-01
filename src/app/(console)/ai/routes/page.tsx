import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { RoutesList } from "./routes-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("ai.routes"))("title") };
}

export default async function AiRoutesPage() {
  if (!(await staffWith("ai.read"))) return <Forbidden />;
  const t = await getTranslations("ai.routes");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <RoutesList />
    </>
  );
}
