import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { HealthPanel } from "./health-panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("health"))("title") };
}

export default async function HealthPage() {
  if (!(await staffWith("platform.health.read"))) return <Forbidden />;
  const t = await getTranslations("health");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <HealthPanel />
      <Alert tone="info" className="mt-6">
        {t("pending")}
      </Alert>
    </>
  );
}
