import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { StaffManager } from "./staff-manager";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("staff"))("title") };
}

export default async function StaffPage() {
  if (!(await staffWith("staff.read"))) return <Forbidden />;
  return <StaffManager />;
}
