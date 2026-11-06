import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { CouponDetailView } from "./coupon-detail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("billing.coupons"))("title") };
}

export default async function CouponPage({
  params,
}: PageProps<"/billing/coupons/[id]">) {
  if (!(await staffWith("billing.read"))) return <Forbidden />;
  const { id } = await params;
  return <CouponDetailView id={id} />;
}
