import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { EntryDetail } from "./entry-detail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("content"))("detailTitle") };
}

export default async function EntryPage({ params }: PageProps<"/content/entries/[entryId]">) {
  if (!(await staffWith("content.read"))) return <Forbidden />;
  const { entryId } = await params;
  return (
    <Suspense>
      <EntryDetail entryId={entryId} />
    </Suspense>
  );
}
