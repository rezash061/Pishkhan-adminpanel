import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { UserSearch } from "./user-search";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("users"))("title") };
}

export default async function UsersPage() {
  if (!(await staffWith("users.read"))) return <Forbidden />;
  const t = await getTranslations("users");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense>
        <UserSearch />
      </Suspense>
    </>
  );
}
