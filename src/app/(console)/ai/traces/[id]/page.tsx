import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { TraceDetailView } from "./trace-detail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("traces"))("detail.title") };
}

export default async function TracePage({ params }: PageProps<"/ai/traces/[id]">) {
  if (!(await staffWith("ai.traces.read"))) return <Forbidden />;
  const { id } = await params;
  return <TraceDetailView id={id} />;
}
