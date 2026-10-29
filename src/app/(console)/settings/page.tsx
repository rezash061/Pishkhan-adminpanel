import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth/session";
import { LogoutButton } from "./logout-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("settings"))("title") };
}

export default async function SettingsPage() {
  const staff = await requireStaff();
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("settings.title")} />
      <div className="grid max-w-3xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.account")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("settings.username")}</dt>
              <dd className="ltr text-start">{staff.username}</dd>
              <dt className="text-muted-foreground">{t("settings.roles")}</dt>
              <dd>{staff.roles.map((r) => (t.has(`roles.${r}`) ? t(`roles.${r}`) : r)).join("، ")}</dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.security")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
            <p className="text-sm">{t("settings.securityBody")}</p>
            <LogoutButton label={t("settings.logoutEverywhere")} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
