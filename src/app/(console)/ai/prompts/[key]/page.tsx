import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { PromptDetail } from "./prompt-detail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("ai.prompts"))("detailTitle") };
}

export default async function AiPromptPage({ params }: PageProps<"/ai/prompts/[key]">) {
  if (!(await staffWith("ai.read"))) return <Forbidden />;
  const { key } = await params;
  return <PromptDetail promptKey={decodeURIComponent(key)} />;
}
