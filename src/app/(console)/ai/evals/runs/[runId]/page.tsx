import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { EvalRunView } from "./eval-run";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("ai.evals"))("runTitle") };
}

export default async function AiEvalRunPage({ params }: PageProps<"/ai/evals/runs/[runId]">) {
  if (!(await staffWith("ai.read"))) return <Forbidden />;
  const { runId } = await params;
  return <EvalRunView runId={runId} />;
}
