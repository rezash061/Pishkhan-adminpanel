import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("errorPages");
  return (
    <main className="mx-auto mt-24 flex max-w-md flex-col items-center gap-3 px-4 text-center">
      <p className="text-5xl font-bold text-muted-foreground">۴۰۴</p>
      <h1 className="text-xl font-bold">{t("notFoundTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("notFoundBody")}</p>
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        {t("backHome")}
      </Link>
    </main>
  );
}
