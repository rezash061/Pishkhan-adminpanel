import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { AuditLog } from "./audit-log";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("audit"))("title") };
}

export default async function AuditLogPage() {
  if (!(await staffWith("audit.read"))) return <Forbidden />;
  const t = await getTranslations("audit");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense>
        <AuditLog />
      </Suspense>
    </>
  );
}
