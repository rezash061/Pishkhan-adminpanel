import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { TracesList } from "./traces-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("traces"))("title") };
}

export default async function Page() {
  if (!(await staffWith("ai.traces.read"))) return <Forbidden />;
  const t = await getTranslations("traces");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <TracesList />
    </>
  );
}
