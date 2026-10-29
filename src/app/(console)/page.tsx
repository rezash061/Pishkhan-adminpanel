import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { NavIcon } from "@/components/console/nav-icon";
import { Forbidden } from "@/components/console/forbidden";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { staffWith } from "@/lib/auth/guard";
import { can, navFor } from "@/lib/permissions";
import { HealthSummary } from "./platform/health/health-panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("home"))("title") };
}

export default async function HomePage() {
  const staff = await staffWith("dashboard.read");
  if (!staff) return <Forbidden />;
  const t = await getTranslations();
  const links = navFor(staff.roles).filter((i) => i.href !== "/");

  return (
    <>
      <PageHeader title={t("home.welcome", { username: staff.username })} />
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("home.rolesLabel")}:</span>
        {staff.roles.map((r) => (
          <Badge key={r} tone="info">
            {t.has(`roles.${r}`) ? t(`roles.${r}`) : r}
          </Badge>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {can(staff.roles, "platform.health.read") ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("home.health")}</CardTitle>
            </CardHeader>
            <CardContent>
              <HealthSummary />
              <Link href="/platform/health" className="mt-3 inline-block text-sm text-primary hover:underline">
                {t("home.healthLink")}
              </Link>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>{t("home.quickLinks")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-2 gap-2">
              {links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
                    <NavIcon name={item.icon} className="size-4 text-muted-foreground" />
                    {t(`nav.${item.labelKey}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Alert tone="info" className="mt-6">
        {t("home.kpiPending")}
      </Alert>
    </>
  );
}
