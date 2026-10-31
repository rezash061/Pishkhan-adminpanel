import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { UserDetailView } from "./user-detail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("users"))("detail.title") };
}

export default async function UserPage({ params }: PageProps<"/users/[userId]">) {
  if (!(await staffWith("users.read"))) return <Forbidden />;
  const { userId } = await params;
  return <UserDetailView userId={userId} />;
}
