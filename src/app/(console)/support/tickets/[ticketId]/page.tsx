import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/console/forbidden";
import { staffWith } from "@/lib/auth/guard";
import { TicketThread } from "./ticket-thread";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("tickets"))("title") };
}

export default async function TicketPage({ params }: PageProps<"/support/tickets/[ticketId]">) {
  if (!(await staffWith("tickets.read"))) return <Forbidden />;
  const { ticketId } = await params;
  return <TicketThread id={ticketId} />;
}
