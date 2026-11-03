import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { TemplateDetail } from "./template-detail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("templates"))("detail.title") };
}

export default async function IndustryTemplatePage({ params }: PageProps<"/templates/industry/[templateId]">) {
  if (!(await staffWith("templates.read"))) return <Forbidden />;
  const { templateId } = await params;
  return (
    <Suspense>
      <TemplateDetail templateId={templateId} />
    </Suspense>
  );
}
