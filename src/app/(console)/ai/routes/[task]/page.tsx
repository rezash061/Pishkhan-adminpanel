import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { RouteEditor } from "./route-editor";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("ai.routes"))("editorTitle") };
}

export default async function AiRouteEditPage({ params }: PageProps<"/ai/routes/[task]">) {
  if (!(await staffWith("ai.manage"))) return <Forbidden />;
  const { task } = await params;
  return <RouteEditor task={task} />;
}
