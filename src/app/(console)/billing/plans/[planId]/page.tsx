import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { PlanDetail } from "./plan-detail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("plans"))("detail.title") };
}

export default async function PlanPage({ params }: PageProps<"/billing/plans/[planId]">) {
  if (!(await staffWith("plans.read"))) return <Forbidden />;
  const { planId } = await params;
  return (
    <Suspense>
      <PlanDetail planId={planId} />
    </Suspense>
  );
}
