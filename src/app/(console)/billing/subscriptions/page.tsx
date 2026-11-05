import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { SubscriptionsList } from "./subscriptions-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("billing.subscriptions"))("title") };
}

export default async function Page() {
  if (!(await staffWith("billing.read"))) return <Forbidden />;
  const t = await getTranslations("billing.subscriptions");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <SubscriptionsList />
    </>
  );
}
