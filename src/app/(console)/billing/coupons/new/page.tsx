import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { NewCoupon } from "../coupon-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("billing.coupons"))("createTitle") };
}

export default async function Page() {
  if (!(await staffWith("coupons.manage"))) return <Forbidden />;
  return <NewCoupon />;
}
