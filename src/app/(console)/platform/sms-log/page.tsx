import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { SmsLogList } from "./sms-log-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("smsLog"))("title") };
}

export default async function Page() {
  if (!(await staffWith("platform.messaging.read"))) return <Forbidden />;
  const t = await getTranslations("smsLog");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <SmsLogList />
    </>
  );
}
