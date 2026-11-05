import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { DeadLetterDetailView } from "./dead-letter-detail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("deadLetters"))("detail.title") };
}

export default async function DeadLetterPage({ params }: PageProps<"/platform/dead-letters/[id]">) {
  if (!(await staffWith("platform.ops.read"))) return <Forbidden />;
  const { id } = await params;
  return <DeadLetterDetailView id={id} />;
}
