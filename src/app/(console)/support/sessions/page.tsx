import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { SupportSessionForm } from "./support-session-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("support"))("title") };
}

export default async function SupportSessionsPage({ searchParams }: PageProps<"/support/sessions">) {
  if (!(await staffWith("workspaces.impersonate"))) return <Forbidden />;
  const t = await getTranslations("support");
  const { workspaceId } = await searchParams;
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <SupportSessionForm initialWorkspaceId={typeof workspaceId === "string" ? workspaceId : ""} />
    </>
  );
}
