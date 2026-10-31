import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { WorkspaceDetailView } from "./workspace-detail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("workspaces"))("detail.title") };
}

export default async function WorkspacePage({ params }: PageProps<"/workspaces/[workspaceId]">) {
  if (!(await staffWith("workspaces.read"))) return <Forbidden />;
  const { workspaceId } = await params;
  return <WorkspaceDetailView workspaceId={workspaceId} />;
}
