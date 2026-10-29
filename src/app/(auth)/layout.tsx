import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("app");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-bold">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
          <span>
            {t("console")} {t("name")}
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
