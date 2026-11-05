import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { PaymentDetailView } from "./payment-detail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("billing.payment"))("title") };
}

export default async function PaymentPage({ params }: PageProps<"/billing/payments/[id]">) {
  if (!(await staffWith("billing.read"))) return <Forbidden />;
  const { id } = await params;
  return <PaymentDetailView id={id} />;
}
