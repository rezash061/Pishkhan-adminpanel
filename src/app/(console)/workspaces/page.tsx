import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { WorkspaceSearch } from "./workspace-search";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("workspaces"))("title") };
}

export default async function WorkspacesPage() {
  if (!(await staffWith("workspaces.read"))) return <Forbidden />;
  const t = await getTranslations("workspaces");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense>
        <WorkspaceSearch />
      </Suspense>
    </>
  );
}
