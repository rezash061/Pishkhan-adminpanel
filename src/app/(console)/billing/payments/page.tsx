import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { PaymentsList } from "./payments-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("billing.payments"))("title") };
}

export default async function Page() {
  if (!(await staffWith("billing.read"))) return <Forbidden />;
  const t = await getTranslations("billing.payments");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <PaymentsList />
    </>
  );
}
