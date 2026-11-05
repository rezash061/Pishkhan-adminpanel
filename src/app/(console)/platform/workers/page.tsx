import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { WorkersPanel } from "./workers-panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("workers"))("title") };
}

export default async function Page() {
  if (!(await staffWith("platform.ops.read"))) return <Forbidden />;
  const t = await getTranslations("workers");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <WorkersPanel />
    </>
  );
}
