import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("login"))("title") };
}

/** Only same-site relative paths are honoured as the post-login destination. */
function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" && ["expired", "idle", "loggedOut"].includes(params.reason) ? params.reason : null;
  return <LoginForm next={safeNext(params.next)} reason={reason as "expired" | "idle" | "loggedOut" | null} />;
}
