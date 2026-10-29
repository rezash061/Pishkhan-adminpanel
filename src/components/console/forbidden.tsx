import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function Forbidden() {
  const t = await getTranslations("errorPages");
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center" data-testid="forbidden">
      <ShieldAlert className="size-10 text-danger" aria-hidden />
      <h1 className="text-xl font-bold">{t("forbiddenTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("forbiddenBody")}</p>
      <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        {t("backHome")}
      </Link>
    </div>
  );
}
